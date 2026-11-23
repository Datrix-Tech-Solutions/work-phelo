import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  executeMigration,
  validateHistory,
  validatePlan,
  readApprovedPlan,
} from './production-migrations.mjs';

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sha = 'a'.repeat(40),
  scope = 'b'.repeat(64),
  checksum = 'c'.repeat(64);
const files = [{ name: '20261124000000_fixture', checksum, reviewRequired: false }];
const objects = [{ kind: 'table', name: 'fixture', definition: { column: 'id' } }];
const completed = {
  migration_name: files[0].name,
  checksum,
  finished_at: new Date(),
  rolled_back_at: null,
};
function fixture({ applied = false, extraHistory = [], lock = true } = {}) {
  let migrated = applied,
    calls = 0,
    statuses = 0;
  const client = {
    $transaction: async (action) => action(client),
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('pg_try_advisory')) return [{ locked: lock }];
      if (sql.includes('current_schema()'))
        return [
          {
            current_schema: 'inventory',
            major: 16,
            history_exists: migrated || extraHistory.length > 0,
          },
        ];
      if (sql.startsWith('SELECT migration_name'))
        return [...extraHistory, ...(migrated ? [completed] : [])];
      return migrated ? objects : [];
    },
  };
  const plan = {
    version: 1,
    releaseSha: sha,
    approvalRef: 'review-1',
    expiresAt: '2099-01-01',
    backup: {
      reference: 'backup-1',
      verificationRef: 'verification-1',
      restoreTestRef: 'restore-1',
      releaseSha: sha,
      verifiedAt: '2026-01-01',
      validUntil: '2099-01-01',
      serviceScopes: [scope],
    },
    services: {
      'inventory-service': {
        schema: 'inventory',
        postgresMajor: 16,
        databaseScopeHash: scope,
        snapshotEvidenceRef: 'trusted-prefix-replay-1',
        fromMigrations: [],
        targetMigrations: files.map(({ name, checksum }) => ({ name, checksum })),
        beforeDigest: digest([]),
        afterDigest: digest(objects),
        backwardCompatible: true,
        compatibilityEvidenceRef: 'old-binary-smoke-1',
      },
    },
  };
  const run = () =>
    executeMigration({
      client,
      files,
      plan,
      service: 'inventory-service',
      releaseSha: sha,
      databaseScopeHash: scope,
      execute: async () => {
        calls++;
        migrated = true;
      },
      status: async () => {
        statuses++;
      },
    });
  return { client, plan, run, calls: () => calls, statuses: () => statuses };
}

test('fresh install applies the approved pending sequence and verifies final status', async () => {
  const f = fixture();
  assert.equal((await f.run()).pendingApplied, 1);
  assert.equal(f.calls(), 1);
  assert.equal(f.statuses(), 1);
});
test('existing complete history is no-op, without rerunning completed migrations', async () => {
  const f = fixture({ applied: true });
  assert.equal((await f.run()).pendingApplied, 0);
  assert.equal(f.calls(), 0);
});
test('zero pending reuses a trusted baseline without fresh release approval or backup', async () => {
  const f = fixture({ applied: true });
  f.plan.releaseSha = 'd'.repeat(40);
  f.plan.expiresAt = '2020-01-01';
  delete f.plan.backup;
  delete f.plan.services['inventory-service'].compatibilityEvidenceRef;
  delete f.plan.services['inventory-service'].destructiveApprovalRef;
  assert.equal((await f.run()).pendingApplied, 0);
  assert.equal(f.calls(), 0);
  assert.equal(f.statuses(), 1);
});
test('known rolled-back attempt is retained and does not invent successful history', async () => {
  const attempt = { ...completed, finished_at: null, rolled_back_at: new Date() };
  const f = fixture({ applied: true, extraHistory: [attempt] });
  assert.equal((await f.run()).rolledBackAttemptsPreserved, 1);
  assert.equal(f.calls(), 0);
});
for (const [name, row, error] of [
  ['failed', { ...completed, finished_at: null }, 'FAILED_OR_RUNNING'],
  ['checksum mismatch', { ...completed, checksum: 'd'.repeat(64) }, 'CHECKSUM'],
  ['unknown', { ...completed, migration_name: 'unknown' }, 'UNKNOWN_MIGRATION'],
])
  test(`${name} history fails closed before execution`, async () => {
    const f = fixture({ extraHistory: [row] });
    await assert.rejects(f.run, new RegExp(error));
    assert.equal(f.calls(), 0);
  });
