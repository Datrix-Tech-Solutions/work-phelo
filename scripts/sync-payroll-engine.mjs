// The payroll engine has one source of truth: packages/payroll-engine/src. The server imports it as
// @work-phelo/payroll-engine. The web app is built on its own (its Docker image and CI only see
// apps/web/work-phelo-web), so it keeps a mirrored copy under src/lib/payroll-engine instead.
//
//   node scripts/sync-payroll-engine.mjs           copy the package source into the web app
//   node scripts/sync-payroll-engine.mjs --check   fail if the web copy has drifted (used in CI)

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const sourceDir = join(root, 'packages/payroll-engine/src');
const targetDir = join(root, 'apps/web/work-phelo-web/src/lib/payroll-engine');
const check = process.argv.includes('--check');

const isEngineFile = (name) =>
  name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.fixtures.ts');

const header = (name) =>
  `// GENERATED from packages/payroll-engine/src/${name} by scripts/sync-payroll-engine.mjs.\n` +
  '// Do not edit this copy. Change the package, then run: npm run sync:payroll-engine\n\n';

const sourceFiles = readdirSync(sourceDir).filter(isEngineFile).sort();
const expected = new Map(
  sourceFiles.map((name) => [name, header(name) + readFileSync(join(sourceDir, name), 'utf8')]),
);
const existing = existsSync(targetDir) ? readdirSync(targetDir).filter(isEngineFile) : [];

const problems = [];
for (const [name, content] of expected) {
  const path = join(targetDir, name);
  if (!existsSync(path)) problems.push(`missing: ${name}`);
  else if (readFileSync(path, 'utf8') !== content) problems.push(`out of date: ${name}`);
}
for (const name of existing) {
  if (!expected.has(name)) problems.push(`not in the package: ${name}`);
}

if (check) {
  if (problems.length) {
    console.error('The web copy of the payroll engine has drifted from packages/payroll-engine:');
    problems.forEach((problem) => console.error(`  ${problem}`));
    console.error('Run "npm run sync:payroll-engine" and commit the result.');
    process.exit(1);
  }
  console.log('Payroll engine copies are in sync');
} else {
  mkdirSync(targetDir, { recursive: true });
  for (const [name, content] of expected) writeFileSync(join(targetDir, name), content);
  for (const name of existing) {
    if (!expected.has(name)) unlinkSync(join(targetDir, name));
  }
  console.log(`Synced ${expected.size} files to apps/web/work-phelo-web/src/lib/payroll-engine`);
}
