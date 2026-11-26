import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  services,
  validateState,
  legacyState,
  makePlan,
  plannedState,
  authorizeDeployment,
  successfulRun,
} from './dev-deployment-plan.mjs';

const prefix = 'ghcr.io/datrix-tech-solutions/work-phelo';
const base = '1'.repeat(40),
  failed = '2'.repeat(40),
  head = '3'.repeat(40);
const repository = 'Datrix-Tech-Solutions/work-phelo';
const state = (includeAi = true) => ({
  version: 1,
  sha: base,
  runId: '1',
  images: Object.fromEntries(
    services
      .filter((s) => includeAi || s !== 'ai-service')
      .map((s) => [s, `${prefix}/${s}:${base}`]),
  ),
});
const run = (id, conclusion, commit = base) => ({
  id,
  conclusion,
  head_sha: commit,
  head_branch: 'dev',
  event: 'push',
  head_repository: { full_name: repository },
  updated_at: `2026-11-26T10:00:${String(id).padStart(2, '0')}Z`,
});
const jobs = services
  .filter((s) => s !== 'ai-service')
  .map((s) => ({
    name: `Build & Push — ${s}`,
    conclusion: 'success',
    steps: [{ name: `Build and push ${s}`, conclusion: 'success' }],
  }));
jobs.push({ name: 'Deploy to Dev', conclusion: 'success' });

