import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { Request } from 'express';
import request from 'supertest';
import { createApplication } from '../main';
import { Prisma, PrismaClient } from '../../prisma/generated/client';
import { TrustedContextService } from '../auth/trusted-context.service';
import { PRODUCT_GUIDANCE_CATALOG } from '../inference/demo-guidance';
import { parseRuntimeEnv } from '../config/runtime-env';
import { MessageContextFactory } from '../encryption/message-context';
import { MessageEncryptionService } from '../encryption/message-encryption.service';
import { MessageKeyRing } from '../encryption/key-ring.service';
import { AiDatabaseService, createAiClient } from './ai-database.service';
import { ConversationsRepository } from './conversations.repository';
import { RetentionCleanupService } from './retention-cleanup.service';
import { ConversationOperationError } from './conversation-operation.error';
import { ConversationOperationsService } from './conversation-operations.service';
import { OwnershipContext, OwnershipContextFactory, requireOwnership } from './ownership-context';
import { SubmissionFingerprintService } from './submission-fingerprint.service';

// Fixed material is exclusively a local test fixture, never runtime defaults.
export function operationConfig(extra: Record<string, unknown> = {}) {
  const entry = (n: number) => {
    const material = Buffer.alloc(32, n);
    return {
      id: createHash('sha256').update(material).digest('hex'),
      key: material.toString('base64'),
    };
  };
  const encryption = entry(61),
    fingerprint = entry(62),
    historical = entry(63);
  const values = {
    NODE_ENV: 'test',
    AI_PROVIDER: 'mock',
    AI_POLICY_VERSION: 'test-v1',
    AI_PERSISTENCE_ENABLED: true,
    AI_MESSAGE_ENCRYPTION_ENABLED: true,
    AI_MESSAGE_OPERATIONS_ENABLED: true,
    DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/workphelo_ai_2b1?schema=ai',
    AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID: encryption.id,
    AI_MESSAGE_ENCRYPTION_KEYS: JSON.stringify([encryption]),
    AI_FINGERPRINT_ACTIVE_KEY_ID: fingerprint.id,
    AI_FINGERPRINT_KEYS: JSON.stringify([fingerprint, historical]),
    ...extra,
  };
  return {
    values,
    config: { get: (name: string) => values[name as keyof typeof values] } as ConfigService,
    encryption,
    fingerprint,
    historical,
  };
}

export function operationOwner(tenantId = 'tenant-a', id = 'user-a') {
  return new OwnershipContextFactory({
    verifyRequest: () => ({ tenantId, id }),
  } as unknown as TrustedContextService).fromRequest({} as Request);
}

