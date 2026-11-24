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
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const source = readFileSync(join(repo, '.github/scripts/deploy-prod.sh'), 'utf8');
const helper = readFileSync(join(repo, '.github/scripts/deploy-common.sh'), 'utf8');
const sha = 'a'.repeat(40);

test('one canonical prod push deploys the merge commit with serialization', () => {
  const workflow = readFileSync(join(repo, '.github/workflows/deploy-prod.yml'), 'utf8');
  const triggers = workflow.slice(workflow.indexOf('\non:'), workflow.indexOf('\n#'));
  assert.match(triggers, /on:\n  push:\n    branches: \[prod\]/);
  assert.equal((triggers.match(/^  [a-z_]+:/gm) ?? []).length, 1);
  assert(!/pull_request_target|workflow_dispatch/.test(workflow));
  assert.match(workflow, /group: deploy-prod\n  cancel-in-progress: false/);
  assert(workflow.includes("if: github.event_name == 'push' && github.ref == 'refs/heads/prod'"));
  assert(workflow.includes('BUILD_SHA: ${{ github.sha }}'));
  assert(!/MIGRATION_PLAN|protection_rules/.test(workflow));
  assert(workflow.includes('DEPLOY_TRIGGER: ${{ github.event_name }}'));
  assert.match(workflow, /envs: .*BUILD_SHA,BUILD_REF,DEPLOY_TRIGGER,/);
  const filters = workflow.slice(
    workflow.indexOf('filters: |'),
    workflow.indexOf('list-files: none'),
  );
  assert(
    !/infrastructure\/|\.github\//.test(filters),
    'infra-only edits must not force unrelated application image rebuilds',
  );
  assert(filters.includes("'packages/**'") && filters.includes("'package*.json'"));
});