test('Gateway/AI-only changes build only those services and reuse exact successful refs', () => {
  const plan = makePlan(state(), head, ['api-gateway', 'ai-service']);
  assert.deepEqual(plan.changed, ['api-gateway', 'ai-service']);
  const result = plannedState(plan, '9');
  assert.equal(result.images['ai-service'], `${prefix}/ai-service:${head}`);
  assert.equal(result.images['hr-service'], `${prefix}/hr-service:${base}`);
});
test('shared dependency selection preserves all affected services', () => {
  const affected = services.filter((s) => s !== 'nextjs-web');
  assert.deepEqual(makePlan(state(), head, affected).changed, affected);
});
test('real Git comparison spans missed pushes, not only the previous push', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dev-plan-git-'));
  const git = (...args) =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim();
  const commit = () => {
    git('add', '--all');
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '-qm',
      'fixture',
    );
    return git('rev-parse', 'HEAD');
  };
  try {
    git('init', '-q');
    for (const service of ['hr-service', 'ai-service']) {
      mkdirSync(join(dir, 'apps', service), { recursive: true });
      writeFileSync(join(dir, 'apps', service, 'fixture.txt'), 'base');
    }
    const deployed = commit();
    writeFileSync(join(dir, 'apps/hr-service/fixture.txt'), 'missed failed/cancelled push');
    const missed = commit();
    writeFileSync(join(dir, 'apps/ai-service/fixture.txt'), 'next push');
    const latest = commit();
    assert.deepEqual(git('diff', '--name-only', deployed, latest).split('\n'), [
      'apps/ai-service/fixture.txt',
      'apps/hr-service/fixture.txt',
    ]);
    assert.deepEqual(git('diff', '--name-only', missed, latest).split('\n'), [
      'apps/ai-service/fixture.txt',
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
for (const status of ['failure', 'cancelled', 'in_progress']) {
  test(`${status} run cannot replace the successful deployment baseline`, () => {
    const prior = successfulRun([run(2, status, failed), run(1, 'success')], repository, '9');
    assert.equal(prior.head_sha, base);
    // Diff must span successful base -> new head, including the missed HR change.
    const plan = makePlan(state(), head, ['hr-service', 'api-gateway']);
    assert.equal(plan.baseline.sha, base);
    assert(plan.changed.includes('hr-service'));
  });
}
test('reverted failed changes restore successful images, never a partially written Compose env', () => {
  const poisonedComposeRef = `${prefix}/hr-service:${failed}`;
  const result = plannedState(makePlan(state(), head, ['api-gateway']), '9');
  assert.notEqual(result.images['hr-service'], poisonedComposeRef);
  assert.equal(result.images['hr-service'], state().images['hr-service']);
});
test('first adoption uses complete legacy push+deploy evidence and always builds missing AI', () => {
  const baseline = legacyState(run(1, 'success'), jobs);
  assert.equal(baseline.images['hr-service'], `${prefix}/hr-service:${base}`);
  assert.deepEqual(makePlan(baseline, head, ['api-gateway']).changed, [
    'api-gateway',
    'ai-service',
  ]);
});
test('no trustworthy first baseline fails closed instead of rebuilding everything', () => {
  assert.throws(() => validateState(undefined));
  assert.throws(() =>
    legacyState(
      run(1, 'success'),
      jobs.filter((j) => !j.name.includes('hr-service')),
    ),
  );
  assert.throws(() =>
    legacyState(
      run(1, 'success'),
      jobs.filter((j) => j.name !== 'Deploy to Dev'),
    ),
  );
});
test('a skipped build step is not evidence of a pushed/deployed image', () => {
  const skipped = structuredClone(jobs);
  skipped[0].steps[0].conclusion = 'skipped';
  assert.throws(() => legacyState(run(1, 'success'), skipped));
});
test('bootstrap/ledger rejects mutable tags, injected env, wrong repos and missing core images', () => {
  for (const ref of [
    `${prefix}/hr-service:dev`,
    `${prefix}/hr-service:${base}\nJWT_SECRET=bad`,
    `other.invalid/hr-service:${base}`,
  ]) {
    const baseline = state();
    baseline.images['hr-service'] = ref;
    assert.throws(() => validateState(baseline));
  }
  const missing = state();
  delete missing.images['auth-service'];
  assert.throws(() => validateState(missing));
  assert.throws(() => validateState(state(), head));
});
test('successful workflows from other repositories/branches/events and current run are excluded', () => {
  assert.equal(
    successfulRun([{ ...run(1, 'success'), event: 'pull_request' }], repository, '9'),
    undefined,
  );
  assert.equal(
    successfulRun([{ ...run(1, 'success'), head_branch: 'prod' }], repository, '9'),
    undefined,
  );
  assert.equal(successfulRun([run(1, 'success')], repository, '1'), undefined);
  assert.equal(successfulRun([run(1, 'success')], 'other/repo', '9'), undefined);
});
test('latest completed successful run, including reruns, supplies the baseline', () => {
  assert.equal(successfulRun([run(1, 'success'), run(3, 'success')], repository, '9').id, 3);
});
test('release approval is exact-SHA; stale reruns cannot roll back a newer DEV head', () => {
  const plan = makePlan(state(), head, ['ai-service']);
  assert.throws(() => authorizeDeployment(plan, head, head, undefined));
  assert.throws(() => authorizeDeployment(plan, head, head, base));
  assert.throws(() => authorizeDeployment(plan, head, failed, head));
  assert.doesNotThrow(() => authorizeDeployment(plan, head, head, head));
});
test('workflow pins an explicit successful SHA baseline, serializes active runs and publishes state last', () => {
  const workflow = readFileSync(new URL('../workflows/deploy-dev.yml', import.meta.url), 'utf8');
  assert(workflow.includes('base: ${{ steps.baseline.outputs.sha }}'));
  assert(workflow.includes('ref: ${{ env.BUILD_SHA }}'));
  assert(workflow.includes('cancel-in-progress: false'));
  assert(
    workflow.indexOf('Record successful deployed image inventory') >
      workflow.indexOf('name: Deploy via SSH'),
  );
  assert(
    workflow.indexOf('Authorize exact release') <
      workflow.indexOf('name: Preflight deployment host'),
  );
});
test('remote approval, baseline and lock checks precede mutation; staged assets are per attempt', () => {
  const script = readFileSync(new URL('./deploy-dev.sh', import.meta.url), 'utf8');
  assert(
    script.indexOf('DEV_DATABASE_OPERATIONS_APPROVED_SHA') < script.indexOf('cp "${ASSET_PATH}'),
  );
  assert(script.indexOf('flock -n 9') < script.indexOf('cp "${ASSET_PATH}'));
  assert(script.includes('.dev-deploy/${DEV_DEPLOYMENT_RUN_ID}-${DEV_DEPLOYMENT_RUN_ATTEMPT}'));
  assert(script.includes('resolve_image_ref "$BASELINE_IMAGE_ENV_FILE"'));
  assert(!script.includes('resolve_image_ref "$COMPOSE_ENV_FILE"'));
});

test('actual deployment script rejects missing approval before changing active files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dev-approval-stop-'));
  try {
    const assets = join(dir, '.dev-deploy/1-1');
    mkdirSync(join(assets, '.github/scripts'), { recursive: true });
    mkdirSync(join(assets, 'infrastructure'), { recursive: true });
    mkdirSync(join(dir, 'infrastructure'), { recursive: true });
    writeFileSync(
      join(assets, '.github/scripts/deploy-common.sh'),
      readFileSync(new URL('./deploy-common.sh', import.meta.url)),
    );
    const active = join(dir, 'infrastructure/docker-compose.dev.yml');
    writeFileSync(active, 'known-good');
    writeFileSync(join(assets, 'infrastructure/docker-compose.dev.yml'), 'candidate');
    const script = readFileSync(new URL('./deploy-dev.sh', import.meta.url), 'utf8').replace(
      'DEPLOY_PATH="/var/www/apps/dev.workphelo.datrixtechsolutions.com/work-phelo"',
      `DEPLOY_PATH="${dir}"`,
    );
    const file = join(dir, 'candidate.sh');
    writeFileSync(file, script);
    assert.throws(
      () =>
        execFileSync('bash', [file], {
          env: {
            PATH: process.env.PATH,
            BUILD_SHA: head,
            DEV_DEPLOYMENT_RUN_ID: '1',
            DEV_DEPLOYMENT_RUN_ATTEMPT: '1',
          },
          stdio: 'pipe',
        }),
      (error) =>
        error.status === 1 &&
        error.stderr.toString().includes('require approval for this exact release SHA'),
    );
    assert.equal(readFileSync(active, 'utf8'), 'known-good');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
