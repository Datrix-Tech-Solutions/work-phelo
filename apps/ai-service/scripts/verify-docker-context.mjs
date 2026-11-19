import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  copyFileSync,
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
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
const temp = mkdtempSync(join(tmpdir(), 'workphelo-ai-context-'));
const id = randomUUID();
const image = 'workphelo-ai-foundation:context-' + id;
const contextOnly = process.argv.includes('--context-only');
const fallback = process.argv.includes('--fallback-ignore');
const ownedContainers = [];
const markers = new Map();
const docker = (args, options = {}) => {
  const build = args[0] === 'build' || (args[0] === 'buildx' && args[1] === 'build');
  if (!build)
    return execFileSync('docker', args, { timeout: 900000, stdio: 'inherit', ...options });
  const path = join(temp, 'build-output.log');
  const descriptor = openSync(path, 'w');
  try {
    return execFileSync('docker', args, {
      timeout: 900000,
      ...options,
      stdio: ['ignore', descriptor, descriptor],
    });
  } finally {
    closeSync(descriptor);
    const output = readFileSync(path);
    scanBytes(output);
    process.stdout.write(output);
  }
};
const copy = (path) => {
  mkdirSync(dirname(join(temp, path)), { recursive: true });
  copyFileSync(join(root, path), join(temp, path));
};
function sourceTree(path) {
  for (const item of readdirSync(join(root, path), { withFileTypes: true })) {
    const child = path + '/' + item.name;
    if (item.isDirectory()) sourceTree(child);
    else if (item.isFile() && item.name.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(item.name))
      copy(child);
  }
}
function decoded(bytes) {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return zlib.gunzipSync(bytes);
  if (bytes.subarray(0, 4).equals(Buffer.from([0x28, 0xb5, 0x2f, 0xfd]))) {
    assert.equal(
      typeof zlib.zstdDecompressSync,
      'function',
      'Need zstd-capable Node for cache scan',
    );
    return zlib.zstdDecompressSync(bytes);
  }
  return bytes;
}
function scanBytes(bytes) {
  const admitted = [...markers]
    .filter(([, marker]) => bytes.includes(marker))
    .map(([path]) => path);
  assert.deepEqual(
    admitted,
    [],
    'Forbidden synthetic files reached an inspected context/layer/cache artifact',
  );
}
function scanTree(path) {
  for (const item of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, item.name);
    if (item.isDirectory()) scanTree(child);
    else if (item.isFile()) scanBytes(decoded(readFileSync(child)));
  }
}
function exportContext() {
  const container = String(
    docker(['create', image + '-context', '/not-executed'], {
      stdio: ['ignore', 'pipe', 'inherit'],
      encoding: 'utf8',
    }),
  ).trim();
  ownedContainers.push(container);
  const archive = join(temp, 'context.tar');
  docker(['export', '-o', archive, container]);
  scanBytes(readFileSync(archive));
  const paths = execFileSync('tar', ['-tf', archive], { encoding: 'utf8' }).split('\n');
  for (const path of [
    'package.json',
    'package-lock.json',
    'tsconfig.base.json',
    'apps/ai-service/package.json',
    'apps/ai-service/nest-cli.json',
    'apps/ai-service/tsconfig.json',
    'apps/ai-service/tsconfig.build.json',
    'apps/ai-service/src/main.ts',
    'apps/ai-service/src/encryption/key-ring.config.ts',
    'apps/ai-service/prisma/schema.prisma',
  ])
    assert(paths.includes(path), 'Required build input missing: ' + path);
  assert(
    !paths.some((path) => path.startsWith('apps/ai-service/prisma/migrations/')),
    'Runtime build needs schema only; migrations must stay in the separate migration workflow',
  );
}

