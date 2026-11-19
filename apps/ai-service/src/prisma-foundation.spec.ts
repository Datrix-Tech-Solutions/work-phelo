import { readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from '../prisma/generated/client';

const root = join(__dirname, '..');
const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('AI Prisma persistence foundation', () => {
  it('declares only the AI PostgreSQL datasource and repository-compatible generator', () => {
    expect(schema).toMatch(/provider\s*=\s*"postgresql"/);
    expect(schema).toMatch(/url\s*=\s*env\("DATABASE_URL"\)/);
    expect(schema).toMatch(/schemas\s*=\s*\["ai"\]/);
    expect(schema).toMatch(/provider\s*=\s*"prisma-client-js"/);
    expect(schema).toMatch(/previewFeatures\s*=\s*\["multiSchema"\]/);
    expect(schema).toMatch(/output\s*=\s*"\.\/generated\/client"/);
  });

  it('generates four AI-only models with no plaintext or audit fields', () => {
    expect(Prisma.dmmf.datamodel.models.map((m) => m.name).sort()).toEqual([
      'AiConversation',
      'AiConversationMessage',
      'AiRequestNonce',
      'AiSubmissionReceipt',
    ]);
    for (const model of Prisma.dmmf.datamodel.models) {
      expect(
        model.fields.some((f) => /^(content|prompt|text|body|jwt|token|plaintext)$/i.test(f.name)),
      ).toBe(false);
    }
    const message = Prisma.dmmf.datamodel.models.find((m) => m.name === 'AiConversationMessage')!;
    const relation = message.fields.find((f) => f.name === 'conversation')!;
    expect(relation.relationFromFields).toEqual(['conversationId', 'tenantId', 'ownerUserId']);
    expect(relation.relationOnDelete).toBe('Cascade');
    expect(message.fields.find((f) => f.name === 'ciphertext')?.type).toBe('Bytes');
    expect(
      Prisma.dmmf.datamodel.models
        .find((m) => m.name === 'AiSubmissionReceipt')!
        .fields.some((f) => f.kind === 'object'),
    ).toBe(false);
  });

  it('generates before compilation/tests but never runs migrations on startup', () => {
    expect(manifest.devDependencies.prisma).toBe('5.22.0');
    expect(manifest.scripts['db:validate']).toBe('prisma validate --schema prisma/schema.prisma');
    expect(manifest.dependencies['@prisma/client']).toBe('5.22.0');
    expect(manifest.scripts.prebuild).toBe('npm run db:generate');
    expect(
      Object.values(manifest.scripts).some((command) =>
        /migrate (dev|deploy|reset)|db push/.test(command),
      ),
    ).toBe(false);
  });
});
