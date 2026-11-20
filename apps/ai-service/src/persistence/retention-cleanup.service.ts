import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { performance } from 'perf_hooks';
import { AiDatabaseService } from './ai-database.service';
import { ConversationOperationError } from './conversation-operation.error';
import { appendReceiptLockScope } from './retention-policy';

@Injectable()
export class RetentionCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionCleanupService.name);
  private timer?: ReturnType<typeof setInterval>;
  private scheduled?: Promise<unknown>;
  private diagnostics = {
    lastSuccessAt: null as string | null,
    conversationsDeleted: 0,
    messagesDeleted: 0,
    receiptsDeleted: 0,
    noncesDeleted: 0,
    lastDurationMs: 0,
    failureCount: 0,
    conversationBacklog: 0,
    backlogCapped: false,
    receiptBacklog: 0,
    receiptBacklogCapped: false,
    nonceBacklog: 0,
    nonceBacklogCapped: false,
    oldestExpiredAgeSeconds: 0,
  };

  constructor(
    private readonly database: AiDatabaseService,
    private readonly config: ConfigService,
  ) {}

  status() {
    return { ...this.diagnostics };
  }

  onModuleInit(): void {
    if (this.config.get<unknown>('AI_RETENTION_SCHEDULER_ENABLED') !== true) return;
    this.requireEnabled();
    const interval = this.config.get<number>('AI_CLEANUP_INTERVAL_MS') ?? 60000;
    if (!Number.isInteger(interval) || interval < 1000 || interval > 3600000)
      throw new ConversationOperationError(503);
    this.timer = setInterval(() => {
      if (this.scheduled) return;
      this.scheduled = this.runBatch()
        .catch(() => undefined)
        .finally(() => {
          this.scheduled = undefined;
        });
    }, interval);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.scheduled;
  }

  private requireEnabled() {
    if (
      this.config.get<unknown>('AI_RETENTION_CLEANUP_ENABLED') !== true ||
      this.config.get<unknown>('AI_PERSISTENCE_ENABLED') !== true ||
      this.config.get<unknown>('NODE_ENV') === 'production'
    )
      throw new ConversationOperationError(503);
  }

  async runBatch() {
    this.requireEnabled();
    const limit = this.config.get<number>('AI_CLEANUP_BATCH_SIZE') ?? 25;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new ConversationOperationError(503);
    const start = performance.now();
    try {
      const result = await this.database.transaction(async (tx) => {
        const expired = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM ai."AiConversation"
          WHERE "expiresAt" <= statement_timestamp() ORDER BY "expiresAt", id LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
        const parentIds = expired.map((row) => row.id);
        // Bound child work too: a parent-only LIMIT does not bound a cascade.
        const messages = parentIds.length
          ? await tx.$queryRaw<{ id: string }[]>`
              SELECT id FROM ai."AiConversationMessage"
              WHERE "conversationId" = ANY(${parentIds}::uuid[])
              ORDER BY "conversationId", sequence LIMIT ${limit} FOR UPDATE SKIP LOCKED`
          : [];
        const deletedMessages = await tx.aiConversationMessage.deleteMany({
          where: { id: { in: messages.map((row) => row.id) } },
        });
        const conversations = await tx.aiConversation.deleteMany({
          where: { id: { in: parentIds }, messages: { none: {} } },
        });
        const receipts = await tx.$queryRaw<
          {
            id: string;
            tenantId: string;
            ownerUserId: string;
            operation: string;
            idempotencyKey: string;
          }[]
        >`
          SELECT id, "tenantId", "ownerUserId", operation, "idempotencyKey" FROM ai."AiSubmissionReceipt"
          WHERE "expiresAt" <= statement_timestamp() ORDER BY "expiresAt", id LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
        const removable: string[] = [];
        for (const receipt of receipts) {
          // Append locks the key BEFORE the parent. Never wait in the reverse order here.
          // CREATE receipts expire with their parent; expired-key reuse is a new operation.
          if (receipt.operation !== 'APPEND_MESSAGE') {
            removable.push(receipt.id);
            continue;
          }
          const scope = appendReceiptLockScope(
            receipt.tenantId,
            receipt.ownerUserId,
            receipt.idempotencyKey,
          );
          const [lock] = await tx.$queryRaw<
            { acquired: boolean }[]
          >`SELECT pg_try_advisory_xact_lock(hashtextextended(${scope}, 0)) AS acquired`;
          if (lock.acquired) removable.push(receipt.id);
        }
        const deletedReceipts = await tx.aiSubmissionReceipt.deleteMany({
          where: { id: { in: removable } },
        });
        const nonces = await tx.$queryRaw<{ replayDigest: Buffer }[]>`
          SELECT "replayDigest" FROM ai."AiRequestNonce"
          WHERE "expiresAt" <= statement_timestamp() ORDER BY "expiresAt", "replayDigest"
          LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
        const deletedNonces = await tx.aiRequestNonce.deleteMany({
          where: { replayDigest: { in: nonces.map((row) => row.replayDigest) } },
        });
        // A bounded indexed sample, not an unbounded count across the AI schema.
        const backlog = await tx.$queryRaw<
          { expiresAt: Date }[]
        >`SELECT "expiresAt" FROM ai."AiConversation"
          WHERE "expiresAt" <= statement_timestamp() ORDER BY "expiresAt", id LIMIT 1001`;
        const receiptBacklog = await tx.$queryRaw<{ expiresAt: Date }[]>`
          SELECT "expiresAt" FROM ai."AiSubmissionReceipt"
          WHERE "expiresAt" <= statement_timestamp() ORDER BY "expiresAt", id LIMIT 1001`;
        const nonceBacklog = await tx.$queryRaw<{ expiresAt: Date }[]>`
          SELECT "expiresAt" FROM ai."AiRequestNonce"
          WHERE "expiresAt" <= statement_timestamp() ORDER BY "expiresAt", "replayDigest" LIMIT 1001`;
        const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
        return {
          conversationsDeleted: conversations.count,
          messagesDeleted: deletedMessages.count,
          receiptsDeleted: deletedReceipts.count,
          noncesDeleted: deletedNonces.count,
          conversationBacklog: Math.min(backlog.length, 1000),
          backlogCapped: backlog.length > 1000,
          receiptBacklog: Math.min(receiptBacklog.length, 1000),
          receiptBacklogCapped: receiptBacklog.length > 1000,
          nonceBacklog: Math.min(nonceBacklog.length, 1000),
          nonceBacklogCapped: nonceBacklog.length > 1000,
          oldestExpiredAgeSeconds: backlog[0]
            ? Math.max(0, Math.floor((clock.now.getTime() - backlog[0].expiresAt.getTime()) / 1000))
            : 0,
          lastSuccessAt: clock.now.toISOString(),
        };
      });
      const duration = Math.max(0, Math.floor(performance.now() - start));
      this.diagnostics = {
        ...this.diagnostics,
        ...result,
        lastDurationMs: duration,
        conversationsDeleted: this.diagnostics.conversationsDeleted + result.conversationsDeleted,
        messagesDeleted: this.diagnostics.messagesDeleted + result.messagesDeleted,
        receiptsDeleted: this.diagnostics.receiptsDeleted + result.receiptsDeleted,
        noncesDeleted: this.diagnostics.noncesDeleted + result.noncesDeleted,
      };
      this.logger.log(
        JSON.stringify({ event: 'ai_cleanup_success', ...result, durationMs: duration }),
      );
      return result;
    } catch {
      this.diagnostics.failureCount++;
      this.diagnostics.lastDurationMs = Math.max(0, Math.floor(performance.now() - start));
      this.logger.warn(
        JSON.stringify({
          event: 'ai_cleanup_failure',
          failureCount: this.diagnostics.failureCount,
          durationMs: this.diagnostics.lastDurationMs,
        }),
      );
      throw new ConversationOperationError(503);
    }
  }
}
