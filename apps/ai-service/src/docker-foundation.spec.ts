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
    expect(dockerfile).not.toMatch(/prisma (generate|migrate)|DATABASE_URL|API_KEY/);
  });

  it('runs compiled code as non-root with an internal healthcheck and shutdown signal', () => {
    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('EXPOSE 4011');
    expect(dockerfile).toContain('STOPSIGNAL SIGTERM');
    expect(dockerfile).toContain('/api/health');
    expect(dockerfile).toContain('CMD ["node", "dist/main.js"]');
    expect(dockerfile).toContain("find apps/ai-service/dist -type f ! -name '*.js' -delete");
    const runtime = dockerfile.split('FROM base AS runtime')[1];
    expect(runtime).not.toMatch(/COPY .*src|COPY .*prisma|COPY .*packages\/|COPY \. /);
  });

  it('keeps the Dockerfile-specific root-context ignore rules aligned and excludes secrets', () => {
    const ignore = readFileSync(join(root, '.dockerignore'), 'utf8');
    expect(readFileSync(join(root, 'Dockerfile.dockerignore'), 'utf8')).toBe(ignore);
    expect(ignore).toMatch(/^\*\*\n/);
    expect(ignore).toContain('**/.env.*');
    expect(ignore).toContain('**/*.spec.ts');
    expect(ignore).not.toMatch(/!.*\.env|!.*work-phelo-web/);
  });
});
