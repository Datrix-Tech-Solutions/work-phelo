import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const serviceSchemas = Object.freeze({
  'auth-service': 'w_auth',
  'hr-service': 'hr',
  'notification-service': 'notify',
  'reinsurance-service': 'reinsurance',
  'accounting-service': 'accounting',
  'marketing-service': 'marketing',
  'inventory-service': 'inventory',
});
const hash = (value) => createHash('sha256').update(value).digest('hex');
const fail = (code) => {
  throw Object.assign(new Error(code), { code });
};
const validDigest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const reference = (value) => typeof value === 'string' && value.trim().length > 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function databaseScope(url, schema) {
  const parsed = new URL(url);
  return hash(
    JSON.stringify({
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname,
      schema,
    }),
  );
}

export function migrationFiles(directory) {
  return readdirSync(directory)
    .sort()
    .filter((name) => existsSync(join(directory, name, 'migration.sql')))
    .map((name) => {
      if (!/^[A-Za-z0-9_-]+$/.test(name)) fail('INVALID_MIGRATION_NAME');
      const sql = readFileSync(join(directory, name, 'migration.sql'));
      return {
        name,
        checksum: hash(sql),
        reviewRequired:
          /\b(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+|RENAME\s+|ALTER\s+COLUMN|ADD\s+CONSTRAINT|CREATE\s+UNIQUE)\b/i.test(
            sql.toString(),
          ),
      };
    });
}

export function validateHistory(files, rows) {
  const known = new Map(files.map((file) => [file.name, file]));
  const applied = new Map();
  for (const row of rows) {
    const file = known.get(row.migration_name);
    if (!file) fail('UNKNOWN_MIGRATION_HISTORY');
    if (row.checksum !== file.checksum) fail('MIGRATION_CHECKSUM_MISMATCH');
    if (row.rolled_back_at && row.finished_at) fail('INCONSISTENT_MIGRATION_HISTORY');
    if (row.rolled_back_at) continue; // Preserve failed/rolled-back attempts; never resolve them here.
    if (!row.finished_at) fail('FAILED_OR_RUNNING_MIGRATION');
    if (applied.has(row.migration_name)) fail('DUPLICATE_APPLIED_MIGRATION');
    applied.set(row.migration_name, file);
  }
  const names = [...applied.keys()].sort();
  if (
    !same(
      names,
      files.slice(0, names.length).map((file) => file.name),
    )
  )
    fail('NON_PREFIX_MIGRATION_HISTORY');
  return files.slice(names.length);
}

// Catalog definitions only, never business rows, secrets, migration logs or connection strings.
const catalogSql = `
SELECT kind, name, definition FROM (
  SELECT 'table' AS kind,c.relname AS name,
    jsonb_build_object('kind',c.relkind,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
      'partition',pg_get_expr(c.relpartbound,c.oid)) AS definition
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname=$1 AND c.relkind IN ('r','p') AND c.relname<>'_prisma_migrations'
  UNION ALL
  SELECT 'column' AS kind, c.relname || '.' || a.attname AS name,
    jsonb_build_object('type', format_type(a.atttypid,a.atttypmod), 'required',a.attnotnull,
      'default',pg_get_expr(d.adbin,d.adrelid), 'identity',a.attidentity,'generated',a.attgenerated) AS definition
  FROM pg_namespace n JOIN pg_class c ON c.relnamespace=n.oid
  JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
  LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
  WHERE n.nspname=$1 AND c.relkind IN ('r','p') AND c.relname<>'_prisma_migrations'
  UNION ALL
  SELECT 'constraint',c.relname || '.' || x.conname,to_jsonb(pg_get_constraintdef(x.oid,true))
  FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname=$1 AND c.relname<>'_prisma_migrations'
  UNION ALL
  SELECT 'index',c.relname,to_jsonb(pg_get_indexdef(c.oid)) FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_index i ON i.indexrelid=c.oid
  JOIN pg_class t ON t.oid=i.indrelid WHERE n.nspname=$1 AND t.relname<>'_prisma_migrations'
  UNION ALL
  SELECT 'enum',t.typname,jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
  FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
  WHERE n.nspname=$1 GROUP BY t.typname
  UNION ALL
  SELECT 'view',c.relname,to_jsonb(pg_get_viewdef(c.oid,true)) FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind IN ('v','m')
  UNION ALL
  SELECT 'trigger',c.relname || '.' || t.tgname,to_jsonb(pg_get_triggerdef(t.oid,true))
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname=$1 AND NOT t.tgisinternal
  UNION ALL
  SELECT 'function',p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',to_jsonb(pg_get_functiondef(p.oid))
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND p.prokind IN ('f','p')
  UNION ALL
  SELECT 'sequence',c.relname,jsonb_build_object('start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle)
  FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1
  UNION ALL
  SELECT 'policy',c.relname || '.' || p.polname,jsonb_build_object('command',p.polcmd,'permissive',p.polpermissive,
    'using',pg_get_expr(p.polqual,c.oid),'check',pg_get_expr(p.polwithcheck,c.oid),
    'roles',(SELECT jsonb_agg(CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END ORDER BY r) FROM unnest(p.polroles) r))
  FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1
) objects ORDER BY kind,name`;

