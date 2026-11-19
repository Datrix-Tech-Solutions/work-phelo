import { readFileSync } from 'fs';
import { join } from 'path';

describe('Gateway root-context secret isolation', () => {
  const ignore = readFileSync(
    join(__dirname, '../Dockerfile.dockerignore'),
    'utf8',
  );
  it('defaults deny and allows only the required workspace inputs', () => {
    const lines = ignore
      .split('\n')
      .filter((line) => line && !line.startsWith('#'));
    expect(lines[0]).toBe('**');
    expect(lines).toEqual(
      expect.arrayContaining([
        '!package.json',
        '!package-lock.json',
        '!apps/api-gateway/src/**/*.ts',
        '!packages/config/src/**/*.ts',
      ]),
    );
    expect(lines).not.toContain('!apps/api-gateway/**');
    expect(lines).not.toContain('!packages/**');
    expect(
      lines.filter((line) => line.startsWith('!') && line.endsWith('/')),
    ).toEqual([]);
  });
  it.each([
    '**/.env',
    '**/.env.*',
    '**/.npmrc',
    '**/.aws',
    '**/.ssh',
    '**/*.pem',
    '**/*.key',
    '**/*credentials*',
    '**/node_modules',
    '**/dist',
  ])('denies %s after source inclusions', (pattern) => {
    expect(ignore.lastIndexOf(pattern)).toBeGreaterThan(
      ignore.lastIndexOf('!apps/api-gateway/src/**/*.ts'),
    );
  });
});
