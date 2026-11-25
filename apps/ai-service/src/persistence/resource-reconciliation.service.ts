import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiDatabaseService } from './ai-database.service';
import { ConversationOperationError } from './conversation-operation.error';
import { Prisma } from '../../prisma/generated/client';

// Explicit operator API, never called from startup or an HTTP handler. Each call
// commits one checkpoint; source mutations are frozen only for this tenant.
@Injectable()
export class ResourceReconciliationService {
  constructor(private readonly database: AiDatabaseService) {}

  async step(tenantId: string, batchSize = 100, restart = false) {
    if (
      !tenantId.trim() ||
      tenantId.length > 200 ||
      !Number.isInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > 500
    )
      throw new ConversationOperationError(400);
    return this.database.transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'ai.usage.' + tenantId},0))::text`;
      let job = await tx.aiAccountingReconciliation.findUnique({ where: { tenantId } });
      if (restart && job?.stage === 6) {
        await tx.aiAccountingReconciliation.delete({ where: { tenantId } });
        job = null;
      }
      if (!job) {
        job = await tx.aiAccountingReconciliation.create({
          data: { tenantId, epoch: randomUUID() },
        });
        await tx.aiTenantUsage.upsert({
          where: { tenantId },
          create: { tenantId, reconciling: true },
          update: {
            initialized: false,
            reconciling: true,
            conversations: 0,
            messages: 0,
            encryptedBytes: 0,
            receipts: 0,
            nonces: 0,
          },
        });
      }
      if (job.stage === 6) return { stage: 6, done: true, processed: 0 };
      let count = 0;
      let cursor = job.cursor;
      if (job.stage === 0) {
        const removed = await tx.$queryRaw<{ ownerUserId: string }[]>`
          DELETE FROM ai."AiOwnerUsage" WHERE ("tenantId","ownerUserId") IN
          (SELECT "tenantId","ownerUserId" FROM ai."AiOwnerUsage" WHERE "tenantId"=${tenantId}
           ORDER BY "ownerUserId" LIMIT ${batchSize}) RETURNING "ownerUserId"`;
        count = removed.length;
      } else if (job.stage < 5) {
        type Row = {
          id: string;
          ownerUserId: string;
          conversationId: string | null;
          bytes: bigint;
        };
        let rows: Row[];
        const afterId = cursor ? Prisma.sql`AND id>${cursor}::uuid` : Prisma.empty;
        if (job.stage === 1)
          rows = await tx.$queryRaw<Row[]>`
          SELECT id,"ownerUserId",id AS "conversationId",0::bigint AS bytes
          FROM ai."AiConversation" WHERE "tenantId"=${tenantId} ${afterId} ORDER BY id LIMIT ${batchSize}`;
        else if (job.stage === 2)
          rows = await tx.$queryRaw<Row[]>`
          SELECT id,"ownerUserId","conversationId",
            (octet_length(ciphertext)+octet_length(nonce)+octet_length("authenticationTag")+octet_length("keyId")+2)::bigint AS bytes
          FROM ai."AiConversationMessage" WHERE "tenantId"=${tenantId} ${afterId} ORDER BY id LIMIT ${batchSize}`;
        else if (job.stage === 3)
          rows = await tx.$queryRaw<Row[]>`
          SELECT id,"ownerUserId",NULL::text AS "conversationId",0::bigint AS bytes
          FROM ai."AiSubmissionReceipt" WHERE "tenantId"=${tenantId} ${afterId} ORDER BY id LIMIT ${batchSize}`;
        else
          rows = await tx.$queryRaw<Row[]>`
          SELECT encode("replayDigest",'hex') AS id,"ownerUserId",NULL::text AS "conversationId",0::bigint AS bytes
          FROM ai."AiRequestNonce" WHERE "tenantId"=${tenantId} AND "replayDigest">decode(${cursor},'hex')
          ORDER BY "replayDigest" LIMIT ${batchSize}`;
        count = rows.length;
        for (const row of rows) {
          const delta = {
            conversations: job.stage === 1 ? 1n : 0n,
            messages: job.stage === 2 ? 1n : 0n,
            encryptedBytes: row.bytes,
            receipts: job.stage === 3 ? 1n : 0n,
            nonces: job.stage === 4 ? 1n : 0n,
          };
          await tx.aiOwnerUsage.upsert({
            where: { tenantId_ownerUserId: { tenantId, ownerUserId: row.ownerUserId } },
            create: { tenantId, ownerUserId: row.ownerUserId, ...delta },
            update: Object.fromEntries(
              Object.entries(delta).map(([key, value]) => [key, { increment: value }]),
            ),
          });
          await tx.aiTenantUsage.update({
            where: { tenantId },
            data: Object.fromEntries(
              Object.entries(delta).map(([key, value]) => [key, { increment: value }]),
            ),
          });
          if (job.stage === 1)
            await tx.aiConversationUsage.upsert({
              where: { conversationId: row.id },
              create: { conversationId: row.id },
              update: { messages: 0, encryptedBytes: 0 },
            });
          if (job.stage === 2)
            await tx.aiConversationUsage.update({
              where: { conversationId: row.conversationId! },
              data: { messages: { increment: 1 }, encryptedBytes: { increment: row.bytes } },
            });
          cursor = row.id;
        }
      }
      let stage = job.stage;
      if (count < batchSize) {
        stage++;
        cursor = '';
      }
      // Stage 5 is a separate durable finalize checkpoint after the frozen scan.
      if (job.stage === 5) {
        await tx.aiTenantUsage.update({
          where: { tenantId },
          data: { initialized: true, reconciling: false },
        });
        stage = 6;
      }
      await tx.aiAccountingReconciliation.update({ where: { tenantId }, data: { stage, cursor } });
      return { stage, done: stage === 6, processed: count };
    });
  }
}