export async function readSchemaState(db, schema) {
  if (!Object.values(serviceSchemas).includes(schema)) fail('INVALID_SERVICE_SCHEMA');
  const [meta] = await db.$queryRawUnsafe(
    `SELECT current_schema() AS current_schema,
      current_setting('server_version_num')::int / 10000 AS major,
      to_regclass($1) IS NOT NULL AS history_exists`,
    `${schema}._prisma_migrations`,
  );
  const rows = meta.history_exists
    ? await db.$queryRawUnsafe(
        `SELECT migration_name,checksum,finished_at,rolled_back_at FROM "${schema}"._prisma_migrations ORDER BY started_at,id`,
      )
    : [];
  const objects = await db.$queryRawUnsafe(catalogSql, schema);
  if (objects.length && meta.current_schema !== schema) fail('INCORRECT_CONNECTION_SEARCH_PATH');
  if (!meta.history_exists && objects.length) fail('UNTRACKED_NONEMPTY_SCHEMA');
  return {
    history: rows,
    digest: hash(JSON.stringify(objects)),
    major: Number(meta.major),
    objects: objects.length,
  };
}

export function readApprovedPlan(file, digest) {
  if (!file || !validDigest(digest)) fail('APPROVED_PLAN_REQUIRED');
  const bytes = readFileSync(file);
  if (hash(bytes) !== digest) fail('APPROVED_PLAN_DIGEST_MISMATCH');
  const plan = JSON.parse(bytes.toString());
  if (plan.version !== 1 || !reference(plan.approvalRef) || !plan.services)
    fail('INVALID_APPROVED_PLAN');
  return plan;
}

export function validatePlan({
  plan,
  service,
  files,
  state,
  pending,
  releaseSha,
  databaseScopeHash,
  now = Date.now(),
}) {
  const entry = plan.services[service];
  if (!entry || entry.schema !== serviceSchemas[service] || entry.postgresMajor !== state.major)
    fail('PLAN_SCHEMA_OR_ENGINE_MISMATCH');
  if (
    !validDigest(databaseScopeHash) ||
    entry.databaseScopeHash !== databaseScopeHash ||
    !reference(entry.snapshotEvidenceRef)
  )
    fail('PLAN_DATABASE_SCOPE_MISMATCH');
  if (
    !same(
      entry.targetMigrations,
      files.map(({ name, checksum }) => ({ name, checksum })),
    )
  )
    fail('PLAN_SOURCE_MISMATCH');
  if (!validDigest(entry.beforeDigest) || !validDigest(entry.afterDigest))
    fail('PLAN_FINGERPRINT_REQUIRED');
  if (pending.length === 0) {
    if (state.digest !== entry.afterDigest) fail('SCHEMA_DRIFT');
    return entry;
  }
  if (!/^[a-f0-9]{40}$/.test(releaseSha ?? '') || plan.releaseSha !== releaseSha)
    fail('PLAN_RELEASE_MISMATCH');
  if (!(Date.parse(plan.expiresAt) > now)) fail('PLAN_EXPIRED');
  const applied = files
    .slice(0, files.length - pending.length)
    .map(({ name, checksum }) => ({ name, checksum }));
  if (!same(entry.fromMigrations, applied) || state.digest !== entry.beforeDigest)
    fail('SCHEMA_DRIFT');
  if (entry.backwardCompatible !== true || !reference(entry.compatibilityEvidenceRef))
    fail('MAINTENANCE_MIGRATION_REQUIRED');
  if (pending.some((file) => file.reviewRequired) && !reference(entry.destructiveApprovalRef))
    fail('DESTRUCTIVE_APPROVAL_REQUIRED');
  const backup = plan.backup;
  if (
    !reference(backup?.reference) ||
    !reference(backup.verificationRef) ||
    !reference(backup.restoreTestRef) ||
    backup.releaseSha !== releaseSha ||
    !Array.isArray(backup.serviceScopes) ||
    !backup.serviceScopes.includes(databaseScopeHash) ||
    !Number.isFinite(Date.parse(backup.verifiedAt)) ||
    Date.parse(backup.verifiedAt) > now ||
    !(Date.parse(backup.validUntil) > now)
  )
    fail('VERIFIED_BACKUP_REQUIRED');
  return entry;
}

