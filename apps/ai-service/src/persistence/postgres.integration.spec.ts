import { createHash, randomBytes, randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaClient } from '../../prisma/generated/client';
import { TrustedContextService } from '../auth/trusted-context.service';
import { AiDatabaseService, createAiClient } from './ai-database.service';
import { OwnershipContextFactory } from './ownership-context';
import { ConversationsRepository } from './conversations.repository';
import { MessageContextFactory } from '../encryption/message-context';
import { MessageEncryptionService } from '../encryption/message-encryption.service';
import { MessageKeyRing } from '../encryption/key-ring.service';

const databaseUrl = process.env.AI_TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite('Disposable PostgreSQL AI constraints and repository (not mocks)', () => {
  let db: PrismaClient;
  let service: AiDatabaseService;
  let repository: ConversationsRepository;
  const future = () => new Date(Date.now() + 3600000);
  function testConfig(url: string): ConfigService {
    // Never let an inherited shell DATABASE_URL override this disposable test target.
    const values: Record<string, unknown> = { AI_PERSISTENCE_ENABLED: true, DATABASE_URL: url };
    return { get: (key: string) => values[key] } as ConfigService;
  }
  function owner(tenantId: string = randomUUID(), id: string = randomUUID()) {
    // Authentication itself is covered by Phase 2A; only this identity adapter is mocked.
    const factory = new OwnershipContextFactory({
      verifyRequest: () => ({ tenantId, id }),
    } as unknown as TrustedContextService);
    return { tenantId, ownerUserId: id, context: factory.fromRequest({} as Request) };
  }
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.pathname !== '/workphelo_ai_2b1' ||
      url.searchParams.get('schema') !== 'ai'
    )
      throw new Error('Only the disposable AI database is allowed');
    db = createAiClient(databaseUrl!);
    const result = await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    expect(result[0].name).toBe('workphelo_ai_2b1');
    service = new AiDatabaseService(testConfig(databaseUrl!), createAiClient);
    await service.onModuleInit();
    repository = new ConversationsRepository(service);
  });
  afterAll(async () => {
    await service?.onModuleDestroy();
    await db?.$disconnect();
  });

  it('creates and reads only owned, non-expired metadata', async () => {
    const a = owner(),
      b = owner(),
      sameTenantOtherUser = owner(a.tenantId);
    const conversation = await repository.create(a.context);
    expect(await repository.findOwned(a.context, conversation.id)).toEqual(conversation);
    for (const outsider of [b, sameTenantOtherUser]) {
      expect(await repository.findOwned(outsider.context, conversation.id)).toBeNull();
      expect(await repository.listOwned(outsider.context)).toEqual([]);
      await expect(repository.requireOwned(outsider.context, conversation.id)).rejects.toThrow(
        'Conversation not found',
      );
    }
    expect(await repository.findOwned(a.context, randomUUID())).toBeNull();
    expect(Object.keys(conversation).sort()).toEqual(['createdAt', 'expiresAt', 'id', 'updatedAt']);
  });
  it('supports opaque existing Auth identifiers without permitting ownership substitution', async () => {
    const a = owner('opaque-auth-tenant', 'opaque-auth-user');
    const c = await repository.create(a.context);
    expect(await repository.findOwned(a.context, c.id)).toEqual(c);
    expect(
      await repository.findOwned(owner('other-tenant', 'opaque-auth-user').context, c.id),
    ).toBeNull();
  });
  it('filters expired rows and deterministically bounds lists', async () => {
    const a = owner();
    const { context, ...identity } = a;
    const old = await db.aiConversation.create({
      data: {
        ...identity,
        createdAt: new Date(Date.now() - 7200000),
        expiresAt: new Date(Date.now() - 3600000),
      },
    });
    expect(await repository.findOwned(context, old.id)).toBeNull();
    await repository.create(context);
    await repository.create(context);
    expect(await repository.listOwned(context, 1)).toHaveLength(1);
    expect((await repository.listOwned(context)).some((row) => row.id === old.id)).toBe(false);
    const fixed = await repository.create(context);
    expect(fixed.expiresAt.getTime() - fixed.createdAt.getTime()).toBe(720 * 3600000);
  });
  async function fixtureMessage() {
    const a = owner();
    const conversation = await repository.create(a.context);
    return {
      a,
      conversation,
      data: {
        conversationId: conversation.id,
        tenantId: a.tenantId,
        ownerUserId: a.ownerUserId,
        sequence: 1,
        encryptionVersion: 1,
        keyId: 'test-envelope-only',
        ciphertext: randomBytes(32),
        nonce: randomBytes(12),
        authenticationTag: randomBytes(16),
      },
    };
  }
  it('enforces the composite ownership FK and cascades only child messages', async () => {
    const { a, conversation, data } = await fixtureMessage();
    await expect(
      db.aiConversationMessage.create({ data: { ...data, tenantId: randomUUID() } }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db.aiConversationMessage.create({ data: { ...data, ownerUserId: randomUUID() } }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await db.aiConversationMessage.create({ data });
    const receipt = await db.aiSubmissionReceipt.create({
      data: {
        tenantId: a.tenantId,
        ownerUserId: a.ownerUserId,
        operation: 'APPEND_MESSAGE',
        idempotencyKey: randomUUID(),
        fingerprintVersion: 1,
        fingerprintKeyId: 'test',
        requestFingerprint: randomBytes(32),
        resultConversationId: conversation.id,
        outcome: 'STORED',
        expiresAt: future(),
      },
    });
    await db.aiConversation.delete({ where: { id: conversation.id } });
    expect(
      await db.aiConversationMessage.count({ where: { conversationId: conversation.id } }),
    ).toBe(0);
    expect(await db.aiSubmissionReceipt.findUnique({ where: { id: receipt.id } })).not.toBeNull();
    expect(await repository.findOwned(a.context, conversation.id)).toBeNull();
  });
  it('enforces message sequence, nonce uniqueness and envelope checks', async () => {
    const { data } = await fixtureMessage();
    await db.aiConversationMessage.create({ data });
    await expect(
      db.aiConversationMessage.create({ data: { ...data, nonce: randomBytes(12) } }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      db.aiConversationMessage.create({ data: { ...data, sequence: 2 } }),
    ).rejects.toMatchObject({ code: 'P2002' });
    for (const invalid of [
      { sequence: 0 },
      { nonce: Buffer.alloc(1) },
      { authenticationTag: Buffer.alloc(1) },
      { encryptionVersion: 0 },
      { ciphertext: Buffer.alloc(0) },
    ]) {
      await expect(
        db.aiConversationMessage.create({
          data: { ...data, sequence: 2, nonce: randomBytes(12), ...invalid },
        }),
      ).rejects.toThrow();
    }
  });
  it('keeps expiry/identity fixed and sequence monotonic at the SQL boundary', async () => {
    const a = owner();
    const c = await repository.create(a.context);
    for (const data of [
      { expiresAt: new Date(c.expiresAt.getTime() + 1000) },
      { ownerUserId: randomUUID() },
      { tenantId: randomUUID() },
      { nextMessageSequence: 0 },
    ]) {
      await expect(db.aiConversation.update({ where: { id: c.id }, data })).rejects.toThrow();
    }
    await db.aiConversation.update({ where: { id: c.id }, data: { nextMessageSequence: 2 } });
    await expect(
      db.aiConversation.update({ where: { id: c.id }, data: { nextMessageSequence: 1 } }),
    ).rejects.toThrow();
  });
  it('enforces receipt scope and versioned fingerprint bounds, including simultaneous duplicates', async () => {
    const a = owner();
    const data = {
      tenantId: a.tenantId,
      ownerUserId: a.ownerUserId,
      operation: 'CREATE_CONVERSATION' as const,
      idempotencyKey: randomUUID(),
      fingerprintVersion: 1,
      fingerprintKeyId: 'test',
      requestFingerprint: randomBytes(32),
      resultConversationId: randomUUID(),
      outcome: 'STORED' as const,
      expiresAt: future(),
    };
    const results = await Promise.allSettled([
      db.aiSubmissionReceipt.create({ data }),
      db.aiSubmissionReceipt.create({ data }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { code: 'P2002' },
    });
    for (const change of [
      { tenantId: randomUUID() },
      { ownerUserId: randomUUID() },
      { operation: 'DELETE_CONVERSATION' as const },
    ])
      await db.aiSubmissionReceipt.create({ data: { ...data, ...change } });
    await expect(
      db.aiSubmissionReceipt.create({ data: { ...data, idempotencyKey: 'bad key' } }),
    ).rejects.toThrow();
    await expect(
      db.aiSubmissionReceipt.create({
        data: { ...data, idempotencyKey: randomUUID(), requestFingerprint: Buffer.alloc(1) },
      }),
    ).rejects.toThrow();
  });
  it('has no columns or foreign keys in other domain schemas', async () => {
    const columns = await db.$queryRaw<
      { column_name: string }[]
    >`SELECT column_name FROM information_schema.columns WHERE table_schema = 'ai'`;
    expect(columns.some((c) => /^(content|prompt|plaintext|token|body)$/.test(c.column_name))).toBe(
      false,
    );
    const foreign = await db.$queryRaw<
      { target: string }[]
    >`SELECT rn.nspname AS target FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_class rt ON rt.oid=c.confrelid JOIN pg_namespace rn ON rn.oid=rt.relnamespace WHERE c.contype='f' AND n.nspname='ai'`;
    expect(foreign.every((row) => row.target === 'ai')).toBe(true);
  });
  it('stores only a real authenticated envelope through test-only inserts and detects substitution', async () => {
    const a = owner();
    const conversation = await repository.create(a.context);
    const material = Buffer.alloc(32, 51); // Test-only key, never a production default.
    const id = createHash('sha256').update(material).digest('hex');
    const values: Record<string, unknown> = {
      AI_MESSAGE_ENCRYPTION_ENABLED: true,
      AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID: id,
      AI_MESSAGE_ENCRYPTION_KEYS: JSON.stringify([{ id, key: material.toString('base64') }]),
    };
    const ring = new MessageKeyRing({ get: (name: string) => values[name] } as ConfigService);
    const encryption = new MessageEncryptionService(ring),
      contexts = new MessageContextFactory();
    const messageId = randomUUID();
    const metadata = {
      conversationId: conversation.id,
      messageId,
      role: 'USER' as const,
      sequence: 1,
    };
    const context = contexts.forMessage(a.context, metadata);
    const plaintext = 'private-database-plaintext-canary 🌍';
    const envelope = encryption.encryptMessage(plaintext, context);
    const data = {
      id: messageId,
      conversationId: conversation.id,
      tenantId: a.tenantId,
      ownerUserId: a.ownerUserId,
      sequence: 1,
      ...envelope,
    };
    await db.aiConversationMessage.create({ data });
    const stored = await db.aiConversationMessage.findUniqueOrThrow({
      where: { id: messageId },
      select: {
        encryptionVersion: true,
        keyId: true,
        ciphertext: true,
        nonce: true,
        authenticationTag: true,
      },
    });
    expect(encryption.decryptMessage(stored, context)).toBe(plaintext);
    expect(stored.ciphertext.equals(Buffer.from(plaintext))).toBe(false);
    expect(Object.keys(stored).sort()).toEqual([
      'authenticationTag',
      'ciphertext',
      'encryptionVersion',
      'keyId',
      'nonce',
    ]);
    expect(() =>
      encryption.decryptMessage(stored, contexts.forMessage(owner().context, metadata)),
    ).toThrow('AI message encryption operation failed');
    await expect(
      db.aiConversationMessage.create({
        data: { ...data, id: randomUUID(), sequence: 2, nonce: Buffer.alloc(1) },
      }),
    ).rejects.toThrow();
    await expect(
      db.aiConversationMessage.create({
        data: {
          ...data,
          id: randomUUID(),
          sequence: 2,
          nonce: randomBytes(12),
          authenticationTag: Buffer.alloc(1),
        },
      }),
    ).rejects.toThrow();
    expect(await repository.findOwned(a.context, conversation.id)).not.toHaveProperty('messages');
  });
  it('sanitizes a real driver connection failure without requiring other services', async () => {
    const url = new URL(databaseUrl!);
    url.port = '1';
    url.searchParams.set('connect_timeout', '1');
    const unavailable = new AiDatabaseService(testConfig(url.toString()), createAiClient);
    await expect(unavailable.onModuleInit()).rejects.toThrow('Persistence unavailable');
    await unavailable.onModuleDestroy();
  });
  it('uses the intended indexes and a restricted AI role cannot read another schema', async () => {
    const indexes = await db.$queryRaw<
      { indexname: string }[]
    >`SELECT indexname FROM pg_indexes WHERE schemaname='ai'`;
    expect(indexes.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'AiConversation_owned_list_idx',
        'AiConversation_expiry_idx',
        'AiConversation_ownership_key',
        'AiMessage_sequence_key',
        'AiMessage_key_nonce_key',
        'AiReceipt_idempotency_key',
      ]),
    );
    const role = `ai_2b1_${randomUUID().replace(/-/g, '')}`;
    // Identifiers originate only from a generated UUID in this disposable test cluster.
    await db.$executeRawUnsafe(`CREATE ROLE "${role}" LOGIN PASSWORD 'local-runtime-test-only'`);
    await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA ai TO "${role}"`);
    await db.$executeRawUnsafe(
      `GRANT SELECT,INSERT,UPDATE,DELETE ON ai."AiConversation",ai."AiConversationMessage",ai."AiSubmissionReceipt" TO "${role}"`,
    );
    await db.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS unrelated_domain');
    await db.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS unrelated_domain.marker (id integer)');
    const url = new URL(databaseUrl!);
    url.username = role;
    url.password = 'local-runtime-test-only';
    const runtime = createAiClient(url.toString());
    try {
      expect(await runtime.aiConversation.count()).toBeGreaterThan(0);
      await expect(
        runtime.$queryRawUnsafe('SELECT * FROM unrelated_domain.marker'),
      ).rejects.toThrow();
      await expect(
        runtime.$executeRawUnsafe('CREATE TABLE ai.forbidden_ddl (id integer)'),
      ).rejects.toThrow();
      await expect(
        runtime.$queryRawUnsafe('SELECT * FROM ai._prisma_migrations'),
      ).rejects.toThrow();
    } finally {
      await runtime.$disconnect();
    }
    const plan = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
      return tx.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
        'EXPLAIN SELECT id FROM ai."AiConversation" WHERE "tenantId"=\'11111111-1111-4111-8111-111111111111\' AND "ownerUserId"=\'22222222-2222-4222-8222-222222222222\' AND "expiresAt">clock_timestamp() ORDER BY "createdAt" DESC,id DESC LIMIT 20',
      );
    });
    expect(JSON.stringify(plan)).toContain('AiConversation_owned_list_idx');
  });
});
