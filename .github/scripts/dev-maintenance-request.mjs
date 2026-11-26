import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function validateRequest({ tag, head, latestDev, run, jobs, environment, policies }) {
  const match =
    /^dev-maintenance-(migrate|seed)-(auth-service|hr-service|notification-service|reinsurance-service|accounting-service|marketing-service|inventory-service)-([1-9][0-9]*)$/.exec(
      tag || '',
    );
  if (!match || !/^[0-9a-f]{40}$/.test(head) || head !== latestDev)
    throw new Error('Maintenance must target current DEV HEAD');
  const [, operation, service, runId] = match;
  if (operation === 'seed' && !['auth-service', 'hr-service'].includes(service))
    throw new Error('Unsupported seed operation');
  if (
    String(run.id) !== runId ||
    run.head_sha !== head ||
    run.head_branch !== 'dev' ||
    run.event !== 'push' ||
    run.path !== '.github/workflows/deploy-dev.yml' ||
    run.head_repository?.full_name !== 'Datrix-Tech-Solutions/work-phelo' ||
    !['completed'].includes(run.status) ||
    !['success', 'failure'].includes(run.conclusion)
  ) {
    throw new Error('A completed DEV application build for this exact release is required');
  }
  if (!jobs.some((job) => job.name === 'Quality Gates' && job.conclusion === 'success')) {
    throw new Error('DEV application quality gates must pass before maintenance');
  }
  if (
    !jobs.some(
      (job) =>
        job.name === `Build & Push — ${service}` &&
        job.conclusion === 'success' &&
        job.steps?.some(
          (step) => step.name === `Build and push ${service}` && step.conclusion === 'success',
        ),
    )
  ) {
    throw new Error('Candidate service image has no successful build evidence');
  }
  const review = environment.protection_rules?.find((rule) => rule.type === 'required_reviewers');
  if (
    !review?.reviewers?.length ||
    review.prevent_self_review !== true ||
    environment.can_admins_bypass !== false ||
    environment.deployment_branch_policy?.custom_branch_policies !== true ||
    !policies.some((policy) => policy.type === 'tag' && policy.name === 'dev-maintenance-*') ||
    policies.some((policy) => policy.type !== 'tag' || policy.name !== 'dev-maintenance-*')
  ) {
    throw new Error(
      'Protected dev-maintenance environment requires independent review, no bypass, and maintenance-tag-only policy',
    );
  }
  return {
    operation,
    service,
    runId,
    image: `ghcr.io/datrix-tech-solutions/work-phelo/${service}:${head}`,
  };
}
const api = (path) =>
  JSON.parse(
    execFileSync('gh', ['api', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
  );
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const repository = 'Datrix-Tech-Solutions/work-phelo';
    if (process.env.GITHUB_REPOSITORY !== repository) throw new Error('Unexpected repository');
    const tag = process.env.GITHUB_REF_NAME;
    const id = tag?.match(/-([1-9][0-9]*)$/)?.[1];
    if (!id) throw new Error('Invalid maintenance tag');
    const result = validateRequest({
      tag,
      head: process.env.GITHUB_SHA,
      latestDev: execFileSync('git', ['rev-parse', 'origin/dev'], { encoding: 'utf8' }).trim(),
      run: api(`repos/${repository}/actions/runs/${id}`),
      jobs: JSON.parse(
        execFileSync(
          'gh',
          [
            'api',
            '--paginate',
            '--slurp',
            `repos/${repository}/actions/runs/${id}/jobs?per_page=100`,
          ],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
        ),
      ).flatMap((page) => page.jobs),
      environment: api(`repos/${repository}/environments/dev-maintenance`),
      policies: JSON.parse(
        execFileSync(
          'gh',
          [
            'api',
            '--paginate',
            '--slurp',
            `repos/${repository}/environments/dev-maintenance/deployment-branch-policies?per_page=100`,
          ],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
        ),
      ).flatMap((page) => page.branch_policies),
    });
    appendFileSync(
      process.env.GITHUB_ENV,
      `MAINTENANCE_OPERATION=${result.operation}\nMAINTENANCE_SERVICE=${result.service}\nMAINTENANCE_IMAGE=${result.image}\n`,
    );
    console.log('Reviewed DEV maintenance scope and candidate image verified');
  } catch {
    console.error(
      'DEV maintenance authorization/evidence unavailable or invalid; no remote operations permitted',
    );
    process.exitCode = 1;
  }
}