try {
  for (const path of [
    'package.json',
    'package-lock.json',
    'tsconfig.base.json',
    'apps/ai-service/package.json',
    'apps/ai-service/nest-cli.json',
    'apps/ai-service/tsconfig.json',
    'apps/ai-service/tsconfig.build.json',
    'apps/ai-service/Dockerfile',
    'apps/ai-service/prisma/schema.prisma',
  ])
    copy(path);
  sourceTree('apps/ai-service/src');
  // A conflicting root ignore proves the Dockerfile-specific file takes precedence.
  if (fallback)
    copyFileSync(join(root, 'apps/ai-service/.dockerignore'), join(temp, '.dockerignore'));
  else {
    copy('apps/ai-service/Dockerfile.dockerignore');
    writeFileSync(join(temp, '.dockerignore'), '**\n');
  }
  const dockerfile = join(temp, 'apps/ai-service/Dockerfile');
  writeFileSync(
    dockerfile,
    readFileSync(dockerfile, 'utf8') + '\nFROM scratch AS context-audit\nCOPY . /\n',
  );
  const names = [
    '.aws/credentials',
    '.aws/config',
    '.npmrc',
    'credentials.json',
    '.env',
    '.env.local',
    '.env.production',
    'nested/.env.private',
    'private.pem',
    'private.key',
    'private.p12',
    'id_rsa',
    'id_ed25519',
    '.config/hidden.ts',
    '.hidden-config',
    'nested/credentials.ini',
    'nested/local-credentials.ts',
    'nested/unexpected.txt',
    'nested/ignored.spec.ts',
  ];
  for (const base of ['', 'apps/ai-service/', 'apps/ai-service/src/', 'apps/ai-service/prisma/']) {
    for (const name of names) {
      const path = base + name;
      const marker = Buffer.from(
        'synthetic-ai-context-' + id + '-' + markers.size + '-fixture-end',
      );
      markers.set(path, marker);
      mkdirSync(dirname(join(temp, path)), { recursive: true });
      writeFileSync(join(temp, path), marker);
    }
  }
  for (const path of [
    'apps/unrelated/src/canary.ts',
    'apps/ai-service/prisma/migrations/canary/migration.sql',
  ]) {
    const marker = Buffer.from('synthetic-ai-context-' + id + '-' + markers.size + '-fixture-end');
    markers.set(path, marker);
    mkdirSync(dirname(join(temp, path)), { recursive: true });
    writeFileSync(join(temp, path), marker);
  }
  const common = ['--platform', 'linux/amd64', '-f', dockerfile];
  docker([
    'build',
    '--no-cache',
    ...common,
    '--target',
    'context-audit',
    '-t',
    image + '-context',
    temp,
  ]);
  exportContext();
  if (!contextOnly) {
    // Fresh complete runtime build; export its BuildKit cache for the same canary scan.
    docker([
      'buildx',
      'build',
      '--load',
      '--no-cache',
      ...common,
      '--cache-to',
      'type=local,mode=max,dest=' + join(temp, 'cache'),
      '--target',
      'runtime',
      '-t',
      image,
      temp,
    ]);
    docker(['build', ...common, '--target', 'builder', '-t', image + '-builder', temp]);
    const archive = join(temp, 'images.tar'),
      unpack = join(temp, 'export');
    mkdirSync(unpack);
    docker(['image', 'save', '-o', archive, image, image + '-builder', image + '-context']);
    execFileSync('tar', ['-xf', archive, '-C', unpack]);
    scanTree(unpack);
    scanTree(join(temp, 'cache'));
    for (const tag of [image, image + '-builder'])
      scanBytes(docker(['history', '--no-trunc', tag], { stdio: 'pipe' }));
    execFileSync(
      process.execPath,
      [join(root, 'apps/ai-service/scripts/verify-container.mjs'), image],
      { stdio: 'inherit', timeout: 180000 },
    );
  }
  console.log(
    JSON.stringify({
      result: 'PASS',
      provider: fallback ? 'root-ignore fallback' : 'Dockerfile-specific ignore precedence',
      syntheticFilesExcluded: markers.size,
      requiredBuildInputsPresent: true,
      fullBuildAndExportedCacheScanned: !contextOnly,
      runtimeHarnessPassed: !contextOnly,
    }),
  );
} finally {
  for (const container of ownedContainers) {
    try {
      docker(['rm', container], { stdio: 'ignore' });
    } catch {}
  }
  for (const tag of [image, image + '-builder', image + '-context']) {
    try {
      docker(['image', 'rm', tag], { stdio: 'ignore' });
    } catch {}
  }
  rmSync(temp, { recursive: true, force: true });
}
