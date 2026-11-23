import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  statSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const source = readFileSync(join(repo, '.github/scripts/deploy-prod.sh'), 'utf8');
const helper = readFileSync(join(repo, '.github/scripts/deploy-common.sh'), 'utf8');
const sha = 'a'.repeat(40);

test('schema-specific URLs override an existing schema while preserving other options', () => {
  const base = 'postgresql://fixture:fixture@127.0.0.1:1/fixture?schema=legacy&sslmode=require';
  const result = spawnSync('bash', ['-c', helper + '\ndb_url_for_schema inventory'], {
    env: { ...process.env, DATABASE_URL: base },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const url = new URL(result.stdout);
  assert.deepEqual(url.searchParams.getAll('schema'), ['inventory']);
  assert.equal(url.searchParams.get('sslmode'), 'require');
});

test('explicitly approved production activation is forwarded rather than hard-disabled', () => {
  const flags = Object.fromEntries(
    [
      'ACCOUNTING_RECURRING_JOURNALS_ENABLED',
      'ACCOUNTING_INTERNAL_INTEGRATION_ENABLED',
      'MARKETING_OUTBOUND_COMMUNICATION_ENABLED',
      'MARKETING_AUTOMATIC_PROCESSING_ENABLED',
      'MARKETING_RABBITMQ_CONSUMER_ENABLED',
      'MARKETING_ACCOUNTING_INTEGRATION_ENABLED',
    ].map((name) => [name, 'true']),
  );
  const f = fixture('', flags);
  try {
    assert.equal(f.result.status, 0, f.result.stderr);
    for (const [name] of Object.entries(flags)) {
      const service = name.startsWith('ACCOUNTING_') ? 'accounting-service' : 'marketing-service';
      assert(
        readFileSync(join(f.root, 'apps', service, '.env.prod'), 'utf8').includes(name + '=true'),
      );
    }
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test('staged production deployments resolve rollback history from the canonical directory', () => {
  const result = spawnSync('bash', ['-c', helper + '\ndeploy_image_history_file_for_env prod'], {
    env: {
      ...process.env,
      DEPLOY_ENV: 'prod',
      DEPLOY_PATH: '/fixture/.incoming-sha',
      LIVE_DEPLOY_PATH: '/fixture',
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '/fixture/.deploy-image-history.prod');
});

function fixture(failure = '', activation = {}) {
  const root = mkdtempSync(join(tmpdir(), 'workphelo-rollout-test-'));
  const candidate = join(root, `.incoming-${sha}`);
  for (const path of [
    '.github/scripts',
    'infrastructure',
    'bin',
    `.incoming-${sha}/.github/scripts`,
    `.incoming-${sha}/infrastructure`,
  ])
    mkdirSync(join(root, path), { recursive: true });
  writeFileSync(join(root, '.compose.prod.env'), 'AUTH_SERVICE_IMAGE=fixture/auth:previous\n');
  writeFileSync(join(root, 'infrastructure/docker-compose.prod.yml'), 'previous-compose\n');
  writeFileSync(join(root, 'bin/docker'), '#!/bin/sh\ncat >/dev/null\nexit 0\n', { mode: 0o755 });
  writeFileSync(join(candidate, 'infrastructure/docker-compose.prod.yml'), 'candidate-compose\n');
  writeFileSync(
    join(candidate, '.github/scripts/deploy-common.sh'),
    helper +
      `
validate_required_envs() { :; }
warn_optional_envs() { :; }
validate_compose_render() { :; }
ensure_image_available() { :; }
preflight_runtime_env() { :; }
print_compose_failure_diagnostics() { :; }
wait_for_container_health() { :; }
docker_compose() {
  printf 'COMPOSE %s\\n' "$*" >> "$TRACE"
  if [[ "$*" == *"accounting-service"* && "$*" == *"migrate status"* && "$FAILURE" == migration ]]; then return 1; fi
  if [[ "$1" == up && "$FAILURE" == rollout ]]; then return 1; fi
}
wait_for_http_ok() {
  printf 'HTTP %s\\n' "$1" >> "$TRACE"
  [[ "$FAILURE" != reachability ]]
}
record_successful_deploy_images() { printf 'HISTORY\\n' >> "$TRACE"; }
post_deploy_capacity_maintenance() { :; }
`,
  );
  const script = join(root, 'deploy.sh');
  writeFileSync(
    script,
    source.replace(
      'LIVE_DEPLOY_PATH="/var/www/apps/workphelo.com/work-phelo"',
      `LIVE_DEPLOY_PATH="${root}"`,
    ),
  );
  const env = { PATH: join(root, 'bin') + ':' + process.env.PATH, HOME: root };
  for (const [, key] of source.matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g)) env[key] = 'synthetic';
  Object.assign(env, {
    BUILD_SHA: sha,
    BUILD_REF: 'prod',
    IMAGE_PREFIX: 'fixture',
    GHCR_TOKEN: 'synthetic-only',
    GHCR_USERNAME: 'fixture',
    DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/fixture',
    CHANGED_SERVICES: '["accounting-service","marketing-service"]',
    FAILURE: failure,
    TRACE: join(root, 'trace'),
    ...activation,
  });
  writeFileSync(env.TRACE, '');
  const result = spawnSync('bash', [script], { cwd: root, env, encoding: 'utf8' });
  return { root, candidate, result, trace: readFileSync(join(root, 'trace'), 'utf8') };
}

for (const failure of ['migration', 'rollout', 'reachability']) {
  test(`${failure} failure preserves canonical config and never records successful history`, () => {
    const f = fixture(failure);
    try {
      assert.notEqual(f.result.status, 0, f.result.stderr);
      assert.equal(
        readFileSync(join(f.root, '.compose.prod.env'), 'utf8'),
        'AUTH_SERVICE_IMAGE=fixture/auth:previous\n',
      );
      assert.equal(
        readFileSync(join(f.root, 'infrastructure/docker-compose.prod.yml'), 'utf8'),
        'previous-compose\n',
      );
      assert(!f.trace.includes('HISTORY'));
      assert(
        !/migrate (deploy|reset|resolve)|db push|seed\.js|--remove-orphans|volume prune/.test(
          f.trace,
        ),
      );
      if (failure === 'migration') assert(!f.trace.includes('COMPOSE up'));
    } finally {
      rmSync(f.root, { recursive: true, force: true });
    }
  });
}

test('successful rollout preserves old image refs, defaults business flags off and publishes only after reachability', () => {
  const f = fixture();
  try {
    assert.equal(f.result.status, 0, f.result.stderr + f.result.stdout);
    const backup = readdirSync(f.root).find((name) => name.startsWith('.rollback-config-'));
    assert(backup);
    assert.equal(
      readFileSync(join(f.root, backup, '.compose.prod.env'), 'utf8'),
      'AUTH_SERVICE_IMAGE=fixture/auth:previous\n',
    );
    assert(f.trace.indexOf('HISTORY') > f.trace.lastIndexOf('HTTP '));
    assert(
      !/migrate (deploy|reset|resolve)|db push|seed\.js|--remove-orphans|volume prune/.test(
        f.trace,
      ),
    );
    const accounting = readFileSync(join(f.root, 'apps/accounting-service/.env.prod'), 'utf8');
    const marketing = readFileSync(join(f.root, 'apps/marketing-service/.env.prod'), 'utf8');
    for (const flag of [
      'ACCOUNTING_RECURRING_JOURNALS_ENABLED',
      'ACCOUNTING_INTERNAL_INTEGRATION_ENABLED',
    ])
      assert(accounting.includes(flag + '=false'));
    for (const flag of [
      'MARKETING_OUTBOUND_COMMUNICATION_ENABLED',
      'MARKETING_AUTOMATIC_PROCESSING_ENABLED',
      'MARKETING_RABBITMQ_CONSUMER_ENABLED',
      'MARKETING_ACCOUNTING_INTEGRATION_ENABLED',
    ])
      assert(marketing.includes(flag + '=false'));
    assert(marketing.includes('SMS_SENDER_READINESS_MODE=strict'));
    const hr = readFileSync(join(f.root, 'apps/hr-service/.env.prod'), 'utf8');
    assert(hr.includes('INTERNAL_SERVICE_AUTH_SECRET='));
    assert(hr.includes('INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES='));
    const inventory = readFileSync(join(f.root, 'apps/inventory-service/.env.prod'), 'utf8');
    assert(inventory.includes('INVENTORY_SERVICE_PORT=4009'));
    assert(inventory.includes('ACCOUNTING_SERVICE_URL='));
    assert.equal(statSync(join(f.root, 'apps/marketing-service/.env.prod')).mode & 0o777, 0o600);
    assert(
      readFileSync(join(f.root, '.compose.prod.env'), 'utf8').includes(
        'AUTH_SERVICE_IMAGE=fixture/auth:previous',
      ),
    );
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
