import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Request } from 'express';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { PrismaClient } from '../../prisma/generated/client';
import { TrustedContextService } from '../auth/trusted-context.service';
import { MessageContextFactory } from '../encryption/message-context';
import { MessageKeyRing } from '../encryption/key-ring.service';
import { MessageEncryptionService } from '../encryption/message-encryption.service';
import { AiDatabaseService, createAiClient } from './ai-database.service';
import { ConversationsRepository } from './conversations.repository';
import { ConversationOperationsService } from './conversation-operations.service';
import { ExecutionPermits } from './execution-permits.service';
import { executionContext } from './execution-context';
import { OwnershipContextFactory } from './ownership-context';
import { ResourceReconciliationService } from './resource-reconciliation.service';
import { RequestNonceStore } from './request-nonce.store';
import { RetentionCleanupService } from './retention-cleanup.service';
import { retentionDeadline } from './retention-policy';
import { SubmissionFingerprintService } from './submission-fingerprint.service';

const testUrl = process.env.AI_TEST_DATABASE_URL;
const owner = (tenantId = 'tenant-a', id = 'owner-a') =>
  new OwnershipContextFactory({
    verifyRequest: () => ({ tenantId, id }),
  } as unknown as TrustedContextService).fromRequest({} as Request);
const key = (n: number) => ({
  id: createHash('sha256').update(Buffer.alloc(32, n)).digest('hex'),
  key: Buffer.alloc(32, n).toString('base64'),
});
function settings(extra: Record<string, unknown> = {}) {
  const encryption = key(91),
    fingerprint = key(92);
  return new ConfigService({
    NODE_ENV: 'test',
    AI_PERSISTENCE_ENABLED: true,
    DATABASE_URL: testUrl,
    AI_RESOURCE_SAFEGUARDS_ENABLED: true,
    AI_MESSAGE_ENCRYPTION_ENABLED: true,
    AI_MESSAGE_OPERATIONS_ENABLED: true,
    AI_REQUEST_VERIFICATION_ENABLED: true,
    AI_RETENTION_CLEANUP_ENABLED: true,
    AI_CLEANUP_BATCH_SIZE: 2,
    AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID: encryption.id,
    AI_MESSAGE_ENCRYPTION_KEYS: JSON.stringify([encryption]),
    AI_FINGERPRINT_ACTIVE_KEY_ID: fingerprint.id,
    AI_FINGERPRINT_KEYS: JSON.stringify([fingerprint]),
    ...extra,
  });
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((r) => {
    release = r;
  });
  return { promise, release };
}

