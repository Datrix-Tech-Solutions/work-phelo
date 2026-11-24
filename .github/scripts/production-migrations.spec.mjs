import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runMigration, serviceSchemas } from './production-migrations.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const expected = {
  'auth-service': 'w_auth',
  'hr-service': 'hr',
  'notification-service': 'notify',
  'reinsurance-service': 'reinsurance',
  'accounting-service': 'accounting',
  'marketing-service': 'marketing',
  'inventory-service': 'inventory',
};
assert.deepEqual(serviceSchemas, expected);
for (const [service, schema] of Object.entries(expected)) {
  test(`${service} runs native migrate deploy using its exact schema URL`, () => {
    let called = 0;
    const env = {
      DATABASE_URL: `postgresql://fixture:fixture@127.0.0.1:1/fixture?schema=${schema}`,
    };
    const result = runMigration({
      service,
      env,
      cwd: root + 'apps/' + service,
      spawn: (binary, args, options) => {
        called++;
        assert.equal(binary, process.execPath);
        assert.deepEqual(args.slice(1), [
          'migrate',
          'deploy',
          '--schema',
          root + 'apps/' + service + '/prisma/schema.prisma',
        ]);
        assert.equal(options.env.DATABASE_URL, env.DATABASE_URL);
        assert.equal(options.timeout, 300000);
        assert.equal(options.stdio, 'pipe');
        return { status: 0, stdout: 'No pending migrations', stderr: '' };
      },
    });
    assert.equal(called, 1);
    assert.equal(result.status, 'migration-deploy-complete');
  });
}
for (const url of [
  'not-a-url',
  'postgresql://fixture:fixture@localhost/fixture',
  'postgresql://fixture:fixture@localhost/fixture?schema=public',
  'postgresql://fixture:fixture@localhost/fixture?schema=inventory&schema=inventory',
]) {
  test('invalid/mismatched/ambiguous database URL stops before Prisma', () =>
    assert.throws(
      () =>
        runMigration({
          service: 'inventory-service',
          env: { DATABASE_URL: url },
          spawn: () => assert.fail('must not execute'),
        }),
      /INVALID_DATABASE_URL|INCORRECT_DATABASE_SCHEMA_URL/,
    ));
}
test('unknown services cannot run migrations', () =>
  assert.throws(() => runMigration({ service: 'subscription-service' }), /UNKNOWN_SERVICE/));
test('obsolete inspection/approval flags fail closed instead of executing migrations', () => {
  for (const flag of ['--manifest', '--inspect', '--execute']) {
    const result = spawnSync(
      process.execPath,
      [root + '.github/scripts/production-migrations.mjs', flag],
      { env: { MIGRATION_SERVICE: 'inventory-service' }, encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /UNSUPPORTED_ARGUMENTS/);
  }
});
test('native failure is fatal without exposing captured credentials or retrying', () => {
  let calls = 0;
  assert.throws(
    () =>
      runMigration({
        service: 'inventory-service',
        cwd: root + 'apps/inventory-service',
        env: { DATABASE_URL: 'postgresql://fixture:fixture@localhost/fixture?schema=inventory' },
        spawn: () => {
          calls++;
          return { status: 1, stderr: 'Error: P3009 credential-canary', stdout: '' };
        },
      }),
    (error) => error.code === 'P3009' && !error.message.includes('credential-canary'),
  );
  assert.equal(calls, 1);
});
test('timeouts stop rather than reset, resolve or retry the database', () =>
  assert.throws(
    () =>
      runMigration({
        service: 'inventory-service',
        cwd: root + 'apps/inventory-service',
        env: { DATABASE_URL: 'postgresql://fixture:fixture@localhost/fixture?schema=inventory' },
        spawn: () => ({ status: null, error: { code: 'ETIMEDOUT' } }),
      }),
    /MIGRATION_TIMEOUT/,
  ));
