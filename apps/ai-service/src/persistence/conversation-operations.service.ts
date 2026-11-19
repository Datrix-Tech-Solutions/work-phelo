import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '../../prisma/generated/client';
import { MessageContextFactory } from '../encryption/message-context';
import {
  MAX_MESSAGE_BYTES,
  MessageEncryptionService,
} from '../encryption/message-encryption.service';
import { AiDatabaseService } from './ai-database.service';
import { ConversationOperationError } from './conversation-operation.error';
import { OwnershipContext, ownershipDeadline, requireOwnership } from './ownership-context';
import { SubmissionFingerprintService } from './submission-fingerprint.service';
import { appendReceiptLockScope, retentionDeadline } from './retention-policy';
import { messageCursor } from './conversation-pagination';

// IDs minted by this service are canonical lowercase UUIDs; do not normalize inputs.
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/;
type Owner = ReturnType<typeof requireOwnership>;
type LockedConversation = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  nextMessageSequence: number;
};
export const MAX_DETAIL_RESPONSE_BYTES = 256 * 1024;
const resultSelect = {
  id: true,
  conversationId: true,
  sequence: true,
  role: true,
  createdAt: true,
} as const;

@Injectable()
export class ConversationOperationsService {
  constructor(
    private readonly database: AiDatabaseService,
    private readonly fingerprints: SubmissionFingerprintService,
    private readonly encryption: MessageEncryptionService,
    private readonly contexts: MessageContextFactory,
  ) {}

  private async lock(tx: Prisma.TransactionClient, owner: Owner, id: string, write = true) {
    if (typeof id !== 'string' || !uuid.test(id)) throw new ConversationOperationError(404);
    const rows = write
      ? await tx.$queryRaw<
          LockedConversation[]
        >`SELECT id, "createdAt", "updatedAt", "expiresAt", "nextMessageSequence" FROM ai."AiConversation"
          WHERE id = ${id}::uuid AND "tenantId" = ${owner.tenantId} AND "ownerUserId" = ${owner.ownerUserId} FOR UPDATE`
      : await tx.$queryRaw<
          LockedConversation[]
        >`SELECT id, "createdAt", "updatedAt", "expiresAt", "nextMessageSequence" FROM ai."AiConversation"
          WHERE id = ${id}::uuid AND "tenantId" = ${owner.tenantId} AND "ownerUserId" = ${owner.ownerUserId} FOR SHARE`;
    // Recheck using the DB clock AFTER any lock wait, not its pre-wait snapshot.
    await this.live(tx, rows[0]);
    return rows[0];
  }

  private async live(tx: Prisma.TransactionClient, conversation?: LockedConversation) {
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    if (!conversation || conversation.expiresAt <= clock.now)
      throw new ConversationOperationError(404);
    return clock.now;
  }

