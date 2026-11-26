const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const {
  schemas,
  catalog,
  validateHistory,
  validateUrl,
  inspect,
  main,
} = require('./dev-database-check.cjs');
const expected = [{ name: '20260101000000_fixture', checksum: 'a'.repeat(64) }];
const applied = {
  migration_name: expected[0].name,
  checksum: expected[0].checksum,
  finished_at: new Date(),
  rolled_back_at: null,
};

test('no pending migrations accepts existing history without rerunning SQL', () => {
  assert.equal(validateHistory(expected, [applied]), 1);
});
test('pending additive migration blocks before rollout', () => {
  assert.throws(
    () =>
      validateHistory(
        [...expected, { name: '20260201000000_additive', checksum: 'b'.repeat(64) }],
        [applied],
      ),
    /PENDING_MIGRATIONS/,
  );
});
test('missing history, failed migration, checksum drift and unsafe downgrade fail closed', () => {
  assert.throws(() => validateHistory(expected, []), /PENDING_MIGRATIONS/);
  assert.throws(
    () => validateHistory(expected, [{ ...applied, finished_at: null }]),
    /UNRESOLVED_FAILED/,
  );
  assert.throws(
    () => validateHistory(expected, [{ ...applied, checksum: 'b'.repeat(64) }]),
    /CHECKSUM/,
  );
  assert.throws(
    () => validateHistory(expected, [{ ...applied, migration_name: 'unexpected' }]),
    /UNEXPECTED/,
  );
  assert.throws(() => validateHistory(expected, [applied, applied]), /DUPLICATE/);
  assert.throws(() => validateHistory([], []), /EMPTY_MIGRATION/);
});
test('rolled-back attempts remain unchanged but do not count as applied', () => {
  const rolled = { ...applied, finished_at: null, rolled_back_at: new Date() };
  assert.equal(validateHistory(expected, [rolled, applied]), 1);
  assert.throws(() => validateHistory(expected, [rolled]), /PENDING/);
  assert(rolled.rolled_back_at);
});
test('each service requires exactly its own PostgreSQL schema', () => {
  for (const [service, schema] of Object.entries(schemas)) {
    const value = `postgresql://fixture:fixture@127.0.0.1:1/fixture?schema=${schema}`;
    assert.equal(new URL(validateUrl(service, value)).searchParams.get('schema'), schema);
    for (const invalid of [
      value.replace(`schema=${schema}`, 'schema=public'),
      `${value}&schema=${schema}`,
      `${value}&options=unsafe`,
      'not-a-url',
    ]) {
      assert.throws(() => validateUrl(service, invalid));
    }
  }
});
test('catalog hashes exact image SQL bytes and health-only Subscription cannot silently gain migrations', async () => {
  const root = mkdtempSync(join(tmpdir(), 'dev-catalog-'));
  try {
    await main('subscription-service', root);
    const path = join(root, 'prisma/migrations/20260101000000_fixture');
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'migration.sql'), 'SELECT 1;\n');
    assert.deepEqual(catalog(root), [
      {
        name: expected[0].name,
        checksum: createHash('sha256').update('SELECT 1;\n').digest('hex'),
      },
    ]);
    await assert.rejects(main('subscription-service', root), /SUBSCRIPTION_DATABASE_ADOPTION/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('inspection starts read-only, uses bounded timeouts and selects only migration metadata', async () => {
  const statements = [];
  const client = {
    $transaction: async (fn, options) => {
      assert.deepEqual(options, { maxWait: 5000, timeout: 15000 });
      return fn({
        $executeRawUnsafe: async (sql) => {
          statements.push(sql);
        },
        $queryRawUnsafe: async (sql) => {
          statements.push(sql);
          return [applied];
        },
      });
    },
  };
  assert.equal(await inspect(client, 'auth-service', expected), 1);
  assert.equal(statements[0], 'SET TRANSACTION READ ONLY');
  assert.match(statements.at(-1), /FROM "w_auth"\."_prisma_migrations"$/);
  assert(!statements.some((sql) => /INSERT|UPDATE|DELETE|CREATE|ALTER|DROP/.test(sql)));
});
test('routine script gate precedes rollout and maintenance has same host lock but never rolls out', () => {
  const routine = readFileSync(join(__dirname, 'deploy-dev.sh'), 'utf8');
  const maintenance = readFileSync(join(__dirname, 'dev-database-maintenance.sh'), 'utf8');
  assert(routine.indexOf('Read-only Database Compatibility') < routine.indexOf('section "Deploy"'));
  assert(routine.includes('--rm --no-deps'));
  assert(!/migrate deploy|prisma\/seed/.test(routine));
  assert(maintenance.includes('.deploy.dev.lock'));
  assert(maintenance.includes('flock -n 9'));
  assert(maintenance.includes('migrate deploy'));
  assert(
    !/docker_compose up|docker compose up|migrate reset|migrate resolve|db push/.test(maintenance),
  );
});

test('DEV no longer needs seed password; PROD validation retains the original requirement', () => {
  const check = (environment) =>
    execFileSync(
      'bash',
      [
        '-c',
        'source "$1"; required_env_vars_for "$2"',
        'fixture',
        join(__dirname, 'deploy-common.sh'),
        environment,
      ],
      { encoding: 'utf8' },
    ).split('\n');
  assert(!check('dev').includes('SUPER_ADMIN_PASSWORD'));
  assert(check('dev').includes('SUPER_ADMIN_EMAIL'));
  assert(check('prod').includes('SUPER_ADMIN_PASSWORD'));
});

const url = process.env.DEV_DATABASE_CHECK_TEST_URL;
test(
  'disposable PostgreSQL: applied/pending/failed/drift checks preserve history and reject writes',
  { skip: !url },
  async () => {
    const parsed = new URL(url);
    assert(['127.0.0.1', 'localhost'].includes(parsed.hostname));
    assert.equal(parsed.pathname, '/workphelo_dev_check_fixture');
    const { PrismaClient } = require('../../apps/auth-service/prisma/generated/client');
    const client = new PrismaClient({ datasources: { db: { url } }, log: [] });
    try {
      await client.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS w_auth');
      await client.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS w_auth._prisma_migrations (migration_name text, checksum text, finished_at timestamptz, rolled_back_at timestamptz)',
      );
      // Only the explicitly named disposable fixture database is accepted above.
      await client.$executeRawUnsafe('TRUNCATE w_auth._prisma_migrations');
      await client.$executeRawUnsafe(
        'INSERT INTO w_auth._prisma_migrations VALUES ($1,$2,now(),null)',
        applied.migration_name,
        applied.checksum,
      );
      assert.equal(await inspect(client, 'auth-service', expected), 1);
      await assert.rejects(
        inspect(client, 'auth-service', [...expected, { name: 'pending', checksum: 'b' }]),
        /PENDING/,
      );
      await assert.rejects(
        inspect(client, 'auth-service', [{ ...expected[0], checksum: 'drift' }]),
        /CHECKSUM/,
      );
      await client.$executeRawUnsafe(
        'INSERT INTO w_auth._prisma_migrations VALUES ($1,$2,null,null)',
        'failed',
        'b',
      );
      await assert.rejects(inspect(client, 'auth-service', expected), /UNRESOLVED_FAILED/);
      await assert.rejects(
        client.$transaction(async (tx) => {
          await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
          await tx.$executeRawUnsafe('DELETE FROM w_auth._prisma_migrations');
        }),
      );
      assert.equal(
        (await client.$queryRawUnsafe('SELECT * FROM w_auth._prisma_migrations')).length,
        2,
      );
    } finally {
      await client.$disconnect();
    }
  },
);
