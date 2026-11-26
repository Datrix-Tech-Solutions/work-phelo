'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '../../..');
let reports;
try {
  const database = new URL(process.env.AI_TEST_DATABASE_URL || 'http://invalid');
  const redis = new URL(process.env.AI_TEST_ADMISSION_REDIS_URL || 'http://invalid');
  assert(
    ['postgres:', 'postgresql:'].includes(database.protocol) &&
      ['127.0.0.1', 'localhost'].includes(database.hostname) &&
      database.port === '54416' &&
      database.pathname === '/workphelo_ai_2b1' &&
      database.searchParams.get('schema') === 'ai',
    'Explicit disposable PostgreSQL configuration is required',
  );
  assert(
    redis.protocol === 'redis:' &&
      ['127.0.0.1', 'localhost'].includes(redis.hostname) &&
      redis.port === '17991' &&
      ['', '/0'].includes(redis.pathname),
    'Explicit disposable Redis configuration is required',
  );
  reports = mkdtempSync(join(tmpdir(), 'ai-resource-reports-'));
  const childEnv = { ...process.env, NODE_ENV: 'test', DATABASE_URL: database.toString() };
  for (const name of Object.keys(childEnv)) {
    if (
      name.startsWith('AI_') &&
      !['AI_TEST_DATABASE_URL', 'AI_TEST_ADMISSION_REDIS_URL'].includes(name)
    )
      delete childEnv[name];
  }
  const cases = [
    {
      name: 'PostgreSQL',
      workspace: 'ai-service',
      file: 'persistence/resource-safeguards.spec.ts',
      suite: 'AI resource safeguards on disposable PostgreSQL',
      minimum: 22,
    },
    {
      name: 'Redis',
      workspace: 'api-gateway',
      file: 'proxy/ai-rate-admission.spec.ts',
      suite: 'Shared AI admission on disposable Redis',
      minimum: 16,
    },
    {
      name: 'DemoGateway',
      workspace: 'ai-service',
      file: 'conversations/gateway.integration.spec.ts',
      suite: 'Isolated demo through real Gateway, AI and PostgreSQL (Auth current-state stub)',
      minimum: 18,
    },
  ];
  const totals = {};
  for (const test of cases) {
    const path = `apps/${test.workspace}/src/${test.file}`;
    const report = join(reports, test.name + '.json');
    const result = spawnSync(
      process.execPath,
      [
        join(root, 'node_modules/jest/bin/jest.js'),
        '--config',
        `apps/${test.workspace}/package.json`,
        '--runInBand',
        '--runTestsByPath',
        path,
        '--json',
        '--outputFile',
        report,
      ],
      { cwd: root, env: childEnv, stdio: 'inherit', timeout: 180000 },
    );
    assert.equal(result.status, 0, `${test.name} integration process must succeed`);
    const data = JSON.parse(readFileSync(report, 'utf8'));
    assert.equal(data.success, true, `${test.name} test report must succeed`);
    assert.equal(data.numPendingTests, 0, `${test.name} must not silently skip tests`);
    assert.equal(
      data.numTotalTests,
      data.numPassedTests,
      `${test.name} must execute every selected test`,
    );
    assert.equal(data.testResults.length, 1, `${test.name} must select exactly one test file`);
    const file = data.testResults[0];
    assert.equal(file.status, 'passed', `${test.name} suite must pass`);
    assert(file.name.endsWith(path), `${test.name} must execute the intended test file`);
    assert(
      file.assertionResults.every((item) => item.status === 'passed'),
      `${test.name} assertions must execute`,
    );
    const actual = file.assertionResults.filter((item) => item.ancestorTitles.includes(test.suite));
    assert(
      actual.length >= test.minimum,
      `${test.name} must execute the required real-dependency regressions`,
    );
    totals[test.name] = actual.length;
  }
  console.log(
    `AI shared-resource integration PASS: PostgreSQL=${totals.PostgreSQL} Redis=${totals.Redis} DemoGateway=${totals.DemoGateway} skipped=0`,
  );
} catch (error) {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : 'AI shared-resource integration verification failed',
  );
  process.exitCode = 1;
} finally {
  if (reports) rmSync(reports, { recursive: true, force: true });
}
