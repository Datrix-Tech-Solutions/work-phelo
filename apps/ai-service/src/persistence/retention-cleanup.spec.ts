import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { Request } from 'express';
import { Prisma, PrismaClient } from '../../prisma/generated/client';
import { TrustedContextService } from '../auth/trusted-context.service';
import { parseRuntimeEnv } from '../config/runtime-env';
import { AiDatabaseService, createAiClient } from './ai-database.service';
import { ConversationsRepository } from './conversations.repository';
import { OwnershipContextFactory } from './ownership-context';
import { RetentionCleanupService } from './retention-cleanup.service';
import { AI_RETENTION_MS, appendReceiptLockScope, retentionDeadline } from './retention-policy';

const base = { NODE_ENV: 'test', AI_PROVIDER: 'mock', AI_POLICY_VERSION: 'retention-v1' };
const urlPlaceholder = 'postgresql://fixture:fixture@127.0.0.1:1/workphelo_ai_2b1?schema=ai';
function config(extra: Record<string, unknown> = {}) {
  const values = {
    ...base,
    AI_PERSISTENCE_ENABLED: true,
    AI_RETENTION_CLEANUP_ENABLED: true,
    AI_CLEANUP_BATCH_SIZE: 2,
    AI_REQUEST_TIMEOUT_MS: 5000,
    ...extra,
  };
  return { get: (name: string) => values[name as keyof typeof values] } as ConfigService;
}

