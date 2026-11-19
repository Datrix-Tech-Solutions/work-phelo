import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as zlib from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const temp = mkdtempSync(join(tmpdir(), 'workphelo-gateway-context-'));
const marker = Buffer.from('synthetic-context-canary-' + randomUUID());
const tag = 'workphelo-gateway-security:' + randomUUID();
const contextOnly = process.argv.includes('--context-only');
const docker = (args) =>
  execFileSync('docker', args, { stdio: 'inherit', timeout: 900000 });
function copy(path) {
  const destination = join(temp, path);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(root, path), destination);
}
function sourceTree(path) {
  for (const item of readdirSync(join(root, path), { withFileTypes: true })) {
    const child = path + '/' + item.name;
    if (item.isDirectory()) sourceTree(child);
    else if (
      item.isFile() &&
      item.name.endsWith('.ts') &&
      !/\.(spec|test)\.ts$/.test(item.name)
    )
      copy(child);
  }
}
function scan(path) {
  for (const item of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, item.name);
    if (item.isDirectory()) {
      scan(child);
      continue;
    }
    if (!item.isFile()) continue;
    let bytes = readFileSync(child);
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = zlib.gunzipSync(bytes);
    else if (
      bytes.subarray(0, 4).equals(Buffer.from([0x28, 0xb5, 0x2f, 0xfd]))
    ) {
      assert.equal(
        typeof zlib.zstdDecompressSync,
        'function',
        'Need zstd-capable Node to inspect exported layers',
      );
      bytes = zlib.zstdDecompressSync(bytes);
    }
    const offset = bytes.indexOf(marker);
    if (offset !== -1) {
      let member = 'non-tar artifact';
      for (let position = 0; position + 512 <= bytes.length; ) {
        const size = parseInt(
          bytes
            .subarray(position + 124, position + 136)
            .toString()
            .replace(/\0.*$/, '')
            .trim(),
          8,
        );
        if (!Number.isFinite(size)) break;
        if (offset >= position + 512 && offset < position + 512 + size) {
          member = bytes
            .subarray(position, position + 100)
            .toString()
            .replace(/\0.*$/, '');
          break;
        }
        position += 512 + Math.ceil(size / 512) * 512;
      }
      throw new Error(
        'Synthetic secret found in exported artifact member: ' + member,
      );
    }
  }
}
try {
  for (const path of [
    'package.json',
    'package-lock.json',
    'tsconfig.base.json',
  ])
    copy(path);
  for (const name of ['types', 'schemas', 'utils', 'config']) {
    copy(`packages/${name}/package.json`);
    copy(`packages/${name}/tsconfig.json`);
    sourceTree(`packages/${name}/src`);
  }
  for (const name of [
    'package.json',
    'nest-cli.json',
    'tsconfig.json',
    'tsconfig.build.json',
    'Dockerfile',
    'Dockerfile.dockerignore',
  ])
    copy('apps/api-gateway/' + name);
  sourceTree('apps/api-gateway/src');
  const dockerfile = join(temp, 'apps/api-gateway/Dockerfile');
  writeFileSync(
    dockerfile,
    readFileSync(dockerfile, 'utf8') +
      '\nFROM scratch AS context-audit\nCOPY . /\n',
  );
  for (const base of [
    '',
    'apps/api-gateway/',
    'apps/api-gateway/src/',
    'packages/config/',
    'packages/config/src/',
  ]) {
    for (const name of [
      '.env',
      '.env.dev',
      '.env.prod',
      '.env.local',
      '.env.production.local',
      '.npmrc',
      'credentials.json',
      'local-credentials.ts',
      'private.pem',
      'signing.key',
      'id_rsa',
      '.aws/credentials',
    ]) {
      const path = join(temp, base, name);
      assert(!existsSync(path));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, marker);
    }
  }
  const unrelated = join(temp, 'packages/not-required/src/canary.ts');
  mkdirSync(dirname(unrelated), { recursive: true });
  writeFileSync(unrelated, marker);
  if (!contextOnly)
    docker([
      'build',
      '--no-cache',
      '--platform',
      'linux/amd64',
      '--target',
      'builder',
      '-f',
      join(temp, 'apps/api-gateway/Dockerfile'),
      '-t',
      tag + '-builder',
      temp,
    ]);
  if (!contextOnly)
    docker([
      'build',
      '--platform',
      'linux/amd64',
      '--target',
      'runner',
      '-f',
      join(temp, 'apps/api-gateway/Dockerfile'),
      '-t',
      tag,
      temp,
    ]);
  docker([
    'build',
    '--platform',
    'linux/amd64',
    '--target',
    'context-audit',
    '-f',
    dockerfile,
    '-t',
    tag + '-context',
    temp,
  ]);
  const archive = join(temp, 'images.tar'),
    unpack = join(temp, 'export');
  mkdirSync(unpack);
  docker([
    'image',
    'save',
    '-o',
    archive,
    ...(!contextOnly ? [tag + '-builder', tag] : []),
    tag + '-context',
  ]);
  execFileSync('tar', ['-xf', archive, '-C', unpack]);
  scan(unpack);
  const history =
    !contextOnly &&
    execFileSync('docker', ['history', '--no-trunc', tag + '-builder']);
  assert(!history || !history.includes(marker));
  if (!contextOnly)
    docker([
      'run',
      '--rm',
      '--platform',
      'linux/amd64',
      '--network',
      'none',
      tag,
      'node',
      '-e',
      "require('./dist/proxy/proxy.controller');require('./dist/proxy/ai-conversation-proxy');console.log('Gateway compiled runtime imports PASS')",
    ]);
  console.log(
    contextOnly
      ? 'Gateway context-only canaries PASS'
      : 'Gateway context PASS: synthetic environment/credential canaries absent from builder and runtime image files, layers and exported artifacts',
  );
} finally {
  for (const image of [tag, tag + '-builder', tag + '-context']) {
    try {
      execFileSync('docker', ['image', 'rm', image], { stdio: 'ignore' });
    } catch {}
  }
  rmSync(temp, { recursive: true, force: true });
}
