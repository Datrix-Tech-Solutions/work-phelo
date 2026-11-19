import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..');
const dockerfile = readFileSync(join(root, 'Dockerfile'), 'utf8');

describe('AI Docker foundation contract', () => {
  it('uses a pinned Node 20 base, locked workspace installs, and production-only dependencies', () => {
    expect(dockerfile).toMatch(/FROM node:20-alpine@sha256:[a-f0-9]{64} AS base/);
    expect(dockerfile.match(/RUN npm ci /g)).toHaveLength(2);
    expect(dockerfile).toContain('--workspace=apps/ai-service --include-workspace-root=false');
    expect(dockerfile).toContain('--omit=dev --ignore-scripts');
    expect(dockerfile).toContain('rm -rf node_modules/prisma node_modules/.bin/prisma');
    expect(dockerfile).not.toMatch(/prisma migrate|DATABASE_URL|API_KEY/);
    expect(dockerfile).toContain('prisma/generated/client');
  });

  it('runs compiled code as non-root with an internal healthcheck and shutdown signal', () => {
    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('EXPOSE 4011');
    expect(dockerfile).toContain('STOPSIGNAL SIGTERM');
    expect(dockerfile).toContain('/api/health');
    expect(dockerfile).toContain('CMD ["node", "dist/main.js"]');
    expect(dockerfile).toContain("find apps/ai-service/dist -type f ! -name '*.js' -delete");
    const runtime = dockerfile.split('FROM base AS runtime')[1];
    expect(runtime).not.toMatch(
      /COPY .*src|COPY .*schema.prisma|COPY .*migrations|COPY .*packages\/|COPY \. /,
    );
  });

  it('keeps the Dockerfile-specific root-context ignore rules aligned and excludes secrets', () => {
    const ignore = readFileSync(join(root, '.dockerignore'), 'utf8');
    expect(readFileSync(join(root, 'Dockerfile.dockerignore'), 'utf8')).toBe(ignore);
    expect(ignore).toMatch(/^\*\*\n/);
    expect(ignore).toContain('**/.env.*');
    expect(ignore).toContain('**/*.spec.ts');
    expect(ignore).not.toMatch(/!.*\.env|!.*work-phelo-web/);
  });

  it.each(['.dockerignore', 'Dockerfile.dockerignore'])(
    'uses only file-level inclusions followed by credential exclusions: %s',
    (file) => {
      const lines = readFileSync(join(root, file), 'utf8').trim().split('\n');
      expect(lines[0]).toBe('**');
      const included = lines.filter((line) => line.startsWith('!'));
      expect(included).toEqual([
        '!package.json',
        '!package-lock.json',
        '!tsconfig.base.json',
        '!apps/ai-service/package.json',
        '!apps/ai-service/nest-cli.json',
        '!apps/ai-service/tsconfig.json',
        '!apps/ai-service/tsconfig.build.json',
        '!apps/ai-service/src/**/*.ts',
        '!apps/ai-service/prisma/schema.prisma',
      ]);
      const lastInclude = Math.max(...included.map((line) => lines.indexOf(line)));
      for (const exclusion of [
        '**/.*',
        '**/*credentials*',
        '**/id_rsa*',
        '**/id_ed25519*',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/.env',
        '**/.env.*',
        '**/*.pem',
        '**/*.key',
        '**/*.p12',
        '**/*.pfx',
      ])
        expect(lines.indexOf(exclusion)).toBeGreaterThan(lastInclude);
      expect(included.some((line) => line.endsWith('/'))).toBe(false);
    },
  );
});
