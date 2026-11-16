import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { isUUID } from 'class-validator';
import { accessFingerprint } from '@work-phelo/internal-auth';
import {
  EmployeeAccessAccountRequest,
  EmployeeAccessLifecycle,
  EmployeeAccessLifecycleResult,
} from '@work-phelo/types';
import {
  EmployeeAccessLifecycleCommand,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { AccessFailure } from './employee-access-command.service';
import { generateSecureToken } from '../common/otp.helper';
import { WorkspaceUrl } from '../common/workspace-url.helper';
import { classifyEmployeeAccount } from './employee-access-state';
import { EmployeeAccessSnapshotRequest } from '@work-phelo/types';

@Injectable()
export class EmployeeAccessLifecycleService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private publishing = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly current: JwtStrategy,
    private readonly rabbitmq: RabbitMQPublisher,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.recover().catch(() => undefined);
    }, 10000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async authorize(
    tenantId: string,
    actorUserId: string,
    userAction: 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE',
  ) {
    const actor = await this.current
      .resolveCurrentUser(actorUserId, tenantId)
      .catch((error: unknown) => {
        if ((error as { getStatus?: () => number })?.getStatus?.() === 401)
          throw new AccessFailure('ACTOR_INELIGIBLE');
        throw error;
      });
    if (
      actor.moduleConfig.hr !== true ||
      (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(actor.role) &&
        (!actor.permissions.includes(`users:${userAction}`) ||
          !actor.permissions.includes(
            `employees:${userAction === 'VIEW' ? 'VIEW' : 'EDIT'}`,
          )))
    ) {
      throw new AccessFailure('ACTOR_PERMISSION_REVOKED');
    }
  }

  async account(input: EmployeeAccessAccountRequest) {
    await this.authorize(input.tenantId, input.actorUserId, 'VIEW');
    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, tenantId: input.tenantId },
      select: {
        status: true,
        role: true,
        inviteExpiresAt: true,
        inviteToken: true,
        emailVerifiedAt: true,
        accessSuspendedAt: true,
      },
    });
    let resend: { status: string } | null = null;
    let grant: { status: string } | null = null;
    if (
      user?.status === 'PENDING_VERIFICATION' &&
      user.inviteToken &&
      user.inviteExpiresAt &&
      user.inviteExpiresAt > new Date()
    ) {
      resend = await this.prisma.employeeAccessLifecycleCommand.findFirst({
        where: {
          tenantId: input.tenantId,
          targetUserId: input.userId,
          action: 'RESEND',
          status: { not: 'FAILED' },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      if (!resend)
        grant = await this.prisma.employeeAccessCommand.findFirst({
          where: { tenantId: input.tenantId, targetUserId: input.userId },
        });
    }
    return {
      status: classifyEmployeeAccount(
        user
          ? {
              status: user.status,
              hasInvite: !!user.inviteToken,
              inviteExpiresAt: user.inviteExpiresAt,
              suspended: !!user.accessSuspendedAt,
            }
          : null,
        grant?.status ?? null,
        resend?.status ?? null,
        new Date(),
      ),
    };
  }

  async snapshot(input: EmployeeAccessSnapshotRequest) {
    if (
      !Array.isArray(input?.userIds) ||
      input.userIds.length > 1000 ||
      input.userIds.some(
        (id) => typeof id !== 'string' || !id || id.length > 100,
      )
    )
      throw new AccessFailure('INVALID_SNAPSHOT');
    await this.authorize(input.tenantId, input.actorUserId, 'VIEW');
    const ids = [...new Set(input.userIds)];
    if (!ids.length) return { items: [], capturedAt: new Date().toISOString() };
    const rows = await this.prisma.$queryRaw<
      {
        userId: string;
        status: string;
        hasInvite: boolean;
        inviteExpiresAt: Date | null;
        suspended: boolean;
        grantStatus: string | null;
        resendStatus: string | null;
        capturedAt: Date;
      }[]
    >(Prisma.sql`
      SELECT u."id" AS "userId", u."status"::text AS status,
        (u."inviteToken" IS NOT NULL) AS "hasInvite", u."inviteExpiresAt",
        (u."accessSuspendedAt" IS NOT NULL) AS suspended,
        g."status"::text AS "grantStatus", r."status" AS "resendStatus", statement_timestamp() AS "capturedAt"
      FROM "w_auth"."User" u
      LEFT JOIN "w_auth"."EmployeeAccessCommand" g ON g."tenantId" = u."tenantId" AND g."targetUserId" = u."id"
      LEFT JOIN LATERAL (
        SELECT c."status" FROM "w_auth"."EmployeeAccessLifecycleCommand" c
        WHERE c."tenantId" = u."tenantId" AND c."targetUserId" = u."id" AND c."action" = 'RESEND' AND c."status" <> 'FAILED'
        ORDER BY c."createdAt" DESC, c."id" DESC LIMIT 1
      ) r ON true
      WHERE u."tenantId" = ${input.tenantId} AND u."id" IN (${Prisma.join(ids)})`);
    const capturedAt = rows[0]?.capturedAt ?? new Date();
    const byId = new Map(rows.map((row) => [row.userId, row]));
    return {
      capturedAt: capturedAt.toISOString(),
      items: ids.map((userId) => {
        const row = byId.get(userId);
        return {
          userId,
          status: classifyEmployeeAccount(
            row ?? null,
            row?.grantStatus ?? null,
            row?.resendStatus ?? null,
            capturedAt,
          ),
        };
      }),
    };
  }

  private result(
    row: EmployeeAccessLifecycleCommand,
  ): EmployeeAccessLifecycleResult {
    return {
      operationId: row.id,
      tenantId: row.tenantId,
      employeeId: row.employeeId,
      userId: row.targetUserId,
      status: row.status as EmployeeAccessLifecycleResult['status'],
      errorCode: row.lastErrorCode,
    };
  }

  async execute(
    input: EmployeeAccessLifecycle,
  ): Promise<EmployeeAccessLifecycleResult> {
    if (
      !input ||
      !isUUID(input.operationId) ||
      !isUUID(input.employeeId) ||
      !input.userId ||
      !['SUSPEND', 'RESTORE', 'RESEND'].includes(input.action) ||
      typeof input.reason !== 'string' ||
      !input.reason.trim() ||
      input.reason.length > 500 ||
      !/^[a-f0-9]{64}$/.test(input.requestHash) ||
      typeof input.idempotencyKey !== 'string' ||
      input.idempotencyKey.length > 140
    )
      throw new AccessFailure('INVALID_COMMAND');
    await this.authorize(
      input.tenantId,
      input.actorUserId,
      input.action === 'SUSPEND'
        ? 'DELETE'
        : input.action === 'RESTORE'
          ? 'EDIT'
          : 'CREATE',
    );
    const payloadHash = accessFingerprint(input);
    const prior = await this.prisma.employeeAccessLifecycleCommand.findUnique({
      where: { id: input.operationId },
    });
    if (prior) {
      if (prior.payloadHash !== payloadHash)
        throw new AccessFailure('IDEMPOTENCY_CONFLICT');
      return this.result(prior);
    }
    const link = await this.rabbitmq.verifyEmployeeAccessLink(input);
    if (!link.linked || link.action !== input.action)
      throw new AccessFailure('LINK_NOT_CONFIRMED');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`employee-access:${input.tenantId}:${input.employeeId}`}, 0))::text`;
        const replay = await tx.employeeAccessLifecycleCommand.findUnique({
          where: { id: input.operationId },
        });
        if (replay) {
          if (replay.payloadHash !== payloadHash)
            throw new AccessFailure('IDEMPOTENCY_CONFLICT');
          return this.result(replay);
        }
        const user = await tx.user.findFirst({
          where: { id: input.userId, tenantId: input.tenantId },
        });
        if (!user || user.role !== 'EMPLOYEE' || user.id === input.actorUserId)
          throw new AccessFailure('TARGET_INELIGIBLE');
        const data: Prisma.UserUpdateManyMutationInput = {};
        if (input.action === 'SUSPEND') {
          if (user.status !== 'ACTIVE')
            throw new AccessFailure('TARGET_NOT_ACTIVE');
          data.status = 'SUSPENDED';
          data.accessSuspendedAt = new Date();
          data.accessSuspensionReason = input.reason;
          data.sessionVersion = { increment: 1 };
        } else if (input.action === 'RESTORE') {
          if (
            user.status !== 'SUSPENDED' ||
            !user.accessSuspendedAt ||
            !user.emailVerifiedAt
          )
            throw new AccessFailure('TARGET_NOT_RESTORABLE');
          data.status = 'ACTIVE';
          data.accessSuspendedAt = null;
          data.accessSuspensionReason = null;
          data.sessionVersion = { increment: 1 };
        } else {
          if (user.status !== 'PENDING_VERIFICATION' || user.accessSuspendedAt)
            throw new AccessFailure('TARGET_NOT_PENDING');
          const recent = await tx.employeeAccessLifecycleCommand.findFirst({
            where: {
              tenantId: input.tenantId,
              employeeId: input.employeeId,
              targetUserId: user.id,
              action: 'RESEND',
              OR: [
                { status: 'READY' },
                {
                  completedAt: { gte: new Date(Date.now() - 60000) },
                  status: 'COMPLETED',
                },
              ],
            },
          });
          if (recent) throw new AccessFailure('INVITATION_RESEND_COOLDOWN');
          const grant = await tx.employeeAccessCommand.findFirst({
            where: { tenantId: input.tenantId, targetUserId: user.id },
          });
          if (grant && !['PROVIDER_ACCEPTED', 'EXPIRED'].includes(grant.status))
            throw new AccessFailure('GRANT_NOT_FINALIZED');
          // Separate stable delivery generation: retries never rotate this token again.
          data.inviteToken = generateSecureToken();
          data.inviteExpiresAt = new Date(Date.now() + 48 * 3600000);
        }
        const changed = await tx.user.updateMany({
          where: {
            id: user.id,
            tenantId: input.tenantId,
            status: user.status,
            sessionVersion: user.sessionVersion,
          },
          data,
        });
        if (changed.count !== 1) throw new AccessFailure('TARGET_CHANGED');
        if (input.action !== 'RESEND')
          await tx.refreshToken.updateMany({
            where: { userId: user.id, isRevoked: false },
            data: { isRevoked: true },
          });
        const row = await tx.employeeAccessLifecycleCommand.create({
          data: {
            id: input.operationId,
            tenantId: input.tenantId,
            employeeId: input.employeeId,
            actorUserId: input.actorUserId,
            targetUserId: user.id,
            action: input.action,
            idempotencyKey: input.idempotencyKey,
            requestHash: input.requestHash,
            payloadHash,
            reason: input.reason,
            status: input.action === 'RESEND' ? 'READY' : 'COMPLETED',
            nextAttemptAt: input.action === 'RESEND' ? new Date() : null,
            completedAt: input.action === 'RESEND' ? null : new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            tenantId: input.tenantId,
            userId: input.actorUserId,
            action: 'UPDATE',
            resource: 'users',
            resourceId: user.id,
            changes: {
              after: {
                action: input.action,
                reason: input.reason,
                employeeId: input.employeeId,
                operationId: input.operationId,
                outcome: row.status,
              },
            },
          },
        });
        return this.result(row);
      });
    } catch (error) {
      if (
        !(error instanceof AccessFailure) ||
        error.code === 'IDEMPOTENCY_CONFLICT'
      )
        throw error;
      const row = await this.prisma.employeeAccessLifecycleCommand.upsert({
        where: { id: input.operationId },
        update: {},
        create: {
          id: input.operationId,
          tenantId: input.tenantId,
          employeeId: input.employeeId,
          actorUserId: input.actorUserId,
          targetUserId: input.userId,
          action: input.action,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          payloadHash,
          reason: input.reason,
          status: 'FAILED',
          lastErrorCode: error.code,
          completedAt: new Date(),
        },
      });
      if (row.payloadHash !== payloadHash)
        throw new AccessFailure('IDEMPOTENCY_CONFLICT');
      return this.result(row);
    }
  }

  async recover() {
    if (this.publishing) return;
    this.publishing = true;
    try {
      const rows = await this.prisma.employeeAccessLifecycleCommand.findMany({
        where: {
          status: 'READY',
          nextAttemptAt: { lte: new Date() },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
        },
        take: 20,
        orderBy: { createdAt: 'asc' },
      });
      for (const row of rows) await this.publishOne(row.id);
    } finally {
      this.publishing = false;
    }
  }

  async publishOne(id: string) {
    const leaseToken = randomUUID();
    const claimed = await this.prisma.employeeAccessLifecycleCommand.updateMany(
      {
        where: {
          id,
          status: 'READY',
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
        },
        data: {
          leaseToken,
          leaseUntil: new Date(Date.now() + 120000),
          attemptCount: { increment: 1 },
        },
      },
    );
    if (!claimed.count) return;
    const row =
      await this.prisma.employeeAccessLifecycleCommand.findUniqueOrThrow({
        where: { id },
      });
    const finish = (
      data: Prisma.EmployeeAccessLifecycleCommandUpdateManyMutationInput,
    ) =>
      this.prisma.employeeAccessLifecycleCommand.updateMany({
        where: { id, leaseToken },
        data: { ...data, leaseToken: null, leaseUntil: null },
      });
    try {
      await this.authorize(row.tenantId, row.actorUserId, 'CREATE');
      if (
        !(
          await this.rabbitmq.verifyEmployeeAccessLink({
            operationId: id,
            tenantId: row.tenantId,
            employeeId: row.employeeId,
            actorUserId: row.actorUserId,
            requestHash: row.requestHash,
            userId: row.targetUserId,
          })
        ).linked
      )
        throw new AccessFailure('LINK_NOT_CONFIRMED');
      const user = await this.prisma.user.findFirst({
        where: { id: row.targetUserId, tenantId: row.tenantId },
        include: { tenant: true },
      });
      if (
        !user ||
        user.status !== 'PENDING_VERIFICATION' ||
        !user.inviteToken ||
        !user.inviteExpiresAt ||
        user.inviteExpiresAt <= new Date()
      )
        throw new AccessFailure('INVITATION_EXPIRED_OR_INELIGIBLE');
      const result = await this.rabbitmq.sendEmployeeAccessInvite({
        operationId: id,
        tenantId: row.tenantId,
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        tenantName: user.tenant.name,
        acceptInviteUrl: WorkspaceUrl.acceptInvite(
          user.tenant.slug,
          user.inviteToken,
        ),
        expiresAt: user.inviteExpiresAt.toISOString(),
      });
      if (result.status === 'PROVIDER_ACCEPTED') {
        await finish({
          status: 'COMPLETED',
          completedAt: new Date(),
          nextAttemptAt: null,
          lastErrorCode: null,
        });
        return;
      }
      if (result.status === 'UNKNOWN' || result.status === 'EXPIRED')
        throw new AccessFailure(`NOTIFICATION_${result.status}`);
      throw new Error('Notification unavailable');
    } catch (error) {
      const paused = error instanceof AccessFailure || row.attemptCount >= 8;
      await finish({
        status: paused ? 'PAUSED' : 'READY',
        lastErrorCode:
          error instanceof AccessFailure
            ? error.code
            : 'NOTIFICATION_UNCONFIRMED',
        nextAttemptAt: paused
          ? null
          : new Date(
              Date.now() + Math.min(900000, 5000 * 2 ** row.attemptCount),
            ),
      });
    }
  }
}
