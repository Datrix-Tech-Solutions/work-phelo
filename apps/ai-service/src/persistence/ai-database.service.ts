import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '../../prisma/generated/client';
import { ConversationOperationError } from './conversation-operation.error';
import { performance } from 'perf_hooks';
import { executionContext } from './execution-context';
import { ResourceError } from './resource-error';

export const AI_CLIENT_FACTORY = Symbol('AI_CLIENT_FACTORY');
export type AiClientFactory = (url: string) => PrismaClient;
export const createAiClient: AiClientFactory = (url) =>
  new PrismaClient({
    datasources: { db: { url } },
    errorFormat: 'minimal',
    log: [],
  });

@Injectable()
export class AiDatabaseService implements OnModuleInit, OnModuleDestroy {
  private client?: PrismaClient;
  constructor(
    private readonly config: ConfigService,
    @Inject(AI_CLIENT_FACTORY) private readonly factory: AiClientFactory,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<unknown>('AI_PERSISTENCE_ENABLED') !== true) return;
    try {
      const url = this.config.get<string>('DATABASE_URL');
      if (!url) throw new Error();
      this.client = this.factory(url);
      await this.client.$connect();
    } catch {
      await this.onModuleDestroy();
      throw new ServiceUnavailableException('Persistence unavailable');
    }
  }

  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    if (client) {
      try {
        await client.$disconnect();
      } catch {
        /* Do not leak driver diagnostics. */
      }
    }
  }

  // Internal provider only: exported module API is the ownership-scoped repository.
  async run<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
    if (!this.client) throw new ServiceUnavailableException('Persistence unavailable');
    try {
      return await operation(this.client);
    } catch {
      throw new ServiceUnavailableException('Persistence unavailable');
    }
  }

  async transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    requestDeadlineAtMs?: number,
  ): Promise<T> {
    if (!this.client) throw new ConversationOperationError(503);
    const configured = this.config.get<number>('AI_REQUEST_TIMEOUT_MS') ?? 5000;
    const requestBudget =
      requestDeadlineAtMs === undefined ? Infinity : requestDeadlineAtMs - Date.now();
    const requestLimited = requestBudget < Math.min(configured, 5000);
    const deadline = performance.now() + Math.min(configured, 5000, requestBudget) - 100;
    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = Math.floor(deadline - performance.now());
      if (!Number.isFinite(remaining) || remaining < 10)
        throw new ConversationOperationError(requestDeadlineAtMs === undefined ? 503 : 504);
      const maxWait = Math.min(1000, Math.floor(remaining / 4));
      const timeout = Math.min(4000, remaining - maxWait);
      try {
        return await this.client.$transaction(
          async (tx) => {
            if (performance.now() >= deadline)
              throw new ConversationOperationError(requestDeadlineAtMs === undefined ? 503 : 504);
            await tx.$queryRaw`SELECT set_config('lock_timeout', ${String(Math.min(1500, timeout))}, true)`;
            await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(Math.min(2500, timeout))}, true)`;
            if (this.config.get<unknown>('AI_RESOURCE_SAFEGUARDS_ENABLED') === true) {
              await tx.$queryRaw`SELECT set_config('workphelo.ai_resources','on',true)`;
              await tx.$queryRaw`SELECT set_config('idle_in_transaction_session_timeout','4000',true)`;
              for (const [name, fallback] of [
                ['AI_METADATA_OWNER_RECEIPT_LIMIT', 432002],
                ['AI_METADATA_TENANT_RECEIPT_LIMIT', 4320020],
                ['AI_METADATA_OWNER_NONCE_LIMIT', 256],
                ['AI_METADATA_TENANT_NONCE_LIMIT', 4096],
                ['AI_METADATA_BACKLOG_GRACE_SECONDS', 120],
              ] as const) {
                const value = this.config.get<number>(name) ?? fallback;
                await tx.$queryRaw`SELECT set_config(${'workphelo.' + name.toLowerCase()},${String(value)},true)`;
              }
              const lease = executionContext.getStore();
              if (lease)
                for (const slot of lease.slots) {
                  const held = await tx.$queryRaw<{ generation: bigint }[]>`
                  SELECT generation FROM ai."AiExecutionSlot" WHERE "tenantId"=${lease.tenantId}
                    AND "ownerUserId"=${slot.ownerUserId} AND slot=${slot.slot}
                    AND "leaseId"=${lease.leaseId}::uuid AND generation=${slot.generation}
                    AND "expiresAt">clock_timestamp() FOR SHARE`;
                  if (!held.length) throw new ConversationOperationError(504);
                }
            }
            if (performance.now() >= deadline)
              throw new ConversationOperationError(requestDeadlineAtMs === undefined ? 503 : 504);
            const result = await operation(tx);
            if (performance.now() >= deadline)
              throw new ConversationOperationError(requestDeadlineAtMs === undefined ? 503 : 504);
            return result;
          },
          { maxWait, timeout, isolationLevel: 'ReadCommitted' },
        );
      } catch (error) {
        if (error instanceof ResourceError) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010') {
          const message = typeof error.meta?.message === 'string' ? error.meta.message : '';
          if (message.includes('AI_STORAGE_QUOTA_EXCEEDED'))
            throw new ResourceError('AI_STORAGE_QUOTA_EXCEEDED');
          if (message.includes('AI_METADATA_CAPACITY'))
            throw new ResourceError('AI_METADATA_CAPACITY');
        }
        // Prisma ORM wraps trigger errors differently from raw queries.
        if (error instanceof Error && error.message.includes('AI_STORAGE_QUOTA_EXCEEDED'))
          throw new ResourceError('AI_STORAGE_QUOTA_EXCEEDED');
        if (error instanceof ConversationOperationError) throw error;
        if (requestDeadlineAtMs !== undefined && performance.now() >= deadline)
          throw new ConversationOperationError(504);
        if (
          requestLimited &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2028' ||
            (error.code === 'P2010' && ['57014', '55P03'].includes(String(error.meta?.code))))
        )
          throw new ConversationOperationError(504);
        const transient =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' ||
            (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))));
        if (!transient || attempt === 2) throw new ConversationOperationError(503);
        const delay = 10 * (attempt + 1);
        if (performance.now() + delay + 10 >= deadline)
          throw new ConversationOperationError(requestDeadlineAtMs === undefined ? 503 : 504);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new ConversationOperationError(503);
  }
}