describe('Retention policy, scheduling and safe failures (unit fixtures)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('uses an exact non-sliding 720-hour duration independent of DST/calendar month', () => {
    for (const date of ['2026-02-01T00:00:00Z', '2026-03-20T01:00:00Z', '2026-11-01T00:00:00Z']) {
      const created = new Date(date);
      expect(retentionDeadline(created).getTime() - created.getTime()).toBe(720 * 3600000);
      expect(created.toISOString()).toBe(new Date(date).toISOString());
    }
  });
  it('creates metadata exclusively from the database clock, with no expiry argument', async () => {
    const now = new Date('2026-11-18T00:00:00.123Z');
    const create = jest.fn().mockResolvedValue(null);
    const database = {
      transaction: (fn: (tx: unknown) => unknown) =>
        fn({ $queryRaw: () => [{ now }], aiConversation: { create } }),
    };
    const owner = new OwnershipContextFactory({
      verifyRequest: () => ({ tenantId: 'tenant', id: 'user' }),
    } as unknown as TrustedContextService).fromRequest({} as Request);
    await new ConversationsRepository(database as unknown as AiDatabaseService).create(owner);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tenantId: 'tenant',
          ownerUserId: 'user',
          createdAt: now,
          expiresAt: retentionDeadline(now),
        },
      }),
    );
  });
  it('keeps cleanup and scheduler disabled by default without database or keys', async () => {
    const parsed = parseRuntimeEnv(base);
    expect(parsed).toMatchObject({
      AI_RETENTION_CLEANUP_ENABLED: false,
      AI_RETENTION_SCHEDULER_ENABLED: false,
    });
    const transaction = jest.fn();
    const cleanup = new RetentionCleanupService(
      { transaction } as unknown as AiDatabaseService,
      new ConfigService(parsed),
    );
    cleanup.onModuleInit();
    await expect(cleanup.runBatch()).rejects.toThrow('Conversation operation unavailable');
    await cleanup.onModuleDestroy();
    expect(transaction).not.toHaveBeenCalled();
  });
  it.each([
    { AI_RETENTION_CLEANUP_ENABLED: 'true' },
    { AI_RETENTION_SCHEDULER_ENABLED: 'true' },
    {
      AI_PERSISTENCE_ENABLED: 'true',
      DATABASE_URL: urlPlaceholder,
      AI_RETENTION_CLEANUP_ENABLED: 'true',
      NODE_ENV: 'production',
    },
    { AI_CLEANUP_BATCH_SIZE: '0' },
    { AI_CLEANUP_BATCH_SIZE: '101' },
    { AI_CLEANUP_INTERVAL_MS: '999' },
    { AI_CLEANUP_INTERVAL_MS: '3600001' },
  ])('rejects unsafe cleanup configuration', (extra) => {
    expect(() => parseRuntimeEnv({ ...base, ...extra })).toThrow(
      'Invalid or missing AI runtime configuration',
    );
  });
  it('requires no encryption or fingerprint keys for explicitly enabled isolated cleanup', () => {
    expect(
      parseRuntimeEnv({
        ...base,
        AI_PERSISTENCE_ENABLED: 'true',
        DATABASE_URL: urlPlaceholder,
        AI_RETENTION_CLEANUP_ENABLED: 'true',
      }),
    ).toMatchObject({ AI_MESSAGE_ENCRYPTION_ENABLED: false, AI_MESSAGE_OPERATIONS_ENABLED: false });
  });
  it('starts only an explicitly enabled scheduler and stops it on module shutdown', async () => {
    jest.useFakeTimers();
    const cleanup = new RetentionCleanupService(
      {} as AiDatabaseService,
      config({ AI_RETENTION_SCHEDULER_ENABLED: true, AI_CLEANUP_INTERVAL_MS: 1000 }),
    );
    const result = {
      conversationsDeleted: 0,
      receiptsDeleted: 0,
      conversationBacklog: 0,
      backlogCapped: false,
      oldestExpiredAgeSeconds: 0,
      lastSuccessAt: new Date(0).toISOString(),
    };
    const run = jest.spyOn(cleanup, 'runBatch').mockResolvedValue(result);
    cleanup.onModuleInit();
    await jest.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(2);
    await cleanup.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(2);
  });
  it('sanitizes database outages and emits bounded content-free failure diagnostics', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const transaction = jest
      .fn()
      .mockRejectedValue(new Error('private-tenant-content-key-driver-canary'));
    const cleanup = new RetentionCleanupService(
      { transaction } as unknown as AiDatabaseService,
      config(),
    );
    await expect(cleanup.runBatch()).rejects.toThrow('Conversation operation unavailable');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(cleanup.status()).toMatchObject({
      lastSuccessAt: null,
      failureCount: 1,
      conversationsDeleted: 0,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ai_cleanup_failure'));
    expect(JSON.stringify(warn.mock.calls)).not.toContain('canary');
  });
  it('caps all retry attempts to a single deadline rather than restarting the budget', async () => {
    const client = { $connect: jest.fn(), $disconnect: jest.fn(), $transaction: jest.fn() };
    const database = new AiDatabaseService(
      config({ AI_REQUEST_TIMEOUT_MS: 1, DATABASE_URL: urlPlaceholder }),
      () => client as unknown as PrismaClient,
    );
    await database.onModuleInit();
    await expect(database.transaction(() => Promise.resolve(null))).rejects.toThrow(
      'Conversation operation unavailable',
    );
    expect(client.$transaction).not.toHaveBeenCalled();
  });
  it('reduces the remaining timeout across transient retries instead of renewing it', async () => {
    const client = { $connect: jest.fn(), $disconnect: jest.fn(), $transaction: jest.fn() };
    client.$transaction.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      throw new Prisma.PrismaClientKnownRequestError('private', {
        code: 'P2034',
        clientVersion: '5.22.0',
      });
    });
    const database = new AiDatabaseService(
      config({ AI_REQUEST_TIMEOUT_MS: 250, DATABASE_URL: urlPlaceholder }),
      () => client as unknown as PrismaClient,
    );
    await database.onModuleInit();
    await expect(database.transaction(() => Promise.resolve(null))).rejects.toThrow(
      'Conversation operation unavailable',
    );
    const calls = client.$transaction.mock.calls as unknown as [
      unknown,
      { maxWait: number; timeout: number },
    ][];
    expect(calls.length).toBeLessThanOrEqual(2);
    if (calls.length === 2)
      expect(calls[1][1].maxWait + calls[1][1].timeout).toBeLessThan(
        calls[0][1].maxWait + calls[0][1].timeout,
      );
  });
});

