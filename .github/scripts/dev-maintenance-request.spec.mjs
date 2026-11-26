import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRequest } from './dev-maintenance-request.mjs';
const sha = 'a'.repeat(40);
const fixture = () => ({
  tag: 'dev-maintenance-migrate-auth-service-123',
  head: sha,
  latestDev: sha,
  run: {
    id: 123,
    head_sha: sha,
    head_branch: 'dev',
    event: 'push',
    path: '.github/workflows/deploy-dev.yml',
    status: 'completed',
    conclusion: 'failure',
    head_repository: { full_name: 'Datrix-Tech-Solutions/work-phelo' },
  },
  jobs: [
    { name: 'Quality Gates', conclusion: 'success' },
    {
      name: 'Build & Push — auth-service',
      conclusion: 'success',
      steps: [{ name: 'Build and push auth-service', conclusion: 'success' }],
    },
  ],
  environment: {
    can_admins_bypass: false,
    protection_rules: [
      {
        type: 'required_reviewers',
        prevent_self_review: true,
        reviewers: [{ type: 'Team', reviewer: { id: 1 } }],
      },
    ],
    deployment_branch_policy: { custom_branch_policies: true },
  },
  policies: [{ name: 'dev-maintenance-*', type: 'tag' }],
});
test('reviewed request accepts built image even when rollout was correctly blocked by pending migrations', () => {
  assert.equal(
    validateRequest(fixture()).image,
    `ghcr.io/datrix-tech-solutions/work-phelo/auth-service:${sha}`,
  );
});
test('missing/weak Environment policy, metadata, wrong release and unbuilt image fail before SSH', () => {
  for (const mutate of [
    (f) => {
      f.environment = {};
    },
    (f) => {
      f.environment.can_admins_bypass = true;
    },
    (f) => {
      f.environment.protection_rules[0].prevent_self_review = false;
    },
    (f) => {
      f.policies = [{ name: '*', type: 'branch' }];
    },
    (f) => {
      f.latestDev = 'b'.repeat(40);
    },
    (f) => {
      f.run.head_sha = 'b'.repeat(40);
    },
    (f) => {
      f.run.event = 'pull_request';
    },
    (f) => {
      f.run.conclusion = 'cancelled';
    },
    (f) => {
      f.jobs[1].steps[0].conclusion = 'skipped';
    },
    (f) => {
      f.jobs[0].conclusion = 'failure';
    },
    (f) => {
      f.tag = 'dev-maintenance-migrate-ai-service-123';
    },
    (f) => {
      f.tag = 'dev-maintenance-seed-marketing-service-123';
    },
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => validateRequest(f));
  }
});
test('Auth and HR seeds are separate explicit operations', () => {
  const f = fixture();
  f.tag = 'dev-maintenance-seed-auth-service-123';
  assert.equal(validateRequest(f).operation, 'seed');
});
test('maintenance shares DEV serialization and validates protection before SCP or SSH', () => {
  const workflow = readFileSync(
    new URL('../workflows/dev-database-maintenance.yml', import.meta.url),
    'utf8',
  );
  assert(workflow.includes('group: deploy-dev-refs/heads/dev'));
  assert(workflow.includes('cancel-in-progress: false'));
  assert(workflow.includes('environment: dev-maintenance'));
  assert(!workflow.includes('pull_request_target'));
  assert(
    workflow.indexOf('node .github/scripts/dev-maintenance-request.mjs') <
      workflow.indexOf('appleboy/scp-action'),
  );
});
