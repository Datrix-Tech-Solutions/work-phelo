import { readFileSync, writeFileSync, mkdtempSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const services = [
  'api-gateway',
  'auth-service',
  'hr-service',
  'notification-service',
  'subscription-service',
  'marketing-service',
  'reinsurance-service',
  'accounting-service',
  'inventory-service',
  'ai-service',
  'nextjs-web',
];
const prefix = 'ghcr.io/datrix-tech-solutions/work-phelo';
const sha = /^[a-f0-9]{40}$/;
const requireValue = (condition, message) => {
  if (!condition) throw new Error(message);
};
const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const output = (key, value) => appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);

export function validateState(state, expectedSha) {
  requireValue(
    state?.version === 1 &&
      typeof state.sha === 'string' &&
      sha.test(state.sha) &&
      (!expectedSha || state.sha === expectedSha),
    'Invalid deployment baseline SHA/version',
  );
  requireValue(
    state.images && typeof state.images === 'object' && !Array.isArray(state.images),
    'Missing successful image inventory',
  );
  requireValue(
    Object.keys(state.images).every((s) => services.includes(s)),
    'Unknown baseline service',
  );
  for (const service of services) {
    const ref = state.images[service];
    if (service === 'ai-service' && ref === undefined) continue; // Legacy adoption only.
    requireValue(
      typeof ref === 'string' &&
        ref.startsWith(`${prefix}/${service}:`) &&
        sha.test(ref.slice(`${prefix}/${service}:`.length)),
      `Missing or non-SHA baseline image: ${service}`,
    );
  }
  return state;
}

export function legacyState(run, jobs) {
  requireValue(
    run.conclusion === 'success' && run.event === 'push' && run.head_branch === 'dev',
    'Not a successful DEV push',
  );
  requireValue(
    jobs.some((j) => j.name === 'Deploy to Dev' && j.conclusion === 'success'),
    'No successful deployment job',
  );
  const images = {};
  for (const service of services) {
    if (
      jobs.some(
        (j) =>
          j.name === `Build & Push — ${service}` &&
          j.conclusion === 'success' &&
          j.steps?.some(
            (s) => s.name === `Build and push ${service}` && s.conclusion === 'success',
          ),
      )
    )
      images[service] = `${prefix}/${service}:${run.head_sha}`;
  }
  return validateState({ version: 1, sha: run.head_sha, runId: String(run.id), images });
}

export function makePlan(baseline, head, changed) {
  validateState(baseline);
  requireValue(
    sha.test(head) && Array.isArray(changed) && changed.every((s) => services.includes(s)),
    'Invalid deployment selection',
  );
  const selected = services.filter((s) => changed.includes(s) || !baseline.images[s]);
  return { version: 1, head, baseline, changed: selected };
}

export function plannedState(plan, runId) {
  const checked = makePlan(plan.baseline, plan.head, plan.changed);
  return validateState({
    version: 1,
    sha: checked.head,
    runId: String(runId),
    images: Object.fromEntries(
      services.map((s) => [
        s,
        checked.changed.includes(s) ? `${prefix}/${s}:${checked.head}` : checked.baseline.images[s],
      ]),
    ),
  });
}

export function authorizeDeployment(plan, head, latestDev, approval) {
  requireValue(
    plan.head === head && head === latestDev,
    'Stale deployment: target must still be DEV HEAD',
  );
  requireValue(
    approval === head && sha.test(approval),
    'DEV database operations require explicit approval for this exact SHA',
  );
}

export function successfulRun(runs, repository, currentRunId) {
  return runs
    .filter(
      (r) =>
        r.conclusion === 'success' &&
        r.event === 'push' &&
        r.head_branch === 'dev' &&
        r.head_repository?.full_name === repository &&
        String(r.id) !== currentRunId,
    )
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
}

async function api(path) {
  const response = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${path}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(15000),
    },
  );
  requireValue(response.ok, `Cannot verify deployment metadata (HTTP ${response.status})`);
  return response.json();
}