describe('Internal conversation operations configuration and failures (unit fixtures)', () => {
  const input = {
    tenantId: 'tenant-a',
    ownerUserId: 'user-a',
    conversationId: 'conversation',
    content: ' exact 🌍 ',
  };
  it('defaults operations off without keys, persistence or inference', () => {
    expect(
      parseRuntimeEnv({ NODE_ENV: 'test', AI_PROVIDER: 'mock', AI_POLICY_VERSION: 'v1' }),
    ).toMatchObject({
      AI_MESSAGE_OPERATIONS_ENABLED: false,
      AI_PERSISTENCE_ENABLED: false,
      AI_MESSAGE_ENCRYPTION_ENABLED: false,
      AI_ENABLED: false,
    });
  });
  it('accepts explicitly enabled independent fingerprint keys', () => {
    const { values } = operationConfig();
    expect(
      parseRuntimeEnv(
        Object.fromEntries(
          Object.entries(values).map(([k, v]) => [k, typeof v === 'boolean' ? String(v) : v]),
        ),
      ),
    ).toMatchObject({ AI_MESSAGE_OPERATIONS_ENABLED: true });
  });
  it.each([
    { AI_PERSISTENCE_ENABLED: false },
    { AI_MESSAGE_ENCRYPTION_ENABLED: false },
    { AI_FINGERPRINT_KEYS: undefined },
    { AI_FINGERPRINT_KEYS: 'not-json-private-canary' },
    { AI_FINGERPRINT_ACTIVE_KEY_ID: 'unknown' },
    { AI_FINGERPRINT_KEYS: '[]' },
  ])('rejects incomplete enabled config without disclosing values', (extra) => {
    const { config } = operationConfig(extra);
    expect(() => new SubmissionFingerprintService(config)).toThrow(
      'Conversation operation unavailable',
    );
  });
  it('rejects fingerprint material reused from encryption or JWT', () => {
    const base = operationConfig();
    for (const extra of [
      {
        AI_FINGERPRINT_ACTIVE_KEY_ID: base.encryption.id,
        AI_FINGERPRINT_KEYS: JSON.stringify([base.encryption]),
      },
      { JWT_SECRET: base.fingerprint.key },
    ])
      expect(() => new SubmissionFingerprintService(operationConfig(extra).config)).toThrow(
        'Conversation operation unavailable',
      );
  });
  it('validates fingerprint version, exact bytes, ownership and all domain fields', () => {
    const service = new SubmissionFingerprintService(operationConfig().config);
    const receipt = service.create(input);
    expect(receipt.requestFingerprint).toHaveLength(32);
    expect(() => service.verify(input, receipt)).not.toThrow();
    for (const change of [
      { tenantId: 'b' },
      { ownerUserId: 'b' },
      { conversationId: 'b' },
      { content: 'exact 🌍' },
    ])
      expect(() => service.verify({ ...input, ...change }, receipt)).toThrow(
        'Idempotency key conflict',
      );
    expect(() => service.verify(input, { ...receipt, fingerprintVersion: 2 })).toThrow(
      'Conversation operation unavailable',
    );
    expect(() =>
      service.verify(input, { ...receipt, requestFingerprint: Buffer.alloc(1) }),
    ).toThrow('Conversation operation unavailable');
  });
  it('writes with the new active key but verifies receipts with their historical key', () => {
    const fixture = operationConfig();
    const old = new SubmissionFingerprintService(fixture.config);
    const receipt = old.create(input);
    const next = new SubmissionFingerprintService(
      operationConfig({ AI_FINGERPRINT_ACTIVE_KEY_ID: fixture.historical.id }).config,
    );
    expect(next.create(input).fingerprintKeyId).toBe(fixture.historical.id);
    expect(() => next.verify(input, receipt)).not.toThrow();
    const lost = new SubmissionFingerprintService(
      operationConfig({
        AI_FINGERPRINT_ACTIVE_KEY_ID: fixture.historical.id,
        AI_FINGERPRINT_KEYS: JSON.stringify([fixture.historical]),
      }).config,
    );
    expect(() => lost.verify(input, receipt)).toThrow('Conversation operation unavailable');
  });
  function operations(enabled = true) {
    const transaction = jest.fn();
    const { config } = operationConfig({ AI_MESSAGE_OPERATIONS_ENABLED: enabled });
    const service = new ConversationOperationsService(
      { transaction } as unknown as AiDatabaseService,
      new SubmissionFingerprintService(config),
      new MessageEncryptionService(new MessageKeyRing(config)),
      new MessageContextFactory(),
    );
    return { service, transaction };
  }
  it('rejects forged owner context before touching database', async () => {
    const { service, transaction } = operations();
    await expect(
      service.appendUserMessage({} as OwnershipContext, 'x', 'text', 'key'),
    ).rejects.toThrow('Unauthorized');
    await expect(service.readOwnedMessagePage({} as OwnershipContext, 'x')).rejects.toThrow(
      'Unauthorized',
    );
    await expect(service.deleteOwned({} as OwnershipContext, 'x')).rejects.toThrow('Unauthorized');
    expect(transaction).not.toHaveBeenCalled();
  });
  it.each(['', 'x'.repeat(16385), '\ud800'])(
    'rejects invalid plaintext without opening a transaction',
    async (content) => {
      const { service, transaction } = operations();
      await expect(
        service.appendUserMessage(
          operationOwner(),
          '11111111-1111-4111-8111-111111111111',
          content,
          'key',
        ),
      ).rejects.toThrow('Invalid conversation operation');
      expect(transaction).not.toHaveBeenCalled();
    },
  );
  it.each(['', ' bad', 'key space', 'a'.repeat(129)])('rejects invalid opaque key', async (key) => {
    const { service, transaction } = operations();
    await expect(
      service.appendUserMessage(
        operationOwner(),
        '11111111-1111-4111-8111-111111111111',
        'text',
        key,
      ),
    ).rejects.toThrow('Invalid conversation operation');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('blocks all plaintext-capable operations in disabled mode', async () => {
    const { service, transaction } = operations(false),
      owner = operationOwner();
    await expect(service.appendUserMessage(owner, 'x', 'text', 'key')).rejects.toThrow(
      'Conversation operation unavailable',
    );
    await expect(service.readOwnedMessagePage(owner, 'x')).rejects.toThrow(
      'Conversation operation unavailable',
    );
    await expect(service.deleteOwned(owner, 'x')).rejects.toThrow(
      'Conversation operation unavailable',
    );
    expect(transaction).not.toHaveBeenCalled();
  });
  it.each([
    [-1, 20],
    [0, 0],
    [0, 101],
    [0, 1.5],
  ])('bounds message pagination', async (after, limit) => {
    const { service, transaction } = operations();
    await expect(service.readOwnedMessagePage(operationOwner(), 'x', after, limit)).rejects.toThrow(
      'Invalid conversation operation',
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe('Bounded transaction failures and retries (unit fixtures)', () => {
  async function database() {
    const tx = { $queryRaw: jest.fn() };
    const client = { $connect: jest.fn(), $disconnect: jest.fn(), $transaction: jest.fn() };
    const service = new AiDatabaseService(
      operationConfig().config,
      () => client as unknown as PrismaClient,
    );
    await service.onModuleInit();
    return { service, client, tx };
  }
  it('retries only recognized transient errors with bounded transaction options', async () => {
    const { service, client, tx } = await database();
    client.$transaction
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('private-driver', {
          code: 'P2034',
          clientVersion: '5.22.0',
        }),
      )
      .mockImplementationOnce((fn: (tx: unknown) => unknown) => fn(tx));
    expect(await service.transaction(() => Promise.resolve(42))).toBe(42);
    expect(client.$transaction).toHaveBeenCalledTimes(2);
    expect(client.$transaction).toHaveBeenLastCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'ReadCommitted' }),
    );
    const calls = client.$transaction.mock.calls as unknown as [
      unknown,
      { maxWait: number; timeout: number },
    ][];
    const options = calls[1][1];
    expect(options.maxWait + options.timeout).toBeLessThan(5000);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it('never retries arbitrary database/network failures or leaks driver details', async () => {
    const { service, client } = await database();
    client.$transaction.mockRejectedValue(new Error('credential-and-sql-canary'));
    await expect(service.transaction(() => Promise.resolve(null))).rejects.toThrow(
      'Conversation operation unavailable',
    );
    expect(client.$transaction).toHaveBeenCalledTimes(1);
  });
  it('caps serialization retries and preserves safe non-disclosing domain errors', async () => {
    const { service, client } = await database();
    client.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('private', {
        code: 'P2034',
        clientVersion: '5.22.0',
      }),
    );
    await expect(service.transaction(() => Promise.resolve(null))).rejects.toThrow(
      'Conversation operation unavailable',
    );
    expect(client.$transaction).toHaveBeenCalledTimes(3);
    client.$transaction.mockReset().mockRejectedValue(new ConversationOperationError(404));
    await expect(service.transaction(() => Promise.resolve(null))).rejects.toMatchObject({
      status: 404,
    });
    expect(client.$transaction).toHaveBeenCalledTimes(1);
  });
  it.each(['40001', '40P01'])('recognizes raw PostgreSQL transient code %s', async (code) => {
    const { service, client, tx } = await database();
    client.$transaction
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('private SQL', {
          code: 'P2010',
          clientVersion: '5.22.0',
          meta: { code },
        }),
      )
      .mockImplementationOnce((fn: (tx: unknown) => unknown) => fn(tx));
    expect(await service.transaction(() => Promise.resolve(1))).toBe(1);
    expect(client.$transaction).toHaveBeenCalledTimes(2);
  });
});

const testDatabaseUrl = process.env.AI_TEST_DATABASE_URL;
(testDatabaseUrl ? describe : describe.skip)(
  'Transactional operations on disposable PostgreSQL (real locks, not mocks)',
  () => {
    let db: PrismaClient;
    let database: AiDatabaseService;
    let metadata: ConversationsRepository;
    let operations: ConversationOperationsService;
    let config: ConfigService;
    const [firstQuestion, secondQuestion, thirdQuestion] = PRODUCT_GUIDANCE_CATALOG.entries.map(
      ({ question }) => question,
    );
    const newOwner = () => operationOwner(randomUUID(), randomUUID());
    const makeOperations = (settings = config) =>
      new ConversationOperationsService(
        database,
        new SubmissionFingerprintService(settings),
        new MessageEncryptionService(new MessageKeyRing(settings)),
        new MessageContextFactory(),
      );
    beforeAll(async () => {
      const url = new URL(testDatabaseUrl!);
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        url.pathname !== '/workphelo_ai_2b1' ||
        url.searchParams.get('schema') !== 'ai'
      )
        throw new Error('Only disposable AI PostgreSQL is allowed');
      config = operationConfig({ DATABASE_URL: testDatabaseUrl! }).config;
      db = createAiClient(testDatabaseUrl!);
      await db.$connect();
      database = new AiDatabaseService(config, createAiClient);
      await database.onModuleInit();
      metadata = new ConversationsRepository(database);
      operations = makeOperations();
    });
    afterAll(async () => {
      await database?.onModuleDestroy();
      await db?.$disconnect();
    });

    async function fixture() {
      const owner = newOwner();
      const conversation = await metadata.create(owner);
      return { owner, conversation };
    }
    async function appendFixture(content = firstQuestion) {
      const f = await fixture();
      const message = await operations.appendUserMessage(
        f.owner,
        f.conversation.id,
        content,
        randomUUID(),
      );
      return { ...f, message };
    }
    it('replays a pre-screening receipt with exact legacy Unicode and whitespace, and rejects changed input', async () => {
      const content = '  \ufeffprivate-exact-content\n🌍 e\u0301  ';
      const { owner, conversation } = await fixture();
      const identity = requireOwnership(owner);
      const conversationId = conversation.id;
      const messageId = randomUUID();
      const sequence = 1;
      const role = 'USER';
      const idempotencyKey = randomUUID();
      const context = new MessageContextFactory().forMessage(owner, {
        conversationId,
        messageId,
        role,
        sequence,
      });
      const envelope = new MessageEncryptionService(new MessageKeyRing(config)).encryptMessage(
        content,
        context,
      );
      const fingerprint = new SubmissionFingerprintService(config).create({
        ...identity,
        conversationId,
        content,
      });
      const stored = await db.$transaction(async (tx) => {
        const message = await tx.aiConversationMessage.create({
          data: { ...identity, id: messageId, conversationId, role, sequence, ...envelope },
        });
        await tx.aiConversation.update({
          where: { id: conversationId },
          data: { nextMessageSequence: 2 },
        });
        await tx.aiSubmissionReceipt.create({
          data: {
            ...identity,
            ...fingerprint,
            idempotencyKey,
            resultConversationId: conversationId,
            resultMessageId: message.id,
            operation: 'APPEND_MESSAGE',
            outcome: 'STORED',
            createdAt: message.createdAt,
            expiresAt: new Date(message.createdAt.getTime() + 720 * 3600000),
          },
        });
        return message;
      });
      expect(stored.ciphertext.equals(Buffer.from(content))).toBe(false);
      expect(
        await operations.appendUserMessage(owner, conversationId, content, idempotencyKey),
      ).toEqual({ id: messageId, conversationId, sequence, role, createdAt: stored.createdAt });
      await expect(
        operations.appendUserMessage(owner, conversationId, content.trim(), idempotencyKey),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        operations.appendUserMessage(owner, conversationId, content, randomUUID()),
      ).rejects.toMatchObject({ status: 400 });
      expect(await db.aiConversationMessage.count({ where: { conversationId } })).toBe(1);
      expect(
        await db.aiSubmissionReceipt.count({ where: { resultConversationId: conversationId } }),
      ).toBe(1);
      expect((await operations.readOwnedMessagePage(owner, conversationId)).items[0].content).toBe(
        content,
      );
    });
    it('returns non-disclosing 404 for foreign tenant, foreign owner, malformed and missing IDs across all operations', async () => {
      const { owner, conversation } = await appendFixture();
      const foreign = [newOwner(), operationOwner(requireOwnership(owner).tenantId, 'other-user')];
      for (const context of foreign) {
        for (const action of [
          () => operations.appendUserMessage(context, conversation.id, 'x', randomUUID()),
          () => operations.readOwnedMessagePage(context, conversation.id),
          () => operations.deleteOwned(context, conversation.id),
        ])
          await expect(action()).rejects.toMatchObject({ status: 404 });
      }
      for (const id of ['malformed', randomUUID()]) {
        await expect(operations.appendUserMessage(owner, id, 'x', 'key')).rejects.toMatchObject({
          status: 404,
        });
        await expect(operations.readOwnedMessagePage(owner, id)).rejects.toMatchObject({
          status: 404,
        });
        await expect(operations.deleteOwned(owner, id)).rejects.toMatchObject({ status: 404 });
      }
      expect(
        await db.aiConversationMessage.count({ where: { conversationId: conversation.id } }),
      ).toBe(1);
    });
    it('returns original authorized result on matching retry without advancing sequence', async () => {
      const { owner, conversation } = await fixture(),
        key = randomUUID();
      const first = await operations.appendUserMessage(owner, conversation.id, firstQuestion, key);
      expect(
        await operations.appendUserMessage(owner, conversation.id, firstQuestion, key),
      ).toEqual(first);
      expect(
        (await db.aiConversation.findUniqueOrThrow({ where: { id: conversation.id } }))
          .nextMessageSequence,
      ).toBe(2);
      expect(
        await db.aiSubmissionReceipt.count({ where: { resultConversationId: conversation.id } }),
      ).toBe(1);
    });
    it('rejects changed payload and cross-conversation reuse with 409', async () => {
      const { owner, conversation } = await fixture(),
        key = randomUUID();
      await operations.appendUserMessage(owner, conversation.id, firstQuestion, key);
      await expect(
        operations.appendUserMessage(owner, conversation.id, 'original', key),
      ).rejects.toMatchObject({ status: 409 });
      const other = await metadata.create(owner);
      await expect(
        operations.appendUserMessage(owner, other.id, firstQuestion, key),
      ).rejects.toMatchObject({ status: 409 });
      expect(await db.aiConversationMessage.count({ where: { conversationId: other.id } })).toBe(0);
    });
    it('serializes concurrent matching keys into one message and receipt', async () => {
      const { owner, conversation } = await fixture(),
        key = randomUUID();
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          operations.appendUserMessage(owner, conversation.id, firstQuestion, key),
        ),
      );
      expect(new Set(results.map((r) => r.id)).size).toBe(1);
      expect(
        await db.aiConversationMessage.count({ where: { conversationId: conversation.id } }),
      ).toBe(1);
    });
    it('allows exactly one winner for concurrent conflicting inputs', async () => {
      const { owner, conversation } = await fixture(),
        key = randomUUID();
      const results = await Promise.allSettled(
        [firstQuestion, secondQuestion].map((text) =>
          operations.appendUserMessage(owner, conversation.id, text, key),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((r) => r.status === 'rejected')).toMatchObject({
        reason: { status: 409 },
      });
      expect(
        await db.aiConversationMessage.count({ where: { conversationId: conversation.id } }),
      ).toBe(1);
    });
    it('serializes a shared receipt key across different owned parents', async () => {
      const { owner, conversation } = await fixture();
      const other = await metadata.create(owner),
        key = randomUUID();
      const results = await Promise.allSettled(
        [conversation, other].map((parent) =>
          operations.appendUserMessage(owner, parent.id, firstQuestion, key),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((r) => r.status === 'rejected')).toMatchObject({
        reason: { status: 409 },
      });
      expect(
        await db.aiConversationMessage.count({
          where: { conversationId: { in: [conversation.id, other.id] } },
        }),
      ).toBe(1);
    });
    it('allocates gapless monotonic sequences for simultaneous different keys', async () => {
      const { owner, conversation } = await fixture();
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          operations.appendUserMessage(owner, conversation.id, firstQuestion, randomUUID()),
        ),
      );
      expect(results.map((r) => r.sequence).sort((a, b) => a - b)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8,
      ]);
      expect(
        (await db.aiConversation.findUniqueOrThrow({ where: { id: conversation.id } }))
          .nextMessageSequence,
      ).toBe(9);
    });
    it('isolates identical opaque keys across independent tenants/users', async () => {
      const key = randomUUID(),
        a = await fixture(),
        b = await fixture();
      const results = await Promise.all(
        [a, b].map((f) =>
          operations.appendUserMessage(f.owner, f.conversation.id, firstQuestion, key),
        ),
      );
      expect(results[0].id).not.toBe(results[1].id);
      expect(results.every((r) => r.sequence === 1)).toBe(true);
    });
    it('allows separate owners in one tenant to reuse the same opaque key', async () => {
      const tenant = randomUUID(),
        key = randomUUID();
      const contexts = [operationOwner(tenant, randomUUID()), operationOwner(tenant, randomUUID())];
      const parents = await Promise.all(contexts.map((context) => metadata.create(context)));
      const results = await Promise.all(
        parents.map((parent, index) =>
          operations.appendUserMessage(contexts[index], parent.id, firstQuestion, key),
        ),
      );
      expect(new Set(results.map((r) => r.id)).size).toBe(2);
    });
    it('pages by sequence and decrypts only the selected bounded page', async () => {
      const { owner, conversation } = await fixture();
      for (const text of [firstQuestion, secondQuestion, thirdQuestion])
        await operations.appendUserMessage(owner, conversation.id, text, randomUUID());
      const first = await operations.readOwnedMessagePage(owner, conversation.id, 0, 2);
      expect(first.items.map((r) => r.content)).toEqual([firstQuestion, secondQuestion]);
      expect(first.nextAfterSequence).toBe(2);
      expect(
        (await operations.readOwnedMessagePage(owner, conversation.id, 2, 2)).items.map(
          (r) => r.content,
        ),
      ).toEqual([thirdQuestion]);
      const third = await db.aiConversationMessage.findFirstOrThrow({
        where: { conversationId: conversation.id, sequence: 3 },
      });
      await db.aiConversationMessage.update({
        where: { id: third.id },
        data: { authenticationTag: Buffer.alloc(16) },
      });
      expect(
        (await operations.readOwnedMessagePage(owner, conversation.id, 0, 2)).items,
      ).toHaveLength(2);
      await expect(operations.readOwnedMessagePage(owner, conversation.id, 2, 2)).rejects.toThrow(
        'Conversation operation unavailable',
      );
    });
    it('rejects persisted AAD metadata substitution and unknown encryption keys without partial plaintext', async () => {
      const { owner, conversation, message } = await appendFixture();
      await db.aiConversationMessage.update({ where: { id: message.id }, data: { sequence: 20 } });
      await expect(operations.readOwnedMessagePage(owner, conversation.id)).rejects.toMatchObject({
        status: 503,
      });
      await db.aiConversationMessage.update({
        where: { id: message.id },
        data: { sequence: 1, keyId: 'a'.repeat(64) },
      });
      await expect(operations.readOwnedMessagePage(owner, conversation.id)).rejects.toMatchObject({
        status: 503,
      });
    });
    it('verifies historical fingerprint keys after active-key transition and fails closed after their loss', async () => {
      const { owner, conversation } = await fixture(),
        key = randomUUID();
      const first = await operations.appendUserMessage(owner, conversation.id, firstQuestion, key);
      const fixtureConfig = operationConfig();
      const rotated = makeOperations(
        operationConfig({ AI_FINGERPRINT_ACTIVE_KEY_ID: fixtureConfig.historical.id }).config,
      );
      expect(await rotated.appendUserMessage(owner, conversation.id, firstQuestion, key)).toEqual(
        first,
      );
      const lost = makeOperations(
        operationConfig({
          AI_FINGERPRINT_ACTIVE_KEY_ID: fixtureConfig.historical.id,
          AI_FINGERPRINT_KEYS: JSON.stringify([fixtureConfig.historical]),
        }).config,
      );
      await expect(
        lost.appendUserMessage(owner, conversation.id, firstQuestion, key),
      ).rejects.toMatchObject({ status: 503 });
    });
    it('revalidates receipt result IDs against current scope and existence', async () => {
      const { owner, conversation } = await fixture(),
        key = randomUUID();
      await operations.appendUserMessage(owner, conversation.id, firstQuestion, key);
      await db.aiSubmissionReceipt.updateMany({
        where: { resultConversationId: conversation.id },
        data: { resultMessageId: randomUUID() },
      });
      await expect(
        operations.appendUserMessage(owner, conversation.id, firstQuestion, key),
      ).rejects.toMatchObject({ status: 404 });
    });
    it('rolls back the message, sequence and receipt when receipt insertion fails after message insertion', async () => {
      const { owner, conversation } = await fixture(),
        key = 'test-receipt-rollback-only';
      await db.$executeRawUnsafe(
        `CREATE FUNCTION ai.test_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."idempotencyKey" = 'test-receipt-rollback-only' THEN RAISE EXCEPTION 'test-only receipt failure'; END IF; RETURN NEW; END; $$`,
      );
      await db.$executeRawUnsafe(
        `CREATE TRIGGER test_receipt_failure BEFORE INSERT ON ai."AiSubmissionReceipt" FOR EACH ROW EXECUTE FUNCTION ai.test_receipt_failure()`,
      );
      try {
        await expect(
          operations.appendUserMessage(owner, conversation.id, firstQuestion, key),
        ).rejects.toThrow('Conversation operation unavailable');
        expect(
          await db.aiConversationMessage.count({ where: { conversationId: conversation.id } }),
        ).toBe(0);
        expect(
          await db.aiSubmissionReceipt.count({ where: { resultConversationId: conversation.id } }),
        ).toBe(0);
        expect(
          (await db.aiConversation.findUniqueOrThrow({ where: { id: conversation.id } }))
            .nextMessageSequence,
        ).toBe(1);
      } finally {
        await db.$executeRawUnsafe('DROP TRIGGER test_receipt_failure ON ai."AiSubmissionReceipt"');
        await db.$executeRawUnsafe('DROP FUNCTION ai.test_receipt_failure()');
      }
      expect(
        (await operations.appendUserMessage(owner, conversation.id, firstQuestion, key)).sequence,
      ).toBe(1);
    });
    it('deletes owned aggregate with cascade but leaves receipts non-replayable and denies deletion retries', async () => {
      const { owner, conversation } = await fixture(),
        key = randomUUID();
      await operations.appendUserMessage(owner, conversation.id, firstQuestion, key);
      await operations.deleteOwned(owner, conversation.id);
      expect(
        await db.aiConversationMessage.count({ where: { conversationId: conversation.id } }),
      ).toBe(0);
      expect(
        await db.aiSubmissionReceipt.count({ where: { resultConversationId: conversation.id } }),
      ).toBe(1);
      await expect(
        operations.appendUserMessage(owner, conversation.id, firstQuestion, key),
      ).rejects.toMatchObject({ status: 404 });
      await expect(operations.deleteOwned(owner, conversation.id)).rejects.toMatchObject({
        status: 404,
      });
      expect(await metadata.findOwned(owner, conversation.id)).toBeNull();
    });
    it('serializes delete-versus-append without resurrecting deleted content', async () => {
      const { owner, conversation } = await fixture();
      const results = await Promise.allSettled([
        operations.deleteOwned(owner, conversation.id),
        operations.appendUserMessage(owner, conversation.id, firstQuestion, randomUUID()),
      ]);
      expect(results[0].status).toBe('fulfilled');
      if (results[1].status === 'rejected')
        expect(results[1].reason).toMatchObject({ status: 404 });
      expect(await db.aiConversation.count({ where: { id: conversation.id } })).toBe(0);
      expect(
        await db.aiConversationMessage.count({ where: { conversationId: conversation.id } }),
      ).toBe(0);
    });
    it('rechecks expiry after waiting for a real PostgreSQL row lock', async () => {
      const owner = newOwner();
      // A deliberately short-lived row exists only in test infrastructure.
      const conversation = await db.aiConversation.create({
        data: {
          ...requireOwnership(owner),
          expiresAt: new Date(Date.now() + 600),
        },
      });
      let acquired!: () => void, release!: () => void;
      const ready = new Promise<void>((r) => {
        acquired = r;
      });
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const holding = db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM ai."AiConversation" WHERE id = ${conversation.id}::uuid FOR UPDATE`;
        acquired();
        await gate;
      });
      await ready;
      const append = operations.appendUserMessage(owner, conversation.id, 'too-late', randomUUID());
      // Attach rejection immediately to avoid an unhandled rejected promise on slow runners.
      const outcome = append.then(
        () => null,
        (error: unknown) => error,
      );
      const cleanup = new RetentionCleanupService(
        database,
        new ConfigService({
          NODE_ENV: 'test',
          AI_PERSISTENCE_ENABLED: true,
          AI_RETENTION_CLEANUP_ENABLED: true,
          AI_CLEANUP_BATCH_SIZE: 100,
        }),
      );
      try {
        await new Promise((r) => setTimeout(r, 700));
        await cleanup.runBatch();
        expect(
          await db.aiConversation.findUnique({ where: { id: conversation.id } }),
        ).not.toBeNull();
      } finally {
        release();
        await holding;
      }
      expect(await outcome).toMatchObject({ status: 404 });
      await cleanup.runBatch();
      expect(await db.aiConversation.findUnique({ where: { id: conversation.id } })).toBeNull();
      expect(
        await db.aiConversationMessage.count({ where: { conversationId: conversation.id } }),
      ).toBe(0);
      await expect(operations.readOwnedMessagePage(owner, conversation.id)).rejects.toMatchObject({
        status: 404,
      });
    });
    it('denies expired receipt replay without resurrecting or recycling the key', async () => {
      const { owner, conversation } = await fixture(),
        key = randomUUID();
      await operations.appendUserMessage(owner, conversation.id, firstQuestion, key);
      await db.aiSubmissionReceipt.updateMany({
        where: { resultConversationId: conversation.id },
        data: {
          createdAt: new Date(Date.now() - 20000),
          expiresAt: new Date(Date.now() - 10000),
        },
      });
      await expect(
        operations.appendUserMessage(owner, conversation.id, firstQuestion, key),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        await db.aiConversationMessage.count({ where: { conversationId: conversation.id } }),
      ).toBe(1);
    });
    it('ends deduplication after physical receipt purge rather than claiming permanent key retention', async () => {
      const { owner, conversation } = await fixture(),
        key = randomUUID();
      await operations.appendUserMessage(owner, conversation.id, firstQuestion, key);
      await db.aiSubmissionReceipt.updateMany({
        where: { resultConversationId: conversation.id },
        data: {
          createdAt: new Date(Date.now() - 20000),
          expiresAt: new Date(Date.now() - 10000),
        },
      });
      const cleanup = new RetentionCleanupService(
        database,
        new ConfigService({
          NODE_ENV: 'test',
          AI_PERSISTENCE_ENABLED: true,
          AI_RETENTION_CLEANUP_ENABLED: true,
          AI_CLEANUP_BATCH_SIZE: 100,
        }),
      );
      await cleanup.runBatch();
      expect(
        (await operations.appendUserMessage(owner, conversation.id, firstQuestion, key)).sequence,
      ).toBe(2);
    });
    it('safely races expired cleanup with an owner deletion attempt', async () => {
      const owner = newOwner();
      const conversation = await db.aiConversation.create({
        data: {
          ...requireOwnership(owner),
          createdAt: new Date(Date.now() - 10000),
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      const cleanup = new RetentionCleanupService(
        database,
        new ConfigService({
          NODE_ENV: 'test',
          AI_PERSISTENCE_ENABLED: true,
          AI_RETENTION_CLEANUP_ENABLED: true,
          AI_CLEANUP_BATCH_SIZE: 100,
        }),
      );
      const results = await Promise.allSettled([
        operations.deleteOwned(owner, conversation.id),
        cleanup.runBatch(),
      ]);
      expect(results[0]).toMatchObject({ status: 'rejected', reason: { status: 404 } });
      expect(results[1].status).toBe('fulfilled');
      // SKIP LOCKED may defer this row while the rejected owner deletion holds it.
      await cleanup.runBatch();
      expect(await db.aiConversation.findUnique({ where: { id: conversation.id } })).toBeNull();
    });
    it('sanitizes database unavailability and reconnects safely without replaying arbitrary network failures', async () => {
      const { owner, conversation } = await fixture();
      await database.onModuleDestroy();
      try {
        await expect(
          operations.appendUserMessage(owner, conversation.id, 'x', randomUUID()),
        ).rejects.toThrow('Conversation operation unavailable');
      } finally {
        await database.onModuleInit();
      }
      expect(
        (await operations.appendUserMessage(owner, conversation.id, firstQuestion, randomUUID()))
          .sequence,
      ).toBe(1);
    });
    it('recovers a real PostgreSQL deadlock with one bounded transaction retry', async () => {
      const a = await fixture(),
        b = await fixture();
      let firstAttempts = 0,
        unblock!: () => void;
      const gate = new Promise<void>((resolve) => {
        unblock = resolve;
      });
      const counts = [0, 0];
      async function run(index: number, first: string, second: string) {
        await database.transaction(async (tx) => {
          counts[index]++;
          await tx.$executeRaw`SET LOCAL deadlock_timeout = '100ms'`;
          await tx.$queryRaw`SELECT id FROM ai."AiConversation" WHERE id = ${first}::uuid FOR UPDATE`;
          if (counts[index] === 1) {
            firstAttempts++;
            if (firstAttempts === 2) unblock();
            await gate;
          }
          await tx.$queryRaw`SELECT id FROM ai."AiConversation" WHERE id = ${second}::uuid FOR UPDATE`;
        });
      }
      await Promise.all([
        run(0, a.conversation.id, b.conversation.id),
        run(1, b.conversation.id, a.conversation.id),
      ]);
      expect(counts.sort()).toEqual([1, 2]);
    });
    it('rolls back an interrupted backend connection and permits an explicit same-key retry after reconnect', async () => {
      const { owner, conversation } = await fixture(),
        key = 'test-backend-interrupt-only';
      await db.$executeRawUnsafe(
        `CREATE FUNCTION ai.test_backend_interrupt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."idempotencyKey" = 'test-backend-interrupt-only' THEN PERFORM pg_terminate_backend(pg_backend_pid()); END IF; RETURN NEW; END; $$`,
      );
      await db.$executeRawUnsafe(
        'CREATE TRIGGER test_backend_interrupt BEFORE INSERT ON ai."AiSubmissionReceipt" FOR EACH ROW EXECUTE FUNCTION ai.test_backend_interrupt()',
      );
      try {
        await expect(
          operations.appendUserMessage(owner, conversation.id, firstQuestion, key),
        ).rejects.toThrow('Conversation operation unavailable');
        expect(
          await db.aiConversationMessage.count({ where: { conversationId: conversation.id } }),
        ).toBe(0);
        expect(
          await db.aiSubmissionReceipt.count({ where: { resultConversationId: conversation.id } }),
        ).toBe(0);
        expect(
          (await db.aiConversation.findUniqueOrThrow({ where: { id: conversation.id } }))
            .nextMessageSequence,
        ).toBe(1);
      } finally {
        await db.$executeRawUnsafe(
          'DROP TRIGGER test_backend_interrupt ON ai."AiSubmissionReceipt"',
        );
        await db.$executeRawUnsafe('DROP FUNCTION ai.test_backend_interrupt()');
      }
      expect(
        (await operations.appendUserMessage(owner, conversation.id, firstQuestion, key)).sequence,
      ).toBe(1);
    });
    it('enabled internal operations do not enable conversation HTTP or inference', async () => {
      const original = process.env;
      const fixtureConfig = operationConfig({ DATABASE_URL: testDatabaseUrl! });
      const safeLogs: unknown[] = [];
      process.env = Object.fromEntries(
        Object.entries(fixtureConfig.values).map(([name, value]) => [name, String(value)]),
      );
      try {
        const app = await createApplication({ ignoreEnvFile: true }, (entry) =>
          safeLogs.push(entry),
        );
        try {
          await app.init();
          await request(app.getHttpServer())
            .get('/api/health')
            .expect(200, { status: 'ok', service: 'ai-service' });
          await request(app.getHttpServer())
            .get('/api/ready')
            .expect(200, { status: 'ready', service: 'ai-service', inferenceAvailable: false });
          for (const method of ['get', 'post', 'delete'] as const)
            await request(app.getHttpServer())
              [method]('/api/conversations')
              .expect(method === 'delete' ? 404 : 503);
          const logs = JSON.stringify(safeLogs);
          expect(logs).not.toContain(fixtureConfig.fingerprint.key);
          expect(logs).not.toContain(fixtureConfig.encryption.key);
          expect(logs).not.toContain('DATABASE_URL');
        } finally {
          await app.close();
        }
      } finally {
        process.env = original;
      }
    });
  },
);