  async appendUserMessage(
    context: OwnershipContext,
    conversationId: string,
    content: string,
    idempotencyKey: string,
  ) {
    const owner = requireOwnership(context);
    this.fingerprints.requireEnabled();
    if (
      typeof content !== 'string' ||
      !content.length ||
      Buffer.byteLength(content, 'utf8') > MAX_MESSAGE_BYTES ||
      Buffer.from(content, 'utf8').toString('utf8') !== content ||
      typeof idempotencyKey !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(idempotencyKey)
    )
      throw new ConversationOperationError(400);
    if (typeof conversationId !== 'string' || !uuid.test(conversationId))
      throw new ConversationOperationError(404);
    const input = { ...owner, conversationId, content };
    const fingerprint = this.fingerprints.create(input);
    return this.database.transaction(async (tx) => {
      // The receipt scope spans conversations. Acquire this lock before the parent lock.
      const scope = appendReceiptLockScope(owner.tenantId, owner.ownerUserId, idempotencyKey);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))::text`;
      const conversation = await this.lock(tx, owner, conversationId);
      const receipt = await tx.aiSubmissionReceipt.findUnique({
        where: {
          tenantId_ownerUserId_operation_idempotencyKey: {
            ...owner,
            operation: 'APPEND_MESSAGE',
            idempotencyKey,
          },
        },
      });
      if (receipt) {
        const now = await this.live(tx, conversation);
        if (receipt.expiresAt <= now) throw new ConversationOperationError(404);
        this.fingerprints.verify(input, receipt);
        if (
          receipt.outcome !== 'STORED' ||
          receipt.resultConversationId !== conversationId ||
          !receipt.resultMessageId
        )
          throw new ConversationOperationError(503);
        const result = await tx.aiConversationMessage.findFirst({
          where: {
            id: receipt.resultMessageId,
            conversationId,
            ...owner,
            role: 'USER',
            status: 'STORED',
          },
          select: resultSelect,
        });
        if (!result) throw new ConversationOperationError(404);
        await this.live(tx, conversation);
        return result;
      }
      const sequence = conversation.nextMessageSequence;
      if (sequence >= 2147483647) throw new ConversationOperationError(503);
      const id = randomUUID();
      const envelope = this.encryption.encryptMessage(
        content,
        this.contexts.forMessage(context, {
          conversationId,
          messageId: id,
          role: 'USER',
          sequence,
        }),
      );
      const message = await tx.aiConversationMessage.create({
        data: { id, conversationId, ...owner, sequence, ...envelope },
        select: resultSelect,
      });
      await tx.aiConversation.update({
        where: { id: conversationId },
        data: { nextMessageSequence: sequence + 1 },
      });
      const receiptCreatedAt = await this.live(tx, conversation);
      await tx.aiSubmissionReceipt.create({
        data: {
          ...owner,
          operation: 'APPEND_MESSAGE',
          idempotencyKey,
          ...fingerprint,
          resultConversationId: conversationId,
          resultMessageId: id,
          outcome: 'STORED',
          createdAt: receiptCreatedAt,
          // Physical retention is independent of parent replay eligibility.
          expiresAt: retentionDeadline(receiptCreatedAt),
        },
      });
      await this.live(tx, conversation);
      return message;
    }, ownershipDeadline(context));
  }

  async readOwnedMessagePage(
    context: OwnershipContext,
    conversationId: string,
    afterSequence = 0,
    limit = 20,
  ) {
    const result = await this.readOwnedDetail(context, conversationId, afterSequence, limit);
    return { items: result.messages.items, nextAfterSequence: result.messages.nextAfterSequence };
  }

  async readOwnedDetail(
    context: OwnershipContext,
    conversationId: string,
    afterSequence = 0,
    limit = 20,
  ) {
    const owner = requireOwnership(context);
    this.fingerprints.requireEnabled();
    if (
      !Number.isInteger(afterSequence) ||
      afterSequence < 0 ||
      afterSequence > 2147483647 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new ConversationOperationError(400);
    return this.database.transaction(async (tx) => {
      const conversation = await this.lock(tx, owner, conversationId, false);
      const rows = await tx.aiConversationMessage.findMany({
        where: { conversationId, ...owner, sequence: { gt: afterSequence } },
        orderBy: { sequence: 'asc' },
        take: limit,
      });
      const items: {
        id: string;
        conversationId: string;
        sequence: number;
        role: 'USER';
        createdAt: Date;
        content: string;
      }[] = [];
      let responseBytes = 1024;
      for (const row of rows) {
        const item = {
          id: row.id,
          conversationId: row.conversationId,
          sequence: row.sequence,
          role: row.role,
          createdAt: row.createdAt,
          content: this.encryption.decryptMessage(
            {
              encryptionVersion: row.encryptionVersion,
              keyId: row.keyId,
              ciphertext: row.ciphertext,
              nonce: row.nonce,
              authenticationTag: row.authenticationTag,
            },
            this.contexts.forMessage(context, {
              conversationId: row.conversationId,
              messageId: row.id,
              role: row.role,
              sequence: row.sequence,
            }),
          ),
        };
        const size = Buffer.byteLength(JSON.stringify(item), 'utf8');
        if (responseBytes + size > MAX_DETAIL_RESPONSE_BYTES) break;
        responseBytes += size;
        items.push(item);
      }
      await this.live(tx, conversation);
      return {
        conversation: {
          id: conversation.id,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          expiresAt: conversation.expiresAt,
        },
        messages: {
          items,
          nextAfterSequence:
            items.length && (items.length === limit || items.length < rows.length)
              ? items[items.length - 1].sequence
              : null,
          nextCursor:
            items.length && (items.length === limit || items.length < rows.length)
              ? messageCursor(items[items.length - 1].sequence)
              : null,
        },
      };
    }, ownershipDeadline(context));
  }

  async deleteOwned(context: OwnershipContext, conversationId: string): Promise<void> {
    const owner = requireOwnership(context);
    this.fingerprints.requireEnabled();
    await this.database.transaction(async (tx) => {
      const conversation = await this.lock(tx, owner, conversationId);
      const deleted = await tx.aiConversation.deleteMany({
        where: { id: conversationId, ...owner },
      });
      if (deleted.count !== 1) throw new ConversationOperationError(404);
      await this.live(tx, conversation);
      // No deletion receipt/acknowledgement tombstone: a second deletion returns 404.
    }, ownershipDeadline(context));
  }

  async createConversation(context: OwnershipContext, idempotencyKey: string) {
    const owner = requireOwnership(context);
    this.fingerprints.requireEnabled();
    if (
      typeof idempotencyKey !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(idempotencyKey)
    )
      throw new ConversationOperationError(400);
    const fingerprint = this.fingerprints.createConversation(owner);
    return this.database.transaction(async (tx) => {
      const scope = JSON.stringify([
        'ai.create.v1',
        owner.tenantId,
        owner.ownerUserId,
        idempotencyKey,
      ]);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))::text`;
      const receipt = await tx.aiSubmissionReceipt.findUnique({
        where: {
          tenantId_ownerUserId_operation_idempotencyKey: {
            ...owner,
            operation: 'CREATE_CONVERSATION',
            idempotencyKey,
          },
        },
      });
      if (receipt) {
        this.fingerprints.verifyConversation(owner, receipt);
        if (receipt.outcome !== 'STORED' || receipt.resultMessageId !== null)
          throw new ConversationOperationError(503);
        const conversation = await this.lock(tx, owner, receipt.resultConversationId, false);
        const now = await this.live(tx, conversation);
        if (receipt.expiresAt <= now) throw new ConversationOperationError(404);
        return {
          id: conversation.id,
          createdAt: conversation.createdAt,
          expiresAt: conversation.expiresAt,
        };
      }
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`;
      const conversation = await tx.aiConversation.create({
        data: { ...owner, createdAt: clock.now, expiresAt: retentionDeadline(clock.now) },
        select: { id: true, createdAt: true, expiresAt: true },
      });
      await tx.aiSubmissionReceipt.create({
        data: {
          ...owner,
          operation: 'CREATE_CONVERSATION',
          idempotencyKey,
          ...fingerprint,
          resultConversationId: conversation.id,
          outcome: 'STORED',
          createdAt: clock.now,
          expiresAt: retentionDeadline(clock.now),
        },
      });
      return conversation;
    }, ownershipDeadline(context));
  }
}
