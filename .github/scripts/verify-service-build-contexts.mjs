import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

const repo = fileURLToPath(new URL('../../', import.meta.url));
function run(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
}
function walk(root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
for (const service of [
  'accounting-service',
  'marketing-service',
  'inventory-service',
  'subscription-service',
  'api-gateway',
  'auth-service',
  'hr-service',
  'notification-service',
  'reinsurance-service',
]) {
  const root = mkdtempSync(join(tmpdir(), 'workphelo-context-test-'));
  const context = join(root, 'context');
  const marker = 'WORKPHELO_SYNTHETIC_SECRET_' + randomUUID();
  const put = (path, value) => {
    mkdirSync(join(context, path, '..'), { recursive: true });
    writeFileSync(join(context, path), value);
  };
  try {
    const rules = readFileSync(join(repo, 'apps', service, 'Dockerfile.dockerignore'), 'utf8');
    // A permissive root ignore proves the Dockerfile-specific rules take precedence.
    put('.dockerignore', '');
    put('Probe.Dockerfile.dockerignore', rules);
    put(
      'Probe.Dockerfile',
      'FROM scratch AS builder\nCOPY . /proof\nFROM scratch\nCOPY --from=builder /proof /proof\n',
    );
    put('package.json', '{}');
    put('package-lock.json', '{}');
    put('tsconfig.base.json', '{}');
    for (const name of ['types', 'config', 'internal-auth', 'schemas', 'utils'])
      put(`packages/${name}/src/index.ts`, 'export {};');
    put(`apps/${service}/src/main.ts`, 'export {};');
    put(`apps/${service}/prisma/schema.prisma`, '// fixture');
    for (const secret of [
      '.env',
      '.env.prod',
      '.env.dev',
      '.env.production',
      '.npmrc',
      '.netrc',
      '.aws/credentials',
      '.ssh/id_rsa',
      '.azure/accessTokens.json',
      '.config/gcloud/application_default_credentials.json',
      'private-key.pem',
      'token.key',
      'cloud-credentials.json',
    ]) {
      put(`apps/${service}/src/nested/${secret}`, marker);
      put(`packages/config/nested/${secret}`, marker);
    }
    put('apps/unapproved-service/src/main.ts', marker);
    const output = join(root, 'final');
    const cache = join(root, 'cache');
    run([
      'buildx',
      'build',
      '--platform',
      'linux/amd64',
      '-f',
      join(context, 'Probe.Dockerfile'),
      '--cache-to',
      `type=local,dest=${cache},mode=max`,
      '--output',
      `type=local,dest=${output}`,
      context,
    ]);
    assert(statSync(join(output, 'proof/apps', service, 'src/main.ts')).isFile());
    assert(statSync(join(output, 'proof/packages/types/src/index.ts')).isFile());
    for (const file of walk(output))
      assert(
        !readFileSync(file).includes(Buffer.from(marker)),
        `Canary in exported final filesystem: ${file}`,
      );
    for (const file of walk(join(cache, 'blobs'))) {
      const bytes = readFileSync(file);
      const data = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
      assert(
        !data.includes(Buffer.from(marker)),
        'Canary in exported max-mode builder/final cache layer',
      );
    }
    console.log(`${service}: AMD64 synthetic builder/final/max-cache credential exclusion PASS`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
