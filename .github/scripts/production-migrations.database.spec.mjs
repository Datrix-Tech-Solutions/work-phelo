import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runMigration, serviceSchemas } from './production-migrations.mjs';

const configured = process.env.MIGRATION_TEST_DATABASE_URL;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function fixture(action) {
  const base = new URL(configured);
  assert(['127.0.0.1', 'localhost'].includes(base.hostname));
  assert.equal(base.port, '54413');
  assert.equal(base.pathname, '/resilience_fixture');
  assert.equal(base.username, 'fixture');
  const require = createRequire(resolve(root, 'apps/inventory-service/package.json'));
  const { PrismaClient } = require(resolve(root, 'apps/inventory-service/prisma/generated/client'));
  const clients = [];
  const connect = (url) => {
    const client = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    clients.push(client);
    return client;
  };
  const admin = connect(base);
  try {
    const name = 'resilience_native_' + randomUUID().replaceAll('-', '');
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    base.pathname = '/' + name;
    const urlFor = (schema) => {
      const url = new URL(base);
      url.searchParams.set('schema', schema);
      return url;
    };
    await action({ connect, urlFor });
  } finally {
    for (const client of clients) await client.$disconnect();
  }
}

const history = (db, schema) =>
  db.$queryRawUnsafe(
    `SELECT id,checksum,migration_name,started_at,finished_at,rolled_back_at,applied_steps_count FROM "${schema}"._prisma_migrations ORDER BY id`,
  );
const deploy = (service, url, cwd = resolve(root, 'apps', service)) =>
  runMigration({ service, cwd, env: { ...process.env, DATABASE_URL: url.toString() } });

test(
  'native Prisma no-op, additive change and failure preserve existing data/history',
  { skip: !configured, timeout: 90000 },
  async (t) =>
    fixture(async ({ connect, urlFor }) => {
      const directory = mkdtempSync(resolve(tmpdir(), 'workphelo-native-migration-'));
      try {
        writeFileSync(resolve(directory, 'package.json'), '{"name":"migration-fixture"}');
        symlinkSync(resolve(root, 'node_modules'), resolve(directory, 'node_modules'), 'dir');
        mkdirSync(resolve(directory, 'prisma'));
        writeFileSync(
          resolve(directory, 'prisma/schema.prisma'),
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
          const path = resolve(directory, 'prisma/migrations', name);
          mkdirSync(path, { recursive: true });
          writeFileSync(resolve(path, 'migration.sql'), sql);
        };
        migration(
          '20260101000000_initial',
          'CREATE SCHEMA IF NOT EXISTS inventory; CREATE TABLE inventory."Fixture" (id TEXT PRIMARY KEY,value TEXT NOT NULL);',
        );
        const url = urlFor('inventory'),
          db = connect(url);
        deploy('inventory-service', url, directory);
        await db.$executeRawUnsafe(
          'INSERT INTO inventory."Fixture" (id,value) VALUES ($1,$2)',
          'preserve',
          'existing',
        );
        const original = await history(db, 'inventory');
        await t.test('no pending does not rerun previously applied migrations', async () => {
          deploy('inventory-service', url, directory);
          assert.deepEqual(await history(db, 'inventory'), original);
        });
        await t.test(
          'pending additive migration is applied without deleting existing rows',
          async () => {
            migration(
              '20260102000000_add_note',
              'ALTER TABLE inventory."Fixture" ADD COLUMN note TEXT;',
            );
            deploy('inventory-service', url, directory);
            assert.equal((await history(db, 'inventory')).length, 2);
            assert.deepEqual(
              await db.$queryRawUnsafe('SELECT id,value,note FROM inventory."Fixture"'),
              [{ id: 'preserve', value: 'existing', note: null }],
            );
          },
        );
        await t.test(
          'failed SQL is fatal and is never automatically resolved or reset',
          async () => {
            migration(
              '20260103000000_failure',
              'ALTER TABLE inventory."DoesNotExist" ADD COLUMN invalid TEXT;',
            );
            assert.throws(
              () => deploy('inventory-service', url, directory),
              (error) => /^P\d{4}$/.test(error.code),
            );
            const failed = await history(db, 'inventory');
            assert.equal(failed.filter((row) => !row.finished_at && !row.rolled_back_at).length, 1);
            assert.throws(
              () => deploy('inventory-service', url, directory),
              (error) => error.code === 'P3009',
            );
            assert.deepEqual(await history(db, 'inventory'), failed);
            assert.equal(
              (await db.$queryRawUnsafe('SELECT id FROM inventory."Fixture"')).length,
              1,
            );
          },
        );
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }),
);

test(
  'original Inventory SQL uses the correct search path and keeps rolled-back attempts',
  { skip: !configured, timeout: 90000 },
  async () =>
    fixture(async ({ connect, urlFor }) => {
      const url = urlFor('inventory'),
        db = connect(url);
      deploy('inventory-service', url);
      const [column] = await db.$queryRawUnsafe(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='inventory' AND table_name='InventoryItem' AND column_name='maxStock'",
      );
      assert.equal(column.column_name, 'maxStock');
      const name = '20261110020000_add_item_max_stock';
      const checksum = createHash('sha256')
        .update(
          readFileSync(
            resolve(root, 'apps/inventory-service/prisma/migrations', name, 'migration.sql'),
          ),
        )
        .digest('hex');
      // Synthetic historical attempt in an owned fixture only, never a production repair.
      await db.$executeRawUnsafe(
        'INSERT INTO inventory._prisma_migrations (id,checksum,migration_name,started_at,rolled_back_at,applied_steps_count) VALUES ($1,$2,$3,now(),now(),0)',
        randomUUID(),
        checksum,
        name,
      );
      const before = await history(db, 'inventory');
      deploy('inventory-service', url);
      assert.deepEqual(await history(db, 'inventory'), before);
      assert.equal(before.filter((row) => row.rolled_back_at).length, 1);
    }),
);

test(
  'all seven native migration sequences use separate histories and safely become no-ops',
  { skip: !configured, timeout: 240000 },
  async () =>
    fixture(async ({ connect, urlFor }) => {
      for (const [service, schema] of Object.entries(serviceSchemas)) {
        const url = urlFor(schema),
          db = connect(url);
        deploy(service, url);
        const before = await history(db, schema);
        assert(before.length > 0);
        assert(before.every((row) => row.finished_at && !row.rolled_back_at));
        deploy(service, url);
        assert.deepEqual(await history(db, schema), before, service + ' history changed');
      }
    }),
);
