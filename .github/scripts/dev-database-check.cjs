#!/usr/bin/env node
'use strict';

const { createHash } = require('node:crypto');
const { existsSync, readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const schemas = Object.freeze({
  'auth-service': 'w_auth',
  'hr-service': 'hr',
  'notification-service': 'notify',
  'reinsurance-service': 'reinsurance',
  'accounting-service': 'accounting',
  'marketing-service': 'marketing',
  'inventory-service': 'inventory',
});
function fail(code) {
  const error = new Error(code);
  error.safeCode = code;
  throw error;
}
function catalog(root) {
  const directory = join(root, 'prisma/migrations');
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      checksum: createHash('sha256')
        .update(readFileSync(join(directory, entry.name, 'migration.sql')))
        .digest('hex'),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function validateHistory(expected, history) {
  if (!expected.length) fail('EMPTY_MIGRATION_CATALOG');
  const byName = new Map(expected.map((entry) => [entry.name, entry.checksum]));
  const applied = new Set();
  for (const row of history) {
    if (row.rolled_back_at) continue;
    if (!row.finished_at) fail('UNRESOLVED_FAILED_MIGRATION');
    if (!byName.has(row.migration_name)) fail('UNEXPECTED_APPLIED_MIGRATION');
    if (byName.get(row.migration_name) !== row.checksum) fail('MIGRATION_CHECKSUM_MISMATCH');
    if (applied.has(row.migration_name)) fail('DUPLICATE_APPLIED_MIGRATION');
    applied.add(row.migration_name);
  }
  if (expected.some((entry) => !applied.has(entry.name))) fail('PENDING_MIGRATIONS');
  return applied.size;
}
function validateUrl(service, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail('INVALID_DATABASE_CONFIGURATION');
  }
  const schema = schemas[service];
  if (
    !schema ||
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.searchParams.getAll('schema').length !== 1 ||
    url.searchParams.get('schema') !== schema ||
    url.searchParams.has('options')
  ) {
    fail('INCORRECT_DATABASE_SCHEMA');
  }
  // Bound connection acquisition as well as the read-only transaction.
  url.searchParams.set('connect_timeout', '5');
  url.searchParams.set('pool_timeout', '5');
  url.searchParams.set('connection_limit', '1');
  return url.toString();
}
async function inspect(client, service, expected) {
  const schema = schemas[service];
  if (!schema) fail('UNSUPPORTED_SERVICE');
  return client.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5s'");
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '2s'");
      const rows = await tx.$queryRawUnsafe(
        `SELECT migration_name, checksum, finished_at, rolled_back_at FROM "${schema}"."_prisma_migrations"`,
      );
      return validateHistory(expected, rows);
    },
    { maxWait: 5000, timeout: 15000 },
  );
}
async function main(service, root = process.cwd()) {
  const expected = catalog(root);
  if (service === 'subscription-service') {
    if (expected.length) fail('SUBSCRIPTION_DATABASE_ADOPTION_REQUIRES_REVIEW');
    console.log('subscription-service: health-only; no database runtime or migration catalog');
    return;
  }
  const databaseUrl = validateUrl(service, process.env.DATABASE_URL);
  const { PrismaClient } = require(join(root, 'prisma/generated/client'));
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] });
  try {
    const count = await inspect(client, service, expected);
    console.log(`${service}: ${count} applied migrations match candidate; read-only check passed`);
  } finally {
    await client.$disconnect();
  }
}
module.exports = { schemas, catalog, validateHistory, validateUrl, inspect, main };
if (require.main === module) {
  main(process.argv[2]).catch((error) => {
    // Driver messages can contain URLs. Never print raw errors or Prisma metadata.
    console.error(
      `Database compatibility check failed: ${error.safeCode || 'DATABASE_INSPECTION_FAILED'}`,
    );
    process.exitCode = 1;
  });
}
