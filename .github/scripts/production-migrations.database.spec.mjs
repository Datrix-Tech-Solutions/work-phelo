import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  migrationFiles,
  readSchemaState,
  executeMigration,
  databaseScope,
  serviceSchemas,
} from './production-migrations.mjs';

const configured = process.env.MIGRATION_TEST_DATABASE_URL;
test(
  'approved additive pending DDL uses native Prisma and preserves existing rows',
  { skip: !configured, timeout: 60000 },
  async () => {
    const base = new URL(configured);
    assert(['127.0.0.1', 'localhost'].includes(base.hostname));
    assert.equal(base.pathname, '/resilience_fixture');
    assert.equal(base.username, 'fixture');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const require = createRequire(resolve(root, 'apps/inventory-service/package.json'));
    const { PrismaClient } = require(
      resolve(root, 'apps/inventory-service/prisma/generated/client'),
    );
    const prisma = require.resolve('prisma/build/index.js');
    const directory = mkdtempSync(resolve(tmpdir(), 'resilience-additive-'));
    const client = (url) => new PrismaClient({ datasources: { db: { url: url.toString() } } });
    const admin = client(base),
      clients = [];
    try {
      const schemaFile = resolve(directory, 'schema.prisma');
      writeFileSync(
        schemaFile,
        `generator client {
  provider = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}
datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL")
  schemas = ["inventory"]
}
model Fixture {
  id String @id
  value String
  note String?
  @@schema("inventory")
}
`,
      );
      const migration = (name, sql) => {
        const folder = resolve(directory, 'migrations', name);
        mkdirSync(folder, { recursive: true });
        writeFileSync(resolve(folder, 'migration.sql'), sql);
      };
      const command = (url, action) => {
        const result = spawnSync(
          process.execPath,
          [prisma, 'migrate', action, '--schema', schemaFile],
          {
            cwd: directory,
            env: { ...process.env, DATABASE_URL: url.toString() },
            encoding: 'utf8',
            timeout: 20000,
          },
        );
        assert.equal(result.status, 0, `Synthetic additive fixture ${action} failed`);
      };
      const urls = [];
      for (const purpose of ['actual', 'reference']) {
        const name = `resilience_additive_${purpose}_${randomUUID().replaceAll('-', '')}`;
        await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
        const url = new URL(base);
        url.pathname = '/' + name;
        url.searchParams.set('schema', 'inventory');
        urls.push(url);
      }
      const [actualUrl, referenceUrl] = urls;
      const actual = client(actualUrl),
        reference = client(referenceUrl);
      clients.push(actual, reference);
      migration(
        '20260101000000_initial',
        'CREATE SCHEMA IF NOT EXISTS inventory; CREATE TABLE inventory."Fixture" (id TEXT PRIMARY KEY,value TEXT NOT NULL);',
      );
      command(actualUrl, 'deploy');
      await actual.$executeRawUnsafe(
        `INSERT INTO inventory."Fixture" (id,value) VALUES ('preserved','existing')`,
      );
      const before = await readSchemaState(actual, 'inventory');
      const from = migrationFiles(resolve(directory, 'migrations'));
      migration('20260102000000_add_note', 'ALTER TABLE inventory."Fixture" ADD COLUMN note TEXT;');
      command(referenceUrl, 'deploy');
      const after = await readSchemaState(reference, 'inventory');
      const files = migrationFiles(resolve(directory, 'migrations'));
      const sha = 'a'.repeat(40),
        scope = databaseScope(actualUrl, 'inventory');
      const plan = {
        version: 1,
        approvalRef: 'synthetic-reviewed-addition',
        releaseSha: sha,
        expiresAt: '2099-01-01',
        backup: {
          reference: 'fixture-backup',
          verificationRef: 'fixture-verification',
          restoreTestRef: 'fixture-restore',
          releaseSha: sha,
          serviceScopes: [scope],
          verifiedAt: '2026-01-01',
          validUntil: '2099-01-01',
        },
        services: {
          'inventory-service': {
            schema: 'inventory',
            postgresMajor: before.major,
            databaseScopeHash: scope,
            snapshotEvidenceRef: 'independent-fixture-replay',
            compatibilityEvidenceRef: 'additive-nullable-column',
            fromMigrations: from.map(({ name, checksum }) => ({ name, checksum })),
            targetMigrations: files.map(({ name, checksum }) => ({ name, checksum })),
            beforeDigest: before.digest,
            afterDigest: after.digest,
            backwardCompatible: true,
          },
        },
      };
      const result = await executeMigration({
        client: actual,
        files,
        plan,
        service: 'inventory-service',
        releaseSha: sha,
        databaseScopeHash: scope,
        execute: () => command(actualUrl, 'deploy'),
        status: () => command(actualUrl, 'status'),
      });
      assert.equal(result.pendingApplied, 1);
      assert.deepEqual(
        await actual.$queryRawUnsafe('SELECT id,value,note FROM inventory."Fixture"'),
        [{ id: 'preserved', value: 'existing', note: null }],
      );
    } finally {
      for (const db of clients) await db.$disconnect();
      await admin.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
test(
  'PostgreSQL migration safety with actual immutable Inventory migrations',
  { skip: !configured, timeout: 90000 },
  async (t) => {
    const base = new URL(configured);
    assert(['127.0.0.1', 'localhost'].includes(base.hostname));
    assert.equal(base.pathname, '/resilience_fixture');
    assert.equal(base.username, 'fixture');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const app = resolve(root, 'apps/inventory-service');
    const require = createRequire(resolve(app, 'package.json'));
    const { PrismaClient } = require(resolve(app, 'prisma/generated/client'));
    const prisma = require.resolve('prisma/build/index.js');
    const client = (url) => new PrismaClient({ datasources: { db: { url } } });
    const admin = client(base.toString());
    const clients = [];
    try {
      const urls = [];
      for (const purpose of ['reference', 'actual']) {
        const name = `resilience_${purpose}_${randomUUID().replaceAll('-', '')}`;
        await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
        const url = new URL(base);
        url.pathname = '/' + name;
        url.searchParams.set('schema', 'inventory');
        url.searchParams.set('connection_limit', '3');
        urls.push(url.toString());
      }
      const [referenceUrl, actualUrl] = urls;
      const reference = client(referenceUrl),
        actual = client(actualUrl),
        rival = client(actualUrl);
      clients.push(reference, actual, rival);
      const command = (url, action) => {
        const result = spawnSync(
          process.execPath,
          [prisma, 'migrate', action, '--schema', resolve(app, 'prisma/schema.prisma')],
          {
            cwd: app,
            env: { ...process.env, DATABASE_URL: url },
            encoding: 'utf8',
            timeout: 30000,
          },
        );
        assert.equal(
          result.status,
          0,
          `Fixture Prisma ${action} failed (output intentionally suppressed)`,
        );
      };
      // Reference proof is replayed from trusted immutable SQL, not learned from the target database.
      command(referenceUrl, 'deploy');
      const after = await readSchemaState(reference, 'inventory');
      const before = await readSchemaState(actual, 'inventory');
      const files = migrationFiles(resolve(app, 'prisma/migrations'));
      const scope = databaseScope(actualUrl, 'inventory'),
        sha = 'a'.repeat(40);
      const plan = {
        version: 1,
        approvalRef: 'fixture-only-review',
        releaseSha: sha,
        expiresAt: '2099-01-01',
        backup: {
          reference: 'fixture-only-backup',
          verificationRef: 'fixture-verification',
          restoreTestRef: 'fixture-restore',
          releaseSha: sha,
          serviceScopes: [scope],
          verifiedAt: '2026-01-01',
          validUntil: '2099-01-01',
        },
        services: {
          'inventory-service': {
            schema: 'inventory',
            postgresMajor: after.major,
            databaseScopeHash: scope,
            snapshotEvidenceRef: 'fixture-trusted-migration-replay',
            fromMigrations: [],
            targetMigrations: files.map(({ name, checksum }) => ({ name, checksum })),
            beforeDigest: before.digest,
            afterDigest: after.digest,
            backwardCompatible: true,
            compatibilityEvidenceRef: 'disposable-inventory-replay',
            destructiveApprovalRef: 'fresh-fixture-review',
          },
        },
      };
      let executions = 0;
      const run = (db = actual) =>
        executeMigration({
          client: db,
          files,
          plan,
          service: 'inventory-service',
          releaseSha: sha,
          databaseScopeHash: scope,
          execute: () => {
            executions++;
            command(actualUrl, 'deploy');
          },
          status: () => command(actualUrl, 'status'),
        });
      await t.test(
        'fresh schema executes original unqualified SQL using the explicit Inventory search path',
        async () => {
          assert.equal((await run()).pendingApplied, files.length);
          assert.equal((await readSchemaState(actual, 'inventory')).digest, after.digest);
        },
      );
      await t.test('existing complete history is verified without rerunning DDL', async () => {
        assert.equal((await run()).pendingApplied, 0);
        assert.equal(executions, 1);
      });
      await t.test(
        'historical rolled-back attempt remains in place and native Prisma status succeeds',
        async () => {
          const file = files.find((f) => f.name === '20261110020000_add_item_max_stock');
          assert(file);
          await actual.$executeRawUnsafe(
            `INSERT INTO inventory._prisma_migrations
        (id,checksum,migration_name,started_at,rolled_back_at,applied_steps_count)
        VALUES ($1,$2,$3,now(),now(),0)`,
            randomUUID(),
            file.checksum,
            file.name,
          );
          assert.equal((await run()).rolledBackAttemptsPreserved, 1);
          const [{ count }] = await actual.$queryRawUnsafe(
            'SELECT count(*)::int AS count FROM inventory._prisma_migrations',
          );
          assert.equal(count, files.length + 1);
        },
      );
      await t.test('competing workers cannot enter migration execution', async () => {
        await actual.$transaction(async (lock) => {
          const [held] = await lock.$queryRawUnsafe(
            "SELECT pg_try_advisory_xact_lock(hashtext('workphelo-production-schema-migrations')) AS locked",
          );
          assert.equal(held.locked, true);
          await assert.rejects(run(rival), /MIGRATION_LOCK_BUSY/);
        });
        assert.equal(executions, 1);
      });
      await t.test('extra target column is drift, not silently accepted or repaired', async () => {
        await actual.$executeRawUnsafe(
          'ALTER TABLE inventory."InventoryItem" ADD COLUMN "fixture_drift" TEXT',
        );
        await assert.rejects(run(), /SCHEMA_DRIFT/);
        assert.equal(executions, 1);
      });
    } finally {
      for (const db of clients) await db.$disconnect();
      await admin.$disconnect();
      // Entire dedicated disposable container is removed by the caller; no shared schema is reset.
    }
  },
);

test(
  'all seven service histories and existing fixture data survive zero-pending verification',
  { skip: !configured, timeout: 240000 },
  async (t) => {
    const base = new URL(configured);
    assert(['127.0.0.1', 'localhost'].includes(base.hostname));
    assert.equal(base.pathname, '/resilience_fixture');
    assert.equal(base.username, 'fixture');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const require = createRequire(resolve(root, 'apps/inventory-service/package.json'));
    const { PrismaClient } = require(
      resolve(root, 'apps/inventory-service/prisma/generated/client'),
    );
    const prisma = require.resolve('prisma/build/index.js');
    const admin = new PrismaClient({ datasources: { db: { url: base.toString() } } });
    const clients = [];
    try {
      const name = `resilience_seven_${randomUUID().replaceAll('-', '')}`;
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      base.pathname = '/' + name;
      const histories = new Map();
      for (const [service, schema] of Object.entries(serviceSchemas)) {
        const url = new URL(base);
        url.searchParams.set('schema', schema);
        const app = resolve(root, 'apps', service);
        const command = (action) => {
          const result = spawnSync(
            process.execPath,
            [prisma, 'migrate', action, '--schema', resolve(app, 'prisma/schema.prisma')],
            {
              cwd: app,
              env: { ...process.env, DATABASE_URL: url.toString() },
              encoding: 'utf8',
              timeout: 60000,
            },
          );
          assert.equal(
            result.status,
            0,
            `${service} fixture migrate ${action} failed; code=${result.stderr?.match(/P\d{4}/)?.[0] ?? 'UNKNOWN'}`,
          );
        };
        command('deploy');
        const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
        clients.push(db);
        const state = await readSchemaState(db, schema);
        const files = migrationFiles(resolve(app, 'prisma/migrations'));
        assert.equal(state.history.length, files.length);
        const entry = {
          schema,
          postgresMajor: state.major,
          databaseScopeHash: databaseScope(url, schema),
          snapshotEvidenceRef: 'fixture-prefix-replay',
          targetMigrations: files.map(({ name, checksum }) => ({ name, checksum })),
          beforeDigest: state.digest,
          afterDigest: state.digest,
        };
        const plan = {
          version: 1,
          approvalRef: 'existing-baseline',
          services: { [service]: entry },
        };
        const historySql = `SELECT id,checksum,migration_name,started_at,finished_at,rolled_back_at,applied_steps_count FROM "${schema}"._prisma_migrations ORDER BY id`;
        histories.set(schema, { db, sql: historySql, rows: await db.$queryRawUnsafe(historySql) });
        if (schema === 'inventory') {
          await db.$executeRawUnsafe(
            `INSERT INTO inventory."InventoryCategory" (id,"tenantId",name,"updatedAt") VALUES ('fixture-record','fixture-tenant','Preserve me',now())`,
          );
        }
        const result = await executeMigration({
          client: db,
          files,
          plan,
          service,
          releaseSha: 'f'.repeat(40),
          databaseScopeHash: entry.databaseScopeHash,
          execute: () => assert.fail('No completed DDL may be rerun'),
          status: () => command('status'),
        });
        assert.equal(result.pendingApplied, 0);
      }
      for (const [schema, { db, sql, rows }] of histories) {
        assert.deepEqual(
          await db.$queryRawUnsafe(sql),
          rows,
          `${schema} migration history changed`,
        );
      }
      const inventory = histories.get('inventory').db;
      assert.deepEqual(
        await inventory.$queryRawUnsafe(
          `SELECT id,name FROM inventory."InventoryCategory" WHERE id='fixture-record'`,
        ),
        [{ id: 'fixture-record', name: 'Preserve me' }],
      );

      // Exercise the built operator command against synthetic Auth tenants only.
      const authRequire = createRequire(resolve(root, 'apps/auth-service/package.json'));
      const { PrismaClient: AuthClient } = authRequire(
        resolve(root, 'apps/auth-service/prisma/generated/client'),
      );
      const { SystemPermissionBackfillService } = authRequire(
        resolve(root, 'apps/auth-service/dist/permissions/system-permission-backfill.service'),
      );
      const { ensurePermissionResources, seedDefaultPermissionTemplates } = authRequire(
        resolve(root, 'apps/auth-service/dist/permissions/system-permission-sets'),
      );
      const authUrl = new URL(base);
      authUrl.searchParams.set('schema', 'w_auth');
      const auth = new AuthClient({ datasources: { db: { url: authUrl.toString() } } });
      clients.push(auth);
      const resources = await ensurePermissionResources(auth);
      const quiet = { log() {}, warn() {} };
      for (const suffix of ['a', 'b']) {
        await auth.tenant.create({
          data: {
            id: 'fixture-' + suffix,
            name: 'Fixture ' + suffix,
            slug: 'fixture-' + suffix,
            email: suffix + '@example.invalid',
          },
        });
      }
      await auth.$transaction(async (tx) => {
        const sets = await seedDefaultPermissionTemplates(tx, 'fixture-a', quiet, resources);
        const user = await tx.user.create({
          data: {
            id: 'fixture-user',
            tenantId: 'fixture-a',
            email: 'employee@example.invalid',
            firstName: 'Fixture',
            lastName: 'Employee',
          },
        });
        await tx.userPermissionSet.create({
          data: { userId: user.id, permissionSetId: sets.Employee, grantedBy: 'fixture' },
        });
      });
      const reconcile = new SystemPermissionBackfillService(auth);
      await t.test(
        'real reconciliation is repeatable, tenant-scoped and preserves Employee membership',
        async () => {
          assert.equal(
            (await reconcile.run({ execute: true, tenantId: 'fixture-a' })).completed,
            1,
          );
          const before = await auth.permissionSetResource.findMany({ orderBy: { id: 'asc' } });
          await reconcile.run({ execute: true, tenantId: 'fixture-a' });
          assert.deepEqual(
            await auth.permissionSetResource.findMany({ orderBy: { id: 'asc' } }),
            before,
          );
          assert.equal(await auth.permissionSet.count({ where: { tenantId: 'fixture-b' } }), 0);
          assert.equal(
            await auth.userPermissionSet.count({ where: { userId: 'fixture-user' } }),
            1,
          );
        },
      );
      await t.test(
        'real concurrent reconciliation stops without advancing the tenant cursor',
        async () => {
          await auth.$transaction(
            async (tx) => {
              const [held] = await tx.$queryRawUnsafe(
                'SELECT pg_try_advisory_xact_lock(hashtext($1),hashtext($2)) AS locked',
                'auth-permission-reconciliation',
                'fixture-a',
              );
              assert.equal(held.locked, true);
              const result = await reconcile.run({ execute: true, tenantId: 'fixture-a' });
              assert.equal(result.busy, true);
              assert.equal(result.completed, 0);
              assert.equal(result.nextCursor, null);
            },
            { timeout: 30000 },
          );
        },
      );
      await t.test(
        'real partial failure rolls back its tenant and resumes after the committed tenant',
        async () => {
          const failing = new Proxy(auth, {
            get(target, key) {
              if (key === '$transaction')
                return (action, options) =>
                  target.$transaction(
                    (tx) =>
                      action(
                        new Proxy(tx, {
                          get(inner, property) {
                            if (property === 'permissionSet')
                              return new Proxy(inner.permissionSet, {
                                get(delegate, method) {
                                  if (method === 'create')
                                    return async (args) => {
                                      await delegate.create(args);
                                      throw new Error('fixture failure after write');
                                    };
                                  return delegate[method];
                                },
                              });
                            return inner[property];
                          },
                        }),
                      ),
                    options,
                  );
              const value = target[key];
              return typeof value === 'function' ? value.bind(target) : value;
            },
          });
          await assert.rejects(
            new SystemPermissionBackfillService(failing).run({ execute: true, limit: 2 }),
            /transaction was rolled back/,
          );
          assert.equal(await auth.permissionSet.count({ where: { tenantId: 'fixture-b' } }), 0);
          const resumed = await reconcile.run({
            execute: true,
            afterTenantId: 'fixture-a',
            limit: 1,
          });
          assert.equal(resumed.completed, 1);
          assert.equal(resumed.nextCursor, 'fixture-b');
          assert((await auth.permissionSet.count({ where: { tenantId: 'fixture-b' } })) > 0);
        },
      );
      for (const [schema, { db, sql, rows }] of histories)
        assert.deepEqual(
          await db.$queryRawUnsafe(sql),
          rows,
          `${schema} history changed after reconciliation`,
        );
    } finally {
      for (const db of clients) await db.$disconnect();
      await admin.$disconnect();
    }
  },
);
