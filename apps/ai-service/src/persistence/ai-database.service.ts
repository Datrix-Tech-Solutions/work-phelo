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