const testUrl = process.env.AI_TEST_DATABASE_URL;
(testUrl ? describe : describe.skip)(
  'Retention cleanup on disposable PostgreSQL (real locks and cascades)',
  () => {
    let db: PrismaClient, database: AiDatabaseService, cleaner: RetentionCleanupService;
    let log: jest.SpyInstance;
    const expired = () => new Date(Date.now() - 60000);
    beforeAll(async () => {
      const url = new URL(testUrl!);
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        url.pathname !== '/workphelo_ai_2b1' ||
        url.searchParams.get('schema') !== 'ai'
      )
        throw new Error('Only disposable AI PostgreSQL is allowed');
      db = createAiClient(testUrl!);
      await db.$connect();
      database = new AiDatabaseService(config({ DATABASE_URL: testUrl! }), createAiClient);
      await database.onModuleInit();
      cleaner = new RetentionCleanupService(database, config());
      log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    });
    beforeEach(async () => {
      // This suite owns only the isolated disposable test schema. Never use shared DBs.
      await db.aiConversation.deleteMany();
      await db.aiSubmissionReceipt.deleteMany();
    });
    afterAll(async () => {
      log?.mockRestore();
      await database?.onModuleDestroy();
      await db?.$disconnect();
    });
    async function parent(isExpired = true) {
      const createdAt = new Date(Date.now() - (isExpired ? AI_RETENTION_MS + 120000 : 1000));
      return db.aiConversation.create({
        data: {
          tenantId: randomUUID(),
          ownerUserId: randomUUID(),
          createdAt,
          expiresAt: retentionDeadline(createdAt),
        },
      });
    }
    async function child(conversation: Awaited<ReturnType<typeof parent>>) {
      return db.aiConversationMessage.create({
        data: {
          conversationId: conversation.id,
          tenantId: conversation.tenantId,
          ownerUserId: conversation.ownerUserId,
          sequence: 1,
          encryptionVersion: 1,
          keyId: 'unavailable-historical-key',
          ciphertext: randomBytes(20),
          nonce: randomBytes(12),
          authenticationTag: randomBytes(16),
        },
      });
    }
    async function receipt(conversation: Awaited<ReturnType<typeof parent>>, isExpired = true) {
      const createdAt = new Date(Date.now() - (isExpired ? AI_RETENTION_MS + 120000 : 0));
      return db.aiSubmissionReceipt.create({
        data: {
          tenantId: conversation.tenantId,
          ownerUserId: conversation.ownerUserId,
          operation: 'APPEND_MESSAGE',
          idempotencyKey: randomUUID(),
          fingerprintVersion: 1,
          fingerprintKeyId: 'unavailable-historical-hmac',
          requestFingerprint: randomBytes(32),
          resultConversationId: conversation.id,
          outcome: 'STORED',
          createdAt,
          expiresAt: retentionDeadline(createdAt),
        },
      });
    }
    it('cleans bounded batches, cascades messages without keys, preserves live rows and repeats safely', async () => {
      const rows = await Promise.all(Array.from({ length: 5 }, () => parent()));
      for (const row of rows) await child(row);
      const active = await parent(false);
      await child(active);
      const activeReceipt = await receipt(active, false);
      expect((await cleaner.runBatch()).conversationsDeleted).toBe(2);
      expect((await cleaner.runBatch()).conversationsDeleted).toBe(2);
      expect((await cleaner.runBatch()).conversationsDeleted).toBe(1);
      expect((await cleaner.runBatch()).conversationsDeleted).toBe(0);
      expect(await db.aiConversation.count()).toBe(1);
      expect(await db.aiConversationMessage.count()).toBe(1);
      expect(
        await db.aiSubmissionReceipt.findUnique({ where: { id: activeReceipt.id } }),
      ).not.toBeNull();
    });
    it('allows concurrent replicas to claim different expired rows without duplicate deletion', async () => {
      await Promise.all(Array.from({ length: 4 }, () => parent()));
      const other = new RetentionCleanupService(database, config());
      const results = await Promise.all([cleaner.runBatch(), other.runBatch()]);
      expect(results.reduce((n, r) => n + r.conversationsDeleted, 0)).toBe(4);
      expect(await db.aiConversation.count()).toBe(0);
    });
    it('skips a parent actively locked by another operation and removes it after release', async () => {
      const conversation = await parent();
      let acquired!: () => void, release!: () => void;
      const ready = new Promise<void>((r) => {
          acquired = r;
        }),
        gate = new Promise<void>((r) => {
          release = r;
        });
      const holding = db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM ai."AiConversation" WHERE id = ${conversation.id}::uuid FOR UPDATE`;
        acquired();
        await gate;
      });
      await ready;
      try {
        expect((await cleaner.runBatch()).conversationsDeleted).toBe(0);
      } finally {
        release();
        await holding;
      }
      expect((await cleaner.runBatch()).conversationsDeleted).toBe(1);
    });
    it('cleans expired receipts independently but skips an active append receipt-scope lock', async () => {
      const active = await parent(false),
        old = await receipt(active),
        live = await receipt(active, false);
      const scope = appendReceiptLockScope(old.tenantId, old.ownerUserId, old.idempotencyKey);
      let acquired!: () => void, release!: () => void;
      const ready = new Promise<void>((r) => {
          acquired = r;
        }),
        gate = new Promise<void>((r) => {
          release = r;
        });
      const holding = db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))::text`;
        acquired();
        await gate;
      });
      await ready;
      try {
        expect((await cleaner.runBatch()).receiptsDeleted).toBe(0);
      } finally {
        release();
        await holding;
      }
      expect((await cleaner.runBatch()).receiptsDeleted).toBe(1);
      expect(await db.aiSubmissionReceipt.findUnique({ where: { id: live.id } })).not.toBeNull();
      expect(await db.aiConversation.findUnique({ where: { id: active.id } })).not.toBeNull();
    });
    it('reports bounded backlog, oldest age and successful timestamps without content or identity labels', async () => {
      await db.aiConversation.createMany({
        data: Array.from({ length: 1010 }, () => ({
          id: randomUUID(),
          tenantId: 'private-tenant-canary',
          ownerUserId: 'private-user-canary',
          createdAt: new Date(Date.now() - AI_RETENTION_MS - 120000),
          expiresAt: expired(),
        })),
      });
      const result = await cleaner.runBatch();
      expect(result).toMatchObject({
        conversationsDeleted: 2,
        conversationBacklog: 1000,
        backlogCapped: true,
      });
      expect(result.oldestExpiredAgeSeconds).toBeGreaterThanOrEqual(60);
      expect(cleaner.status().lastSuccessAt).not.toBeNull();
      expect(JSON.stringify(log.mock.calls)).not.toContain('private-tenant-canary');
      expect(JSON.stringify(log.mock.calls)).not.toContain('private-user-canary');
    });
    it('rolls back a failed batch and safely resumes after a previous batch committed', async () => {
      const first = await parent();
      await child(first);
      expect((await cleaner.runBatch()).conversationsDeleted).toBe(1);
      const second = await parent();
      await child(second);
      await db.$executeRawUnsafe(
        `CREATE FUNCTION ai.test_cleanup_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-cleanup-error-canary'; END; $$`,
      );
      await db.$executeRawUnsafe(
        'CREATE TRIGGER test_cleanup_failure BEFORE DELETE ON ai."AiConversationMessage" FOR EACH ROW EXECUTE FUNCTION ai.test_cleanup_failure()',
      );
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        await expect(cleaner.runBatch()).rejects.toThrow('Conversation operation unavailable');
        expect(await db.aiConversation.findUnique({ where: { id: second.id } })).not.toBeNull();
        expect(await db.aiConversationMessage.count()).toBe(1);
        expect(JSON.stringify(warn.mock.calls)).not.toContain('private-cleanup-error-canary');
      } finally {
        warn.mockRestore();
        await db.$executeRawUnsafe(
          'DROP TRIGGER test_cleanup_failure ON ai."AiConversationMessage"',
        );
        await db.$executeRawUnsafe('DROP FUNCTION ai.test_cleanup_failure()');
      }
      expect((await cleaner.runBatch()).conversationsDeleted).toBe(1);
    });
    it('sanitizes unavailable database start and recovers after explicit reconnection', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      await database.onModuleDestroy();
      try {
        await expect(cleaner.runBatch()).rejects.toThrow('Conversation operation unavailable');
      } finally {
        await database.onModuleInit();
        warn.mockRestore();
      }
      expect((await cleaner.runBatch()).conversationsDeleted).toBe(0);
    });
    it('uses the expiry indexes for bounded indexed selection', async () => {
      const plan = await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
        return tx.$queryRawUnsafe(
          'EXPLAIN SELECT id FROM ai."AiConversation" WHERE "expiresAt" <= statement_timestamp() ORDER BY "expiresAt", id LIMIT 25 FOR UPDATE SKIP LOCKED',
        );
      });
      expect(JSON.stringify(plan)).toContain('AiConversation_expiry_idx');
    });
    it('treats the exact expiration instant as expired in PostgreSQL and excludes it before physical cleanup', async () => {
      const id = randomUUID();
      const [boundary] = await db.$queryRaw<
        { exact: boolean; readable: boolean; cleanable: boolean }[]
      >`
      WITH inserted AS (INSERT INTO ai."AiConversation" (id, "tenantId", "ownerUserId", "createdAt", "updatedAt", "expiresAt")
        VALUES (${id}::uuid, 'boundary-tenant', 'boundary-user', date_trunc('milliseconds', statement_timestamp()) - interval '720 hours',
          statement_timestamp(), date_trunc('milliseconds', statement_timestamp())) RETURNING "expiresAt")
      SELECT "expiresAt" = date_trunc('milliseconds', statement_timestamp()) AS exact,
        "expiresAt" > date_trunc('milliseconds', statement_timestamp()) AS readable,
        "expiresAt" <= date_trunc('milliseconds', statement_timestamp()) AS cleanable FROM inserted`;
      expect(boundary).toEqual({ exact: true, readable: false, cleanable: true });
      const owner = new OwnershipContextFactory({
        verifyRequest: () => ({ tenantId: 'boundary-tenant', id: 'boundary-user' }),
      } as unknown as TrustedContextService).fromRequest({} as Request);
      const repository = new ConversationsRepository(database);
      expect(await repository.findOwned(owner, id)).toBeNull();
      expect(await repository.listOwned(owner)).toEqual([]);
      expect(await db.aiConversation.findUnique({ where: { id } })).not.toBeNull();
      expect((await cleaner.runBatch()).conversationsDeleted).toBe(1);
    });
    it('rolls back interrupted cleanup and can replay the batch after reconnection', async () => {
      const conversation = await parent();
      await child(conversation);
      await db.$executeRawUnsafe(
        `CREATE FUNCTION ai.test_cleanup_interrupt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_terminate_backend(pg_backend_pid()); RETURN OLD; END; $$`,
      );
      await db.$executeRawUnsafe(
        'CREATE TRIGGER test_cleanup_interrupt BEFORE DELETE ON ai."AiConversationMessage" FOR EACH ROW EXECUTE FUNCTION ai.test_cleanup_interrupt()',
      );
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        await expect(cleaner.runBatch()).rejects.toThrow('Conversation operation unavailable');
        expect(
          await db.aiConversation.findUnique({ where: { id: conversation.id } }),
        ).not.toBeNull();
        expect(await db.aiConversationMessage.count()).toBe(1);
      } finally {
        warn.mockRestore();
        await db.$executeRawUnsafe(
          'DROP TRIGGER test_cleanup_interrupt ON ai."AiConversationMessage"',
        );
        await db.$executeRawUnsafe('DROP FUNCTION ai.test_cleanup_interrupt()');
      }
      expect((await cleaner.runBatch()).conversationsDeleted).toBe(1);
    });
  },
);