export async function executeMigration({
  client,
  files,
  plan,
  service,
  releaseSha,
  databaseScopeHash,
  execute,
  status,
  now,
}) {
  const schema = serviceSchemas[service];
  if (!schema) fail('UNKNOWN_SERVICE');
  // Leave thirty seconds for rollback/releasing the lock after the native process stops.
  const deadline = Date.now() + 300000;
  const remaining = () => {
    const milliseconds = deadline - Date.now();
    if (milliseconds <= 0) fail('MIGRATION_STAGE_DEADLINE');
    return milliseconds;
  };
  return client.$transaction(
    async (db) => {
      const [lock] = await db.$queryRawUnsafe(
        "SELECT pg_try_advisory_xact_lock(hashtext('workphelo-production-schema-migrations')) AS locked",
      );
      if (!lock?.locked) fail('MIGRATION_LOCK_BUSY');
      // Keep catalog reads off the lock transaction: introspection can hold relation
      // locks that would otherwise block the separate Prisma DDL connection.
      const before = await readSchemaState(client, schema);
      const pending = validateHistory(files, before.history);
      const entry = validatePlan({
        plan,
        service,
        files,
        state: before,
        pending,
        releaseSha,
        databaseScopeHash,
        now,
      });
      // Check the lock transaction is still live before starting separate-connection DDL.
      await db.$queryRawUnsafe('SELECT 1');
      if (pending.length) await execute(remaining());
      const after = await readSchemaState(client, schema);
      if (validateHistory(files, after.history).length || after.digest !== entry.afterDigest)
        fail('POST_MIGRATION_VERIFICATION_FAILED');
      await status(remaining());
      return {
        service,
        pendingApplied: pending.length,
        rolledBackAttemptsPreserved: after.history.filter((row) => row.rolled_back_at).length,
      };
    },
    { timeout: 330000, maxWait: 5000 },
  );
}

async function cli() {
  const service = process.env.MIGRATION_SERVICE;
  const schema = serviceSchemas[service];
  if (!schema) fail('UNKNOWN_SERVICE');
  const directory = resolve(process.cwd(), 'prisma');
  const files = migrationFiles(join(directory, 'migrations'));
  if (process.argv.includes('--manifest')) {
    console.log(JSON.stringify({ service, schema, migrations: files }));
    return;
  }
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!same(url.searchParams.getAll('schema'), [schema])) fail('INCORRECT_DATABASE_SCHEMA_URL');
  const databaseScopeHash = databaseScope(url, schema);
  const require = createRequire(resolve(process.cwd(), 'package.json'));
  const { PrismaClient } = require(join(directory, 'generated/client'));
  const inspectionUrl = new URL(url);
  inspectionUrl.searchParams.set('connection_limit', '2');
  const client = new PrismaClient({ datasources: { db: { url: inspectionUrl.toString() } } });
  try {
    if (process.argv.includes('--inspect')) {
      const state = await readSchemaState(client, schema);
      validateHistory(files, state.history);
      console.log(JSON.stringify({ service, schema, databaseScopeHash, ...state }));
      return;
    }
    if (!process.argv.includes('--execute')) fail('EXPLICIT_EXECUTION_REQUIRED');
    const plan = readApprovedPlan(
      process.env.MIGRATION_PLAN_FILE,
      process.env.MIGRATION_PLAN_SHA256,
    );
    const prisma = require.resolve('prisma/build/index.js');
    const command = (action, timeout) => {
      const result = spawnSync(
        process.execPath,
        [prisma, 'migrate', action, '--schema', join(directory, 'schema.prisma')],
        {
          env: process.env,
          timeout,
          killSignal: 'SIGTERM',
          stdio: 'pipe',
        },
      );
      // Never forward Prisma output: it can include connection details or SQL/log content.
      if (result.status !== 0)
        fail(
          action === 'deploy'
            ? 'MIGRATION_EXECUTION_FAILED_REVIEW_REQUIRED'
            : 'MIGRATION_STATUS_FAILED',
        );
    };
    const result = await executeMigration({
      client,
      files,
      plan,
      service,
      releaseSha: process.env.BUILD_SHA,
      databaseScopeHash,
      execute: (timeout) => command('deploy', timeout),
      status: (timeout) => command('status', timeout),
    });
    console.log(JSON.stringify(result));
  } finally {
    await client.$disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch((error) => {
    console.error(
      `Production migration stage stopped: ${/^(?:[A-Z_]+|P\d{4})$/.test(error.code ?? '') ? error.code : 'MIGRATION_CHECK_FAILED'}. No automatic repair or database rollback is attempted.`,
    );
    process.exitCode = 1;
  });
}
