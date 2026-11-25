import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AiDatabaseService } from './ai-database.service';
import { executionContext, ExecutionLease } from './execution-context';
import { OwnershipContext, ownershipDeadline, requireOwnership } from './ownership-context';
import { ConversationOperationError } from './conversation-operation.error';
import { ResourceError } from './resource-error';

@Injectable()
export class ExecutionPermits {
  constructor(
    private readonly database: AiDatabaseService,
    private readonly config: ConfigService,
  ) {}

  async run<T>(context: OwnershipContext, action: () => Promise<T>): Promise<T> {
    if (this.config.get<unknown>('AI_RESOURCE_SAFEGUARDS_ENABLED') !== true)
      throw new ConversationOperationError(503);
    const owner = requireOwnership(context);
    const lease: ExecutionLease = { ...owner, leaseId: randomUUID(), slots: [] };
    await this.database.transaction(async (tx) => {
      await tx.$queryRaw`SELECT ai.resource_prepare(${owner.tenantId},${owner.ownerUserId})`;
      for (const [user, capacity] of [
        ['', 10],
        [owner.ownerUserId, 2],
      ] as const) {
        await tx.$executeRaw`INSERT INTO ai."AiExecutionSlot" ("tenantId","ownerUserId",slot)
          SELECT ${owner.tenantId},${user},n FROM generate_series(0,${capacity - 1}) n
          WHERE NOT EXISTS (SELECT 1 FROM ai."AiExecutionSlot" s
            WHERE s."tenantId"=${owner.tenantId} AND s."ownerUserId"=${user} AND s.slot=n)
          ON CONFLICT DO NOTHING`;
        const rows = await tx.$queryRaw<{ slot: number; generation: bigint }[]>`
          SELECT slot,generation FROM ai."AiExecutionSlot"
          WHERE "tenantId"=${owner.tenantId} AND "ownerUserId"=${user} AND "expiresAt"<=clock_timestamp()
          ORDER BY slot LIMIT 1 FOR UPDATE SKIP LOCKED`;
        if (!rows[0]) throw new ResourceError('AI_EXECUTION_LIMITED');
        const generation = rows[0].generation + 1n;
        await tx.$executeRaw`UPDATE ai."AiExecutionSlot" SET "leaseId"=${lease.leaseId}::uuid,
          generation=${generation},"expiresAt"=clock_timestamp()+interval '15 seconds'
          WHERE "tenantId"=${owner.tenantId} AND "ownerUserId"=${user} AND slot=${rows[0].slot}`;
        lease.slots.push({ ownerUserId: user, slot: rows[0].slot, generation });
      }
    }, ownershipDeadline(context));
    try {
      return await executionContext.run(lease, action);
    } finally {
      // Only AI completion releases active execution; a Gateway disconnect cannot.
      await executionContext.exit(async () => {
        try {
          await this.database.transaction(async (tx) => {
            for (const slot of lease.slots)
              await tx.$executeRaw`UPDATE ai."AiExecutionSlot" SET "leaseId"=NULL,"expiresAt"=clock_timestamp()
                WHERE "tenantId"=${owner.tenantId} AND "ownerUserId"=${slot.ownerUserId} AND slot=${slot.slot}
                AND "leaseId"=${lease.leaseId}::uuid AND generation=${slot.generation}`;
          });
        } catch {
          /* Expiry recovers only after any held transaction locks release. */
        }
      });
    }
  }
}
