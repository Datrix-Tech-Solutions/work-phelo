import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const serviceSchemas = Object.freeze({
  'auth-service': 'w_auth',
  'hr-service': 'hr',
  'notification-service': 'notify',
  'reinsurance-service': 'reinsurance',
  'accounting-service': 'accounting',
  'marketing-service': 'marketing',
  'inventory-service': 'inventory',
});

export function runMigration({
  service,
  env = process.env,
  cwd = process.cwd(),
  spawn = spawnSync,
}) {
  const fail = (code) => {
    throw Object.assign(new Error(code), { code });
  };
  const schema = serviceSchemas[service];
  if (!schema) fail('UNKNOWN_SERVICE');
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    fail('INVALID_DATABASE_URL');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    JSON.stringify(url.searchParams.getAll('schema')) !== JSON.stringify([schema])
  )
    fail('INCORRECT_DATABASE_SCHEMA_URL');

  let prisma;
  try {
    prisma = createRequire(resolve(cwd, 'package.json')).resolve('prisma/build/index.js');
  } catch {
    fail('PRISMA_CLI_UNAVAILABLE');
  }
  const result = spawn(
    process.execPath,
    [prisma, 'migrate', 'deploy', '--schema', resolve(cwd, 'prisma/schema.prisma')],
    {
      cwd,
      env: { ...env, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 1024 * 1024,
      timeout: 300000,
      killSignal: 'SIGTERM',
    },
  );
  // Prisma errors can contain connection strings. Publish the service and safe code only.
  if (result.error?.code === 'ETIMEDOUT') fail('MIGRATION_TIMEOUT');
  if (result.status !== 0) {
    const code = ((result.stderr ?? '') + '\n' + (result.stdout ?? '')).match(/\bP\d{4}\b/)?.[0];
    fail(code ?? 'MIGRATION_DEPLOY_FAILED');
  }
  return { service, status: 'migration-deploy-complete' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2)
      throw Object.assign(new Error('UNSUPPORTED_ARGUMENTS'), { code: 'UNSUPPORTED_ARGUMENTS' });
    console.log(JSON.stringify(runMigration({ service: process.env.MIGRATION_SERVICE })));
  } catch (error) {
    const code = /^(?:[A-Z_]+|P\d{4})$/.test(error.code ?? '')
      ? error.code
      : 'MIGRATION_DEPLOY_FAILED';
    const service = serviceSchemas[process.env.MIGRATION_SERVICE]
      ? process.env.MIGRATION_SERVICE
      : 'unknown';
    console.error(
      `Migration deploy stopped: service=${service} code=${code}. Application rollout must stop; no automatic database rollback or repair.`,
    );
    process.exitCode = 1;
  }
}
