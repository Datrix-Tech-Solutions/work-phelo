#!/usr/bin/env node
/** WorkPhelo local verification: no network, migrations, seeds or deployments. */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const cwd = process.cwd();
const args = new Set(process.argv.slice(2));
const accepted = new Set(['--scope=all', '--scope=ai', '--web']);
if ([...args].some((a) => !accepted.has(a)) || (args.has('--scope=all') && args.has('--scope=ai'))) {
  console.error('Usage: node scripts/verify-codex.mjs [--scope=all|--scope=ai] [--web]');
  process.exit(2);
}
const scope = args.has('--scope=ai') ? 'ai' : 'all';
const tasks = scope === 'ai'
  ? [
      ['Build Gateway config runtime dependency', 'npm', ['run', 'build', '--workspace=@work-phelo/config']],
      ...['check-types', 'lint', 'test'].flatMap((task) =>
        ['apps/ai-service', 'apps/api-gateway'].map((workspace) => [
          `${task} ${workspace}`,
          'npm',
          ['run', task, `--workspace=${workspace}`],
        ]),
      ),
    ]
  : [
      ['Root typecheck', 'npm', ['run', 'check-types']],
      ['Root lint', 'npm', ['run', 'lint']],
      ['Root tests', 'npm', ['run', 'test']],
      ['RBAC alignment', 'npm', ['run', 'check-rbac']],
      ['Payroll engine copies', 'npm', ['run', 'check-payroll-engine']],
    ];
if (args.has('--web')) {
  const web = resolve(cwd, 'apps/web/work-phelo-web');
  tasks.push(['Web lint', 'npm', ['run', 'lint'], web]);
  tasks.push(['Web build', 'npm', ['run', 'build'], web]);
}
let failed = false;
for (const [label, command, argv, taskCwd = cwd] of tasks) {
  console.log(`\n==> ${label}: ${command} ${argv.join(' ')}`);
  const outcome = spawnSync(command, argv, { cwd: taskCwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (outcome.error || outcome.status !== 0) {
    console.error(`FAILED: ${label} (exit ${outcome.status ?? 'signal/error'})`);
    failed = true;
    break;
  }
}
console.log(failed ? '\nVerification FAILED.' : '\nVerification passed for selected checks.');
console.log('Note: real PostgreSQL/Redis AI resource tests and live DEV acceptance are separate and NOT RUN by this script.');
process.exitCode = failed ? 1 : 0;
