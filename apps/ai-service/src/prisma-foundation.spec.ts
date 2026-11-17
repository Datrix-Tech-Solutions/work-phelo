import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..');
const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('AI Prisma configuration-only foundation', () => {
  it('declares only the AI PostgreSQL datasource and repository-compatible generator', () => {
    expect(schema).toMatch(/provider\s*=\s*"postgresql"/);
    expect(schema).toMatch(/url\s*=\s*env\("DATABASE_URL"\)/);
    expect(schema).toMatch(/schemas\s*=\s*\["ai"\]/);
    expect(schema).toMatch(/provider\s*=\s*"prisma-client-js"/);
    expect(schema).toMatch(/previewFeatures\s*=\s*\["multiSchema"\]/);
    expect(schema).toMatch(/output\s*=\s*"\.\/generated\/client"/);
  });

  it('does not introduce models, migrations, or generated runtime persistence', () => {
    expect(schema).not.toMatch(/^\s*(model|enum|view|type)\s+/m);
    expect(existsSync(join(root, 'prisma/migrations'))).toBe(false);
    expect(existsSync(join(root, 'prisma/generated'))).toBe(false);
    expect(manifest.dependencies['@prisma/client']).toBeUndefined();
    expect(readFileSync(join(__dirname, 'app.module.ts'), 'utf8')).not.toMatch(/Prisma/);
  });

  it('declares validation tooling without generation, migration or startup hooks', () => {
    expect(manifest.devDependencies.prisma).toBe('5.22.0');
    expect(manifest.scripts['db:validate']).toBe('prisma validate --schema prisma/schema.prisma');
    expect(manifest.scripts['db:generate']).toBeUndefined();
    expect(
      Object.entries(manifest.scripts)
        .filter(([name]) => name !== 'db:validate')
        .some(([name, command]) => /migrat|generat/.test(name) || /prisma|db:/.test(command)),
    ).toBe(false);
  });
});