for (const [event, ref] of [
  ['pull_request_target', 'prod'],
  ['workflow_dispatch', 'prod'],
  ['push', 'dev'],
  ['', 'prod'],
]) {
  test(`deployment entry rejects event=${event || 'missing'} ref=${ref} before host changes`, () => {
    const result = spawnSync('bash', ['-c', source], {
      env: { PATH: process.env.PATH, DEPLOY_TRIGGER: event, BUILD_REF: ref },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires a push to prod/);
  });
}

test('all eleven production services remain configured', () => {
  const compose = readFileSync(join(repo, 'infrastructure/docker-compose.prod.yml'), 'utf8').split(
    '\nnetworks:',
  )[0];
  const services = [...compose.matchAll(/^  ([a-z0-9-]+):$/gm)].map((match) => match[1]);
  assert.deepEqual(
    services.sort(),
    [
      'redis',
      'auth-service',
      'hr-service',
      'notification-service',
      'reinsurance-service',
      'accounting-service',
      'marketing-service',
      'inventory-service',
      'subscription-service',
      'api-gateway',
      'nextjs',
    ].sort(),
  );
});

for (const failure of ['', 'hr-service']) {
  test(`migration services execute once in order and stop at failure=${failure || 'none'}`, () => {
    const root = mkdtempSync(join(tmpdir(), 'migration-order-'));
    try {
      const trace = join(root, 'trace');
      writeFileSync(trace, '');
      const result = spawnSync(
        'bash',
        [
          '-c',
          helper +
            `
log() { :; }
docker_compose() {
  printf '%s\\n' "$*" >> "$TRACE"
  [[ -z "$FAILURE" || "$*" != *"$FAILURE"* ]]
}
run_production_migrations
`,
        ],
        {
          env: { ...process.env, DEPLOY_PATH: '/fixture', TRACE: trace, FAILURE: failure },
          encoding: 'utf8',
        },
      );
      assert.equal(result.status === 0, !failure);
      const calls = readFileSync(trace, 'utf8').trim().split('\n');
      const order = [
        'auth-service',
        'hr-service',
        'notification-service',
        'reinsurance-service',
        'accounting-service',
        'marketing-service',
        'inventory-service',
      ];
      assert.equal(calls.length, failure ? 2 : 7);
      calls.forEach((call, index) => {
        assert(call.includes('-e MIGRATION_SERVICE=' + order[index]));
        assert(call.includes('--entrypoint node ' + order[index] + ' /production-migrations.mjs'));
        assert(!/MIGRATION_PLAN|--execute|seed|reset|resolve/.test(call));
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

const hasFlock = spawnSync('flock', ['--help'], { stdio: 'ignore' }).status === 0;
test(
  'real host lock prevents overlapping deployments and releases on exit',
  { skip: !hasFlock, timeout: 15000 },
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'production-lock-'));
    const lock = join(root, 'deploy.lock');
    const holder = spawn(
      'bash',
      ['-c', 'exec 9>"$LOCK"; flock -n 9 || exit 1; printf "locked\\n"; read -r release'],
      { env: { ...process.env, LOCK: lock }, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    try {
      await once(holder.stdout, 'data');
      assert.notEqual(spawnSync('flock', ['-n', lock, 'true']).status, 0);
      const exited = once(holder, 'exit');
      holder.stdin.end('release\n');
      await exited;
      assert.equal(spawnSync('flock', ['-n', lock, 'true']).status, 0);
    } finally {
      holder.kill();
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test('production application image selection rejects floating tags', () => {
  const check = (image) =>
    spawnSync('bash', ['-c', helper + '\nvalidate_production_image_refs "$IMAGE"'], {
      env: { ...process.env, IMAGE: image },
      encoding: 'utf8',
    }).status;
  assert.equal(check('fixture/auth:' + sha), 0);
  assert.equal(check('fixture/auth@sha256:' + 'b'.repeat(64)), 0);
  assert.notEqual(check('fixture/auth:prod'), 0);
});

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

test('production HTTP checks accept direct 200 but reject login redirects', () => {
  for (const code of ['200', '307']) {
    const result = spawnSync(
      'bash',
      [
        '-c',
        helper +
          `
require_command() { :; }
curl() { printf '%s' "$CODE"; }
DEPLOY_ENV=prod
http_get_ok http://fixture/health
`,
      ],
      { env: { ...process.env, CODE: code }, encoding: 'utf8' },
    );
    assert.equal(result.status === 0, code === '200');
  }
});

test('production waits for temporary unhealthy recovery within the original bound', () => {
  const result = spawnSync(
    'bash',
    [
      '-c',
      helper +
        `
DEPLOY_ENV=prod
recovered=false
docker_compose() { printf fixture; }
docker() {
  if [[ "$*" == *State.Status* ]]; then printf running;
  elif [[ "$recovered" == true ]]; then printf healthy;
  else printf unhealthy; fi
}
sleep() { recovered=true; }
print_service_diagnostics() { :; }
wait_for_container_health auth-service 10
`,
    ],
    { env: process.env, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /container healthy/);
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
  writeFileSync(join(root, 'bin/flock'), '#!/bin/sh\n[ "$FAILURE" != lock ]\n', { mode: 0o755 });
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
validate_production_image_refs() { :; }
print_compose_failure_diagnostics() { :; }
wait_for_container_health() { :; }
production_service_running() { return 0; }
run_production_migrations() {
  printf 'MIGRATIONS\\n' >> "$TRACE"
  [[ "$FAILURE" != migration ]]
}
docker_compose() {
  printf 'COMPOSE %s\\n' "$*" >> "$TRACE"
  if [[ "$1" == config && "$2" == --hash ]]; then
    if [[ "$COMPOSE_FILE" == *".incoming-"* && "$FAILURE" != unchanged ]]; then
      printf 'accounting-service candidate\\nmarketing-service candidate\\n'
    else
      printf 'accounting-service previous\\nmarketing-service previous\\n'
    fi
    return 0
  fi
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
    DEPLOY_TRIGGER: 'push',
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

for (const failure of ['migration', 'rollout', 'reachability', 'lock']) {
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
        !/migrate (reset|resolve)|db push|seed\.js|--remove-orphans|volume prune/.test(f.trace),
      );
      if (failure === 'migration') assert(!f.trace.includes('COMPOSE up'));
      if (failure !== 'lock') {
        const stage =
          failure === 'migration'
            ? 'MIGRATIONS'
            : failure === 'rollout'
              ? 'ROLLOUT'
              : 'REACHABILITY';
        assert(
          readFileSync(join(f.root, '.deployment-state.prod'), 'utf8').includes(
            'STAGE=FAILED:' + stage,
          ),
        );
      }
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
    assert(f.trace.indexOf('MIGRATIONS') < f.trace.indexOf('COMPOSE up'));
    assert(!/migrate (reset|resolve)|db push|seed\.js|--remove-orphans|volume prune/.test(f.trace));
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

test('unchanged running services are verified without recreation', () => {
  const f = fixture('unchanged');
  try {
    assert.equal(f.result.status, 0, f.result.stderr);
    assert(!f.trace.includes('COMPOSE up'));
    assert(f.trace.includes('HTTP '));
    assert(f.trace.includes('HISTORY'));
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