(testUrl ? describe : describe.skip)('AI resource safeguards on disposable PostgreSQL', () => {
  let db: PrismaClient, database: AiDatabaseService, replica: AiDatabaseService;
  let repository: ConversationsRepository, operations: ConversationOperationsService;
  let permits: ExecutionPermits, secondPermits: ExecutionPermits;
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/workphelo_ai_2b1' ||
      url.searchParams.get('schema') !== 'ai'
    )
      throw new Error('Only disposable AI test database is allowed');
    db = createAiClient(testUrl!);
    await db.$connect();
    database = new AiDatabaseService(settings(), createAiClient);
    replica = new AiDatabaseService(settings(), createAiClient);
    await database.onModuleInit();
    await replica.onModuleInit();
    repository = new ConversationsRepository(database);
    operations = new ConversationOperationsService(
      database,
      new SubmissionFingerprintService(settings()),
      new MessageEncryptionService(new MessageKeyRing(settings())),
      new MessageContextFactory(),
    );
    permits = new ExecutionPermits(database, settings());
    secondPermits = new ExecutionPermits(replica, settings());
  });
  async function clear() {
    // This guarded fixture owns the complete disposable AI schema, not a shared DB.
    await db.$executeRawUnsafe(
      'TRUNCATE ai."AiConversationMessage",ai."AiConversation",ai."AiSubmissionReceipt",ai."AiRequestNonce",ai."AiConversationUsage",ai."AiOwnerUsage",ai."AiTenantUsage",ai."AiExecutionSlot",ai."AiAccountingReconciliation"',
    );
  }
  beforeEach(clear);
  afterAll(async () => {
    await clear();
    await database?.onModuleDestroy();
    await replica?.onModuleDestroy();
    await db?.$disconnect();
  });
  const data = (tenantId = 'tenant-a', ownerUserId = 'owner-a', expired = false) => {
    const createdAt = new Date(Date.now() - (expired ? 720 * 3600000 + 1000 : 0));
    return { tenantId, ownerUserId, createdAt, expiresAt: retentionDeadline(createdAt) };
  };
  async function usage(tenantId = 'tenant-a') {
    return db.aiTenantUsage.findUniqueOrThrow({ where: { tenantId } });
  }
  async function syntheticMessage(
    conversation: { id: string; tenantId: string; ownerUserId: string },
    bytes = 1,
    sequence = 1,
  ) {
    // Raw envelopes exercise persisted byte accounting, not plaintext acceptance.
    return db.aiConversationMessage.create({
      data: {
        conversationId: conversation.id,
        tenantId: conversation.tenantId,
        ownerUserId: conversation.ownerUserId,
        sequence,
        encryptionVersion: 1,
        keyId: 'fixture',
        ciphertext: Buffer.alloc(bytes, 1),
        nonce: randomBytes(12),
        authenticationTag: randomBytes(16),
      },
    });
  }
  it('keeps enforcement default-off and refuses execution without explicit safeguards', async () => {
    const disabled = new ExecutionPermits(
      database,
      settings({ AI_RESOURCE_SAFEGUARDS_ENABLED: false }),
    );
    await expect(disabled.run(owner(), () => Promise.resolve(null))).rejects.toMatchObject({
      status: 503,
    });
  });
  it('enforces the owner conversation boundary atomically across two writers, including the legacy creation path', async () => {
    await db.aiConversation.createMany({ data: Array.from({ length: 49 }, () => data()) });
    const result = await Promise.allSettled([
      repository.create(owner()),
      new ConversationsRepository(replica).create(owner()),
    ]);
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = result.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({
      status: 409,
      resourceCode: 'AI_STORAGE_QUOTA_EXCEEDED',
    });
    expect((await usage()).conversations).toBe(50n);
    expect(await db.aiConversation.count()).toBe(50);
    expect(await repository.listOwned(owner())).toHaveLength(20);
    await operations.deleteOwned(owner(), (await db.aiConversation.findFirstOrThrow()).id);
    expect((await usage()).conversations).toBe(49n);
  });
  it('enforces tenant capacity without blocking a different tenant', async () => {
    await db.aiConversation.createMany({
      data: Array.from({ length: 500 }, (_, i) => data('tenant-a', 'owner-' + i)),
    });
    await expect(repository.create(owner('tenant-a', 'new-owner'))).rejects.toMatchObject({
      status: 409,
    });
    await repository.create(owner('tenant-b', 'new-owner'));
    expect((await usage('tenant-b')).conversations).toBe(1n);
  });
  it('charges exact envelope bytes and rolls back an append at the byte boundary', async () => {
    const parent = await db.aiConversation.create({ data: data() });
    const overhead = 12 + 16 + Buffer.byteLength('fixture') + 2;
    await syntheticMessage(parent, 10 * 1024 * 1024 - overhead);
    await db.aiConversation.update({ where: { id: parent.id }, data: { nextMessageSequence: 2 } });
    expect((await usage()).encryptedBytes).toBe(10485760n);
    await expect(
      operations.appendUserMessage(owner(), parent.id, 'one more', 'over-limit'),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.aiConversationMessage.count()).toBe(1);
    expect(await db.aiSubmissionReceipt.count()).toBe(0);
    await operations.deleteOwned(owner(), parent.id);
    expect(await usage()).toMatchObject({ encryptedBytes: 0n, messages: 0n, conversations: 0n });
    expect(await db.aiConversationUsage.count()).toBe(0);
  });
  it('enforces the tenant byte limit independently of each owner', async () => {
    for (let i = 0; i < 10; i++) {
      const parent = await db.aiConversation.create({ data: data('tenant-a', 'owner-' + i) });
      await syntheticMessage(parent, 10485760 - (12 + 16 + 7 + 2));
    }
    const parent = await repository.create(owner('tenant-a', 'new-owner'));
    await expect(
      operations.appendUserMessage(owner('tenant-a', 'new-owner'), parent.id, 'x', 'tenant-full'),
    ).rejects.toMatchObject({ status: 409 });
    expect((await usage()).encryptedBytes).toBe(104857600n);
  });
  it('enforces 1000 messages while preserving exact idempotent replay and lost-response recovery', async () => {
    const first = await operations.createConversation(owner(), 'create-once');
    const replay = await operations.createConversation(owner(), 'create-once');
    expect(replay.id).toBe(first.id);
    const message = await operations.appendUserMessage(
      owner(),
      first.id,
      'persisted',
      'append-once',
    );
    await operations.appendUserMessage(owner(), first.id, 'persisted', 'append-once');
    expect(await usage()).toMatchObject({ conversations: 1n, messages: 1n, receipts: 2n });
    for (let offset = 0; offset < 999; offset += 100)
      await db.aiConversationMessage.createMany({
        data: Array.from({ length: Math.min(100, 999 - offset) }, (_, i) => ({
          id: randomUUID(),
          conversationId: first.id,
          tenantId: 'tenant-a',
          ownerUserId: 'owner-a',
          sequence: offset + i + 2,
          encryptionVersion: 1,
          keyId: 'fixture',
          ciphertext: Buffer.from('x'),
          nonce: randomBytes(12),
          authenticationTag: randomBytes(16),
        })),
      });
    await db.aiConversation.update({
      where: { id: first.id },
      data: { nextMessageSequence: 1001 },
    });
    await expect(
      operations.appendUserMessage(owner(), first.id, 'overflow', 'overflow'),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await operations.appendUserMessage(owner(), first.id, 'persisted', 'append-once')).id,
    ).toBe(message.id);
    expect((await usage()).messages).toBe(1000n);
  });
  it('rolls all usage back when the enclosing transaction fails', async () => {
    await expect(
      database.transaction(async (tx) => {
        await tx.aiConversation.create({ data: data() });
        throw new Error('fixture-failure');
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(await db.aiConversation.count()).toBe(0);
    expect(await db.aiTenantUsage.count()).toBe(0);
  });
  it('charges only successful inserts, including conflict-skipping creation paths', async () => {
    const parent = await db.aiConversation.create({ data: data() });
    await db.aiConversation.createMany({ data: [parent], skipDuplicates: true });
    const message = await syntheticMessage(parent, 3);
    await db.aiConversationMessage.createMany({ data: [message], skipDuplicates: true });
    const record = await operations.createConversation(owner(), 'receipt-conflict');
    const receipt = await db.aiSubmissionReceipt.findFirstOrThrow({
      where: { resultConversationId: record.id },
    });
    await db.aiSubmissionReceipt.createMany({ data: [receipt], skipDuplicates: true });
    expect(await usage()).toMatchObject({
      conversations: 2n,
      messages: 1n,
      encryptedBytes: 40n,
      receipts: 1n,
    });
    expect(await db.aiConversationUsage.count()).toBe(2);
  });
  it('retains expired usage until bounded cleanup commits, including two independent workers', async () => {
    const parent = await db.aiConversation.create({ data: data('tenant-a', 'owner-a', true) });
    for (let i = 1; i <= 5; i++) await syntheticMessage(parent, 1, i);
    expect((await usage()).messages).toBe(5n);
    const cleaner = new RetentionCleanupService(database, settings());
    const results = await Promise.all([
      cleaner.runBatch(),
      new RetentionCleanupService(replica, settings()).runBatch(),
    ]);
    expect(results.reduce((n, r) => n + r.messagesDeleted, 0)).toBe(2);
    expect((await usage()).messages).toBe(3n);
    await cleaner.runBatch();
    await cleaner.runBatch();
    expect(await usage()).toMatchObject({ messages: 0n, conversations: 0n, encryptedBytes: 0n });
  });
  it('shares two owner permits across replicas and acquires tenant/owner atomically', async () => {
    const ready = gate(),
      finish = gate();
    let active = 0;
    const action = async () => {
      if (++active === 2) ready.release();
      await finish.promise;
    };
    const held = [permits.run(owner(), action), secondPermits.run(owner(), action)];
    try {
      await ready.promise;
      await expect(permits.run(owner(), () => Promise.resolve(null))).rejects.toMatchObject({
        status: 429,
      });
      expect(
        await db.aiExecutionSlot.count({ where: { ownerUserId: '', leaseId: { not: null } } }),
      ).toBe(2);
      await secondPermits.run(owner('tenant-a', 'other-owner'), () => Promise.resolve(null));
    } finally {
      finish.release();
      await Promise.all(held);
    }
    expect(await db.aiExecutionSlot.count({ where: { leaseId: { not: null } } })).toBe(0);
  });
  it('shares ten tenant permits without interference between tenants', async () => {
    const finish = gate(),
      ready = gate();
    let active = 0;
    const held = Array.from({ length: 10 }, (_, i) =>
      (i % 2 ? permits : secondPermits).run(owner('tenant-a', 'owner-' + i), async () => {
        if (++active === 10) ready.release();
        await finish.promise;
      }),
    );
    try {
      await ready.promise;
      await expect(
        permits.run(owner('tenant-a', 'eleventh'), () => Promise.resolve(null)),
      ).rejects.toMatchObject({ status: 429 });
      await permits.run(owner('tenant-b', 'eleventh'), () => Promise.resolve(null));
    } finally {
      finish.release();
      await Promise.all(held);
    }
  });
  it('fences a paused former generation after expired capacity is reused, and cannot release the new lease', async () => {
    const ready = gate(),
      continueOld = gate(),
      newReady = gate(),
      finishNew = gate();
    const old = permits.run(owner(), async () => {
      const lease = executionContext.getStore()!;
      await db.aiExecutionSlot.updateMany({
        where: { leaseId: lease.leaseId },
        data: { expiresAt: new Date(0) },
      });
      ready.release();
      await continueOld.promise;
      return database.transaction((tx) => tx.aiConversation.create({ data: data() }));
    });
    await ready.promise;
    const newer = secondPermits.run(owner(), async () => {
      newReady.release();
      await finishNew.promise;
    });
    await newReady.promise;
    try {
      continueOld.release();
      await expect(old).rejects.toMatchObject({ status: 504 });
      expect(await db.aiExecutionSlot.count({ where: { leaseId: { not: null } } })).toBe(2);
      expect(await db.aiConversation.count()).toBe(0);
    } finally {
      finishNew.release();
      await newer;
    }
  });
  it('retains committed permits after a worker crash and recovers only expired capacity', async () => {
    const worker = spawn(
      process.execPath,
      [
        '-r',
        'ts-node/register/transpile-only',
        '-e',
        `
      const {ConfigService}=require('@nestjs/config');
      const {AiDatabaseService,createAiClient}=require('./src/persistence/ai-database.service');
      const {ExecutionPermits}=require('./src/persistence/execution-permits.service');
      const {OwnershipContextFactory}=require('./src/persistence/ownership-context');
      const config=new ConfigService({AI_PERSISTENCE_ENABLED:true,AI_RESOURCE_SAFEGUARDS_ENABLED:true,DATABASE_URL:process.env.AI_TEST_DATABASE_URL});
      const database=new AiDatabaseService(config,createAiClient);
      database.onModuleInit().then(()=>new ExecutionPermits(database,config).run(
        new OwnershipContextFactory({verifyRequest:()=>({tenantId:'tenant-a',id:'owner-a'})}).fromRequest({}),
        async()=>{setInterval(()=>{},1000);process.stdout.write('PERMITS_HELD\\n');await new Promise(()=>{});}
      )).catch(()=>{process.stderr.write('Fixture worker failed');process.exitCode=1;});
    `,
      ],
      {
        cwd: join(__dirname, '../..'),
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'test',
          TS_NODE_PROJECT: 'tsconfig.json',
          AI_TEST_DATABASE_URL: testUrl,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const exited = new Promise<void>((resolve) => worker.once('close', () => resolve()));
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Fixture worker startup deadline')), 5000);
        worker.stdout.on('data', (chunk: Buffer) => {
          if (chunk.toString().includes('PERMITS_HELD')) {
            clearTimeout(timer);
            resolve();
          }
        });
        worker.once('error', () => {
          clearTimeout(timer);
          reject(new Error('Fixture worker unavailable'));
        });
        worker.once('exit', () => {
          clearTimeout(timer);
          reject(new Error('Fixture worker exited before admission'));
        });
      });
      const slots = await db.aiExecutionSlot.findMany({ where: { leaseId: { not: null } } });
      expect(slots).toHaveLength(2);
      const leaseId = slots[0].leaseId!;
      worker.kill('SIGKILL');
      await exited;
      expect(await db.aiExecutionSlot.count({ where: { leaseId } })).toBe(2);
      const ready = gate(),
        finish = gate();
      const other = secondPermits.run(owner(), async () => {
        ready.release();
        await finish.promise;
      });
      try {
        await ready.promise;
        await expect(permits.run(owner(), () => Promise.resolve(null))).rejects.toMatchObject({
          status: 429,
        });
        // Advance only this dead fixture worker's DB expiry, not the proof clock.
        await db.aiExecutionSlot.updateMany({
          where: { leaseId },
          data: { expiresAt: new Date(0) },
        });
        await permits.run(owner(), () => repository.create(owner()));
        expect((await usage()).conversations).toBe(1n);
      } finally {
        finish.release();
        await other;
      }
    } finally {
      if (worker.exitCode === null && worker.signalCode === null) worker.kill('SIGKILL');
      await exited;
    }
  }, 10000);
  it('keeps row locks authoritative even after nominal lease expiry inside a live transaction', async () => {
    const ready = gate(),
      finish = gate();
    const held = permits.run(owner(), async () =>
      database.transaction(async (tx) => {
        const lease = executionContext.getStore()!;
        await tx.$executeRaw`UPDATE ai."AiExecutionSlot" SET "expiresAt"=clock_timestamp()-interval '1 second' WHERE "leaseId"=${lease.leaseId}::uuid`;
        ready.release();
        await finish.promise;
      }),
    );
    await ready.promise;
    try {
      await secondPermits.run(owner(), () => Promise.resolve(null));
      expect(await db.aiExecutionSlot.count({ where: { leaseId: { not: null } } })).toBe(2);
    } finally {
      finish.release();
      await held;
    }
  });
  it('bounds nonce metadata, never charges a replay twice, and lets other tenants proceed', async () => {
    const limited = new AiDatabaseService(
      settings({ AI_METADATA_OWNER_NONCE_LIMIT: 2 }),
      createAiClient,
    );
    await limited.onModuleInit();
    const store = new RequestNonceStore(limited, settings());
    const now = Date.now(),
      digest = randomBytes(32),
      scope = { tenantId: 'tenant-a', ownerUserId: 'owner-a' };
    try {
      await store.consume(digest, now, now + 5000, now + 5000, scope);
      await expect(store.consume(digest, now, now + 5000, now + 5000, scope)).rejects.toMatchObject(
        { status: 401 },
      );
      await store.consume(randomBytes(32), now, now + 5000, now + 5000, scope);
      await expect(
        store.consume(randomBytes(32), now, now + 5000, now + 5000, scope),
      ).rejects.toMatchObject({ status: 503 });
      expect((await usage()).nonces).toBe(2n);
      await store.consume(randomBytes(32), now, now + 5000, now + 5000, {
        tenantId: 'tenant-b',
        ownerUserId: 'owner-a',
      });
    } finally {
      await limited.onModuleDestroy();
    }
  });
  it('receipt exhaustion rolls back business rows but permits read/delete and leaves live receipts intact', async () => {
    const limited = new AiDatabaseService(
      settings({ AI_METADATA_OWNER_RECEIPT_LIMIT: 1 }),
      createAiClient,
    );
    await limited.onModuleInit();
    const ops = new ConversationOperationsService(
      limited,
      new SubmissionFingerprintService(settings()),
      new MessageEncryptionService(new MessageKeyRing(settings())),
      new MessageContextFactory(),
    );
    try {
      const parent = await ops.createConversation(owner(), 'first');
      await expect(ops.appendUserMessage(owner(), parent.id, 'x', 'second')).rejects.toMatchObject({
        status: 503,
      });
      expect(await usage()).toMatchObject({ conversations: 1n, receipts: 1n, messages: 0n });
      expect(await repository.listOwned(owner())).toHaveLength(1);
      await ops.deleteOwned(owner(), parent.id);
      expect((await usage()).receipts).toBe(1n);
    } finally {
      await limited.onModuleDestroy();
    }
  });
  it('reconciles legacy over-limit storage in bounded resumable batches without deleting or decrypting records', async () => {
    await db.aiConversation.createMany({ data: Array.from({ length: 51 }, () => data()) });
    const parent = await db.aiConversation.findFirstOrThrow();
    await syntheticMessage(parent, 7);
    await db.aiTenantUsage.update({
      where: { tenantId: 'tenant-a' },
      data: { initialized: false },
    });
    await expect(repository.create(owner())).rejects.toMatchObject({ status: 503 });
    const reconcile = new ResourceReconciliationService(database);
    let progress = await reconcile.step('tenant-a', 10);
    expect(progress.done).toBe(false);
    await expect(permits.run(owner(), () => repository.listOwned(owner()))).rejects.toMatchObject({
      status: 503,
    });
    await expect(db.aiConversation.create({ data: data() })).rejects.toThrow();
    await repository.create(owner('independent', 'other'));
    for (let i = 0; !progress.done && i < 30; i++)
      progress = await new ResourceReconciliationService(replica).step('tenant-a', 10);
    expect(progress.done).toBe(true);
    expect(await usage()).toMatchObject({
      conversations: 51n,
      messages: 1n,
      encryptedBytes: 44n,
      initialized: true,
      reconciling: false,
    });
    expect(await reconcile.step('tenant-a', 10)).toEqual({ stage: 6, done: true, processed: 0 });
    expect(await db.aiConversation.count({ where: { tenantId: 'tenant-a' } })).toBe(51);
    await expect(repository.create(owner())).rejects.toMatchObject({ status: 409 });
    await operations.deleteOwned(owner(), parent.id);
    expect((await usage()).conversations).toBe(50n);
  });
  it('fails closed for missing usage state and resumes after concurrent explicit reconciliation checkpoints', async () => {
    const parent = await repository.create(owner());
    await db.aiOwnerUsage.deleteMany();
    await expect(
      operations.appendUserMessage(owner(), parent.id, 'x', 'missing-owner'),
    ).rejects.toMatchObject({ status: 503 });
    const reconcile = new ResourceReconciliationService(database);
    await reconcile.step('tenant-a', 1);
    const checkpoint = await db.aiAccountingReconciliation.findUniqueOrThrow({
      where: { tenantId: 'tenant-a' },
    });
    const failing = {
      transaction: (work: Parameters<AiDatabaseService['transaction']>[0]) =>
        database.transaction(async (tx) => {
          await work(tx);
          throw new Error('fixture-rollback');
        }),
    } as unknown as AiDatabaseService;
    await expect(
      new ResourceReconciliationService(failing).step('tenant-a', 1),
    ).rejects.toMatchObject({ status: 503 });
    expect(
      await db.aiAccountingReconciliation.findUnique({ where: { tenantId: 'tenant-a' } }),
    ).toEqual(checkpoint);
    for (let i = 0; i < 10; i++)
      await Promise.all([
        reconcile.step('tenant-a', 1),
        new ResourceReconciliationService(replica).step('tenant-a', 1),
      ]);
    expect(await usage()).toMatchObject({ initialized: true, conversations: 1n, messages: 0n });
    await operations.appendUserMessage(owner(), parent.id, 'x', 'after-recovery');
    expect((await usage()).messages).toBe(1n);
  });
  it('blocks new metadata when cleanup is overdue without discarding live replay records', async () => {
    const createdAt = new Date(Date.now() - 720 * 3600000 - 180000),
      now = Date.now();
    await db.aiSubmissionReceipt.create({
      data: {
        tenantId: 'tenant-a',
        ownerUserId: 'owner-a',
        operation: 'CREATE_CONVERSATION',
        idempotencyKey: 'old',
        fingerprintVersion: 1,
        fingerprintKeyId: 'fixture',
        requestFingerprint: randomBytes(32),
        resultConversationId: randomUUID(),
        outcome: 'STORED',
        createdAt,
        expiresAt: retentionDeadline(createdAt),
      },
    });
    await expect(operations.createConversation(owner(), 'new')).rejects.toMatchObject({
      status: 503,
    });
    expect((await usage()).conversations).toBe(0n);
    await new RetentionCleanupService(database, settings()).runBatch();
    await operations.createConversation(owner(), 'new');
    const store = new RequestNonceStore(database, settings());
    await store.consume(randomBytes(32), now, now + 5000, now + 5000, {
      tenantId: 'tenant-a',
      ownerUserId: 'owner-a',
    });
    // A pre-existing expired nonce from an earlier protected invocation.
    await db.aiRequestNonce.create({
      data: {
        replayDigest: randomBytes(32),
        tenantId: 'tenant-a',
        ownerUserId: 'owner-a',
        createdAt: new Date(now - 240000),
        expiresAt: new Date(now - 180000),
      },
    });
    await expect(
      store.consume(randomBytes(32), now, now + 5000, now + 5000, {
        tenantId: 'tenant-a',
        ownerUserId: 'owner-a',
      }),
    ).rejects.toMatchObject({ status: 503 });
    await new RetentionCleanupService(database, settings()).runBatch();
    expect((await usage()).nonces).toBe(1n);
    expect(await db.aiRequestNonce.count()).toBe(1);
  });
  it('does not charge failed cleanup, skips frozen tenants, and resumes with independent metadata budgets', async () => {
    const parent = await db.aiConversation.create({ data: data('tenant-a', 'owner-a', true) });
    await syntheticMessage(parent, 5);
    const reconcile = new ResourceReconciliationService(database);
    await reconcile.step('tenant-a', 1);
    const other = await db.aiConversation.create({ data: data('tenant-b', 'other', true) });
    await syntheticMessage(other, 5);
    const before = await usage('tenant-b');
    const failing = {
      transaction: (work: Parameters<AiDatabaseService['transaction']>[0]) =>
        database.transaction(async (tx) => {
          await work(tx);
          throw new Error('fixture-cleanup-failure');
        }),
    } as unknown as AiDatabaseService;
    await expect(new RetentionCleanupService(failing, settings()).runBatch()).rejects.toMatchObject(
      { status: 503 },
    );
    expect(await usage('tenant-b')).toEqual(before);
    const cleaned = await new RetentionCleanupService(
      database,
      settings({ AI_CLEANUP_RECEIPT_BATCH_SIZE: 1, AI_CLEANUP_NONCE_BATCH_SIZE: 1 }),
    ).runBatch();
    expect(cleaned.conversationsDeleted).toBe(1);
    expect(await db.aiConversation.findUnique({ where: { id: parent.id } })).not.toBeNull();
    expect(await usage('tenant-b')).toMatchObject({
      messages: 0n,
      encryptedBytes: 0n,
      conversations: 0n,
    });
  });
  it('preserves the real fifteen-second recovery window and rolls back work beyond the statement deadline', async () => {
    await permits.run(owner(), async () => {
      const lease = executionContext.getStore()!;
      const [row] = await db.$queryRaw<
        { remaining: number }[]
      >`SELECT EXTRACT(EPOCH FROM ("expiresAt"-clock_timestamp()))::float AS remaining
        FROM ai."AiExecutionSlot" WHERE "leaseId"=${lease.leaseId}::uuid LIMIT 1`;
      expect(row.remaining).toBeGreaterThan(10);
      expect(row.remaining).toBeLessThanOrEqual(15);
      await expect(
        database.transaction(async (tx) => {
          await tx.aiConversation.create({ data: data() });
          await tx.$queryRaw`SELECT pg_sleep(3)::text`;
        }),
      ).rejects.toMatchObject({ status: 503 });
    });
    expect(await db.aiConversation.count()).toBe(0);
    expect(await usage()).toMatchObject({ conversations: 0n, messages: 0n, encryptedBytes: 0n });
  });
});
