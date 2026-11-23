import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const ts = require('typescript');
function load(path) {
  const source = readFileSync(resolve(root, path), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext(code, { module: compiled, exports: compiled.exports, require, URL });
  return compiled.exports;
}
const { middleware } = load('src/middleware.ts');
const { GET } = load('src/app/health/route.ts');
const request = (path) => ({
  nextUrl: { pathname: path },
  url: 'http://localhost:3000' + path,
  cookies: { get: () => undefined },
});

test('unauthenticated health bypasses redirects and returns direct no-store 200', async () => {
  const decision = middleware(request('/health'));
  assert.equal(decision.headers.get('x-middleware-next'), '1');
  assert.equal(decision.headers.get('location'), null);
  const response = GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'ok' });
});
test('health bypass does not expose tenant routes or path suffixes', () => {
  for (const path of ['/acme/health', '/health/private', '/acme/hr'])
    assert.equal(middleware(request(path)).status, 307);
});
test('existing unauthenticated login routes remain public', () => {
  for (const path of ['/login', '/platform/login', '/acme/login'])
    assert.equal(middleware(request(path)).headers.get('location'), null);
});
