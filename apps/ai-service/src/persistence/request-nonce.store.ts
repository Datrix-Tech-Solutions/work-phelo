import {
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiDatabaseService } from './ai-database.service';
import { ConversationOperationError } from './conversation-operation.error';

@Injectable()
export class RequestNonceStore implements OnModuleInit {
  constructor(
    private readonly database: AiDatabaseService,
    private readonly config: ConfigService,
  ) {}
  private requireEnabled() {
    if (
      this.config.get<unknown>('AI_REQUEST_VERIFICATION_ENABLED') !== true ||
      this.config.get<unknown>('AI_PERSISTENCE_ENABLED') !== true
    )
      throw new ServiceUnavailableException();
  }
  async onModuleInit(): Promise<void> {
    if (this.config.get<unknown>('AI_REQUEST_VERIFICATION_ENABLED') !== true) return;
    this.requireEnabled();
    try {
      await this.database.run(
        (db) => db.$queryRaw`SELECT "replayDigest", "expiresAt" FROM ai."AiRequestNonce" LIMIT 0`,
      );
    } catch {
      throw new ServiceUnavailableException();
    }
  }
  async consume(
    digest: Buffer,
    issuedAtMs: number,
    proofExpiryMs: number,
    deadlineAtMs: number,
    owner?: { tenantId: string; ownerUserId: string },
  ): Promise<void> {
    this.requireEnabled();
    if (
      !Buffer.isBuffer(digest) ||
      digest.length !== 32 ||
      ![issuedAtMs, proofExpiryMs, deadlineAtMs].every(Number.isSafeInteger)
    )
      throw new UnauthorizedException();
    const validUntil = new Date(Math.min(proofExpiryMs, deadlineAtMs));
    const retainUntil = new Date(Math.max(proofExpiryMs, deadlineAtMs) + 60000);
    let consumed: boolean;
    try {
      consumed = await this.database.transaction(async (tx) => {
        if (this.config.get<unknown>('AI_RESOURCE_SAFEGUARDS_ENABLED') === true) {
          if (!owner) throw new ConversationOperationError(503);
          await tx.$queryRaw`SELECT ai.resource_prepare(${owner.tenantId},${owner.ownerUserId})`;
          const legacy = await tx.$queryRaw<{ replayDigest: Buffer }[]>`SELECT "replayDigest"
            FROM ai."AiRequestNonce" WHERE "tenantId" IS NULL LIMIT 4097`;
          if (legacy.length > 4096) throw new ConversationOperationError(503);
          const backlog = await tx.$queryRaw<{ found: boolean }[]>`SELECT EXISTS(
            SELECT 1 FROM ai."AiRequestNonce" WHERE "tenantId"=${owner.tenantId}
            AND "expiresAt" < clock_timestamp()-${this.config.get<number>('AI_METADATA_BACKLOG_GRACE_SECONDS') ?? 120}*interval '1 second'
            LIMIT 1) AS found`;
          if (backlog[0].found) throw new ConversationOperationError(503);
        }
        const inserted =
          await tx.$executeRaw`INSERT INTO ai."AiRequestNonce" ("replayDigest", "createdAt", "expiresAt","tenantId","ownerUserId")
          SELECT ${digest}, date_trunc('milliseconds', clock_timestamp()), ${retainUntil},${owner?.tenantId ?? null},${owner?.ownerUserId ?? null}
          WHERE clock_timestamp() < ${validUntil} AND ${new Date(issuedAtMs)} <= clock_timestamp() + interval '1 second'
          ON CONFLICT ("replayDigest") DO NOTHING`;
        return inserted === 1;
      }, validUntil.getTime());
    } catch (error) {
      if (
        (error instanceof ConversationOperationError && error.getStatus() === 504) ||
        validUntil.getTime() <= Date.now()
      )
        throw new GatewayTimeoutException();
      throw new ServiceUnavailableException();
    }
    if (validUntil.getTime() <= Date.now()) throw new GatewayTimeoutException();
    if (!consumed) throw new UnauthorizedException();
  }
  async purgeExpired(limit = 100): Promise<number> {
    this.requireEnabled();
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
      throw new ServiceUnavailableException();
    try {
      return await this.database.transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          { replayDigest: Buffer }[]
        >`SELECT "replayDigest" FROM ai."AiRequestNonce"
          WHERE "expiresAt" <= statement_timestamp() ORDER BY "expiresAt", "replayDigest" LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
        const result = await tx.aiRequestNonce.deleteMany({
          where: { replayDigest: { in: rows.map((row) => row.replayDigest) } },
        });
        return result.count;
      });
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