test('duplicate success records are rejected', () =>
  assert.throws(() => validateHistory(files, [completed, completed]), /DUPLICATE/));
test('competing database migration lock fails before inspection or execution', async () => {
  const f = fixture({ lock: false });
  await assert.rejects(f.run, /LOCK_BUSY/);
  assert.equal(f.calls(), 0);
});
test('missing backup and restore confirmation blocks schema changes', async () => {
  const f = fixture();
  delete f.plan.backup.restoreTestRef;
  await assert.rejects(f.run, /VERIFIED_BACKUP/);
  assert.equal(f.calls(), 0);
});
test('expired approval blocks pending migrations', async () => {
  const f = fixture();
  f.plan.expiresAt = '2020-01-01';
  await assert.rejects(f.run, /PLAN_EXPIRED/);
  assert.equal(f.calls(), 0);
});
test('database-scope mismatch blocks even an otherwise valid plan', async () => {
  const f = fixture();
  f.plan.services['inventory-service'].databaseScopeHash = 'e'.repeat(64);
  await assert.rejects(f.run, /SCOPE_MISMATCH/);
});
test('unexpected catalog drift blocks a no-pending deployment', async () => {
  const f = fixture({ applied: true });
  f.plan.services['inventory-service'].afterDigest = digest([]);
  await assert.rejects(f.run, /SCHEMA_DRIFT/);
  assert.equal(f.calls(), 0);
});
test('breaking migrations require maintenance rather than unsafe old-binary rollback', async () => {
  const f = fixture();
  f.plan.services['inventory-service'].backwardCompatible = false;
  await assert.rejects(f.run, /MAINTENANCE_MIGRATION_REQUIRED/);
});
test('compatibility evidence is mandatory for a pending migration', async () => {
  const f = fixture();
  delete f.plan.services['inventory-service'].compatibilityEvidenceRef;
  await assert.rejects(f.run, /MAINTENANCE_MIGRATION_REQUIRED/);
  assert.equal(f.calls(), 0);
});
test('native migration failure does not run status or claim success', async () => {
  const f = fixture();
  await assert.rejects(
    () =>
      executeMigration({
        client: f.client,
        files,
        plan: f.plan,
        service: 'inventory-service',
        releaseSha: sha,
        databaseScopeHash: scope,
        execute: async () => {
          throw new Error('native failure');
        },
        status: async () => assert.fail('must not report status after failure'),
      }),
    /native failure/,
  );
});
test('missing successful history after execution fails post-migration verification', async () => {
  const f = fixture();
  await assert.rejects(
    () =>
      executeMigration({
        client: f.client,
        files,
        plan: f.plan,
        service: 'inventory-service',
        releaseSha: sha,
        databaseScopeHash: scope,
        execute: async () => {},
        status: async () => assert.fail('must not report success with incomplete history'),
      }),
    /POST_MIGRATION_VERIFICATION_FAILED/,
  );
});
test('destructive classification needs explicit review even with compatibility approval', () => {
  const f = fixture();
  assert.throws(
    () =>
      validatePlan({
        plan: f.plan,
        service: 'inventory-service',
        files: [{ ...files[0], reviewRequired: true }],
        state: { major: 16, digest: digest([]) },
        pending: [{ ...files[0], reviewRequired: true }],
        releaseSha: sha,
        databaseScopeHash: scope,
      }),
    /DESTRUCTIVE_APPROVAL/,
  );
});
test('plan file bytes must match the approved digest; absence never falls back to migrate deploy', () => {
  assert.throws(() => readApprovedPlan(undefined, undefined), /APPROVED_PLAN/);
  const directory = mkdtempSync(join(tmpdir(), 'migration-plan-test-'));
  try {
    const file = join(directory, 'plan.json');
    const plan = fixture().plan;
    writeFileSync(file, JSON.stringify(plan));
    assert.deepEqual(readApprovedPlan(file, digest(plan)), plan);
    assert.throws(() => readApprovedPlan(file, '0'.repeat(64)), /DIGEST_MISMATCH/);
    const invalid = { ...plan, version: 2 };
    writeFileSync(file, JSON.stringify(invalid));
    assert.throws(() => readApprovedPlan(file, digest(invalid)), /INVALID_APPROVED_PLAN/);
    writeFileSync(file, '{');
    assert.throws(
      () => readApprovedPlan(file, createHash('sha256').update('{').digest('hex')),
      SyntaxError,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