async function resolveBaseline() {
  requireValue(
    process.env.GITHUB_REPOSITORY === 'Datrix-Tech-Solutions/work-phelo',
    'Unexpected repository',
  );
  const head = process.env.BUILD_SHA;
  requireValue(sha.test(head), 'Invalid target SHA');
  const { workflow_runs: runs } = await api(
    'actions/workflows/deploy-dev.yml/runs?branch=dev&event=push&status=success&per_page=100',
  );
  const run = successfulRun(runs, process.env.GITHUB_REPOSITORY, process.env.GITHUB_RUN_ID);
  let state;
  if (run) {
    const { jobs } = await api(`actions/runs/${run.id}/jobs?per_page=100`);
    requireValue(
      jobs.some((j) => j.name === 'Deploy to Dev' && j.conclusion === 'success'),
      'Successful run has no successful deploy job',
    );
    const { artifacts } = await api(`actions/runs/${run.id}/artifacts?per_page=100`);
    const artifact = artifacts.find((a) => a.name === 'dev-deployment-state' && !a.expired);
    if (artifact) {
      const dir = mkdtempSync(join(tmpdir(), 'dev-baseline-'));
      try {
        execFileSync(
          'gh',
          [
            'run',
            'download',
            String(run.id),
            '--repo',
            process.env.GITHUB_REPOSITORY,
            '--name',
            'dev-deployment-state',
            '--dir',
            dir,
          ],
          { stdio: 'pipe' },
        );
        const text = readFileSync(join(dir, 'dev-deployment-state.json'), 'utf8');
        requireValue(text.length < 16384, 'Oversized deployment state');
        state = validateState(JSON.parse(text), run.head_sha);
        requireValue(state.runId === String(run.id), 'Baseline run mismatch');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    } else {
      try {
        state = legacyState(run, jobs);
      } catch {
        // Never fall back to an older successful deployment or rebuild everything.
        state = undefined;
      }
    }
  }
  if (!state) {
    requireValue(
      process.env.DEV_DEPLOYMENT_BOOTSTRAP_JSON,
      'No trustworthy deployed baseline: operator-verified bootstrap inventory required',
    );
    state = validateState(JSON.parse(process.env.DEV_DEPLOYMENT_BOOTSTRAP_JSON), run?.head_sha);
  }
  git('merge-base', '--is-ancestor', state.sha, head);
  writeFileSync('dev-deployment-baseline.json', JSON.stringify(state));
  output('sha', state.sha);
  console.log(
    `Verified successful DEV baseline ${state.sha}; ${Object.keys(state.images).length} SHA-tagged images`,
  );
}

async function main() {
  const command = process.argv[2];
  if (command === 'resolve') return resolveBaseline();
  if (command === 'select') {
    const plan = makePlan(
      JSON.parse(readFileSync('dev-deployment-baseline.json', 'utf8')),
      process.env.BUILD_SHA,
      JSON.parse(process.env.FILTER_CHANGED),
    );
    writeFileSync('dev-deployment-plan.json', JSON.stringify(plan));
    output('changed', JSON.stringify(plan.changed));
    for (const service of services) output(service, String(plan.changed.includes(service)));
    console.log(`Selected services: ${plan.changed.join(', ') || '(none)'}`);
    return;
  }
  if (command === 'authorize') {
    const plan = JSON.parse(readFileSync('dev-deployment-plan.json', 'utf8'));
    authorizeDeployment(
      plan,
      process.env.BUILD_SHA,
      git('rev-parse', 'origin/dev'),
      process.env.DEV_DATABASE_OPERATIONS_APPROVED_SHA,
    );
    git('merge-base', '--is-ancestor', plan.baseline.sha, plan.head);
    const current = await api(
      'actions/workflows/deploy-dev.yml/runs?branch=dev&event=push&status=success&per_page=100',
    );
    const latest = successfulRun(
      current.workflow_runs,
      process.env.GITHUB_REPOSITORY,
      process.env.GITHUB_RUN_ID,
    );
    requireValue(
      !latest || latest.head_sha === plan.baseline.sha,
      'Deployment baseline advanced; rerun the complete workflow to replan',
    );
    const state = plannedState(plan, process.env.GITHUB_RUN_ID);
    writeFileSync(
      '.dev-baseline-images.env',
      [
        `DEPLOYED_SHA=${plan.baseline.sha}`,
        ...Object.entries(plan.baseline.images).map(
          ([s, ref]) =>
            `${s === 'nextjs-web' ? 'NEXTJS' : s.toUpperCase().replaceAll('-', '_')}_IMAGE=${ref}`,
        ),
      ].join('\n'),
    );
    writeFileSync('dev-deployment-state.json', JSON.stringify(state));
    console.log('Exact-SHA database-operations authorization and deployment plan verified');
    return;
  }
  throw new Error('Expected resolve, select or authorize');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Deployment planning failed');
    process.exitCode = 1;
  });
}
