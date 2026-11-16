import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { accessFingerprint } from '@work-phelo/internal-auth';
import {
  EmployeeAccessCommandPayload,
  EmployeeAccessCommandResult,
  EmployeeAccessReference,
} from '@work-phelo/types';
import { EmployeeAccessCommand, Prisma } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import {
  BASIC_EMPLOYEE_TEMPLATE_NAME,
  syncUserSystemPermissionSet,
} from '../permissions/system-permission-sets';
import { generateSecureToken } from '../common/otp.helper';
import { WorkspaceUrl } from '../common/workspace-url.helper';
import { normalizeEmail } from '../common/email.helper';
import { isEmail, isUUID } from 'class-validator';

export class AccessFailure extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

@Injectable()
export class EmployeeAccessCommandService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EmployeeAccessCommandService.name);
  private timer?: ReturnType<typeof setInterval>;
  private publishing = false;
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.publishReadyInvitations().catch(() =>
        this.logger.warn('Employee invitation outbox unavailable'),
      );
    }, 10000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  constructor(
    private readonly prisma: PrismaService,
    private readonly current: JwtStrategy,
    private readonly rabbitmq: RabbitMQPublisher,
  ) {}

  private result(command: EmployeeAccessCommand): EmployeeAccessCommandResult {
    return {
      operationId: command.id,
      tenantId: command.tenantId,
      employeeId: command.employeeId,
      userId: command.targetUserId,
      status: command.status,
      errorCode: command.lastErrorCode,
    };
  }

  private async authorize(command: {
    actorUserId: string;
    tenantId: string;
    employeePermission: string;
  }) {
    let actor;
    try {
      actor = await this.current.resolveCurrentUser(
        command.actorUserId,
        command.tenantId,
      );
    } catch (error) {
      // Connectivity errors are uncertain, not evidence of revoked authority.
      if ((error as { getStatus?: () => number })?.getStatus?.() === 401)
        throw new AccessFailure('ACTOR_INELIGIBLE');
      throw error;
    }
    if (
      actor.moduleConfig?.hr !== true ||
      (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(actor.role) &&
        (!actor.permissions.includes('users:CREATE') ||
          !actor.permissions.includes(
            `employees:${command.employeePermission}`,
          )))
    ) {
      throw new AccessFailure('ACTOR_PERMISSION_REVOKED');
    }
  }

  private assertReference(
    command: EmployeeAccessCommand | null,
    ref: EmployeeAccessReference,
  ) {
    if (
      !command ||
      command.tenantId !== ref.tenantId ||
      command.employeeId !== ref.employeeId ||
      command.actorUserId !== ref.actorUserId ||
      command.requestHash !== ref.requestHash ||
      (ref.userId && command.targetUserId !== ref.userId)
    )
      throw new AccessFailure('COMMAND_SCOPE_MISMATCH');
    return command;
  }

  async status(ref: EmployeeAccessReference) {
    return this.result(
      this.assertReference(
        await this.prisma.employeeAccessCommand.findUnique({
          where: { id: ref.operationId },
        }),
        ref,
      ),
    );
  }

  async execute(
    input: EmployeeAccessCommandPayload,
  ): Promise<EmployeeAccessCommandResult> {
    if (
      !input ||
      !isUUID(input.operationId) ||
      !isUUID(input.employeeId) ||
      !input.actorUserId ||
      !input.tenantId ||
      !['CREATE', 'EDIT'].includes(input.employeePermission) ||
      !/^[a-f0-9]{64}$/.test(input.requestHash) ||
      !isEmail(input.email) ||
      normalizeEmail(input.email) !== input.email ||
      !input.firstName ||
      !input.lastName ||
      typeof input.idempotencyKey !== 'string' ||
      input.idempotencyKey.length > 140
    )
      throw new AccessFailure('INVALID_COMMAND');
    const payloadHash = accessFingerprint(input);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`employee-access:${input.tenantId}:${input.employeeId}`}, 0))::text`;
          const prior = await tx.employeeAccessCommand.findUnique({
            where: { id: input.operationId },
          });
          if (prior) {
            this.assertReference(prior, input);
            if (prior.payloadHash !== payloadHash)
              throw new AccessFailure('IDEMPOTENCY_CONFLICT');
            await this.authorize(prior);
            if (prior.targetUserId) {
              const target = await tx.user.findFirst({
                where: { id: prior.targetUserId, tenantId: prior.tenantId },
              });
              if (
                !target ||
                target.role !== 'EMPLOYEE' ||
                target.id === prior.actorUserId ||
                (target.status !== 'PENDING_VERIFICATION' &&
                  prior.status !== 'PROVIDER_ACCEPTED')
              )
                throw new AccessFailure('IDENTITY_INELIGIBLE');
            }
            return this.result(prior);
          }
          const byKey = await tx.employeeAccessCommand.findUnique({
            where: {
              tenantId_idempotencyKey: {
                tenantId: input.tenantId,
                idempotencyKey: input.idempotencyKey,
              },
            },
          });
          if (byKey) throw new AccessFailure('IDEMPOTENCY_CONFLICT');
          await this.authorize(input);
          const existingCommand = await tx.employeeAccessCommand.findFirst({
            where: {
              tenantId: input.tenantId,
              employeeId: input.employeeId,
              targetUserId: { not: null },
            },
          });
          if (existingCommand)
            throw new AccessFailure('EMPLOYEE_ALREADY_PROVISIONED');
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`employee-email:${input.tenantId}:${input.email}`}, 0))::text`;
          if (!process.env.SUPER_ADMIN_EMAIL)
            throw new AccessFailure('AUTH_CONFIGURATION_MISSING');
          const existingUser = await tx.user.findFirst({
            where: {
              tenantId: input.tenantId,
              email: { equals: input.email, mode: 'insensitive' },
            },
          });
          if (
            existingUser ||
            (process.env.SUPER_ADMIN_EMAIL &&
              normalizeEmail(process.env.SUPER_ADMIN_EMAIL) === input.email)
          )
            throw new AccessFailure('IDENTITY_CONFLICT');
          const baseline = await tx.permissionSet.findFirst({
            where: {
              tenantId: input.tenantId,
              name: BASIC_EMPLOYEE_TEMPLATE_NAME,
              isActive: true,
              isSystem: false,
            },
          });
          if (!baseline) throw new AccessFailure('EMPLOYEE_BASELINE_MISSING');
          const tenant = await tx.tenant.findUniqueOrThrow({
            where: { id: input.tenantId },
          });
          const user = await tx.user.create({
            data: {
              tenantId: input.tenantId,
              email: input.email,
              firstName: input.firstName,
              lastName: input.lastName,
              role: 'EMPLOYEE',
              status: 'PENDING_VERIFICATION',
              forcePasswordReset: true,
              inviteToken: generateSecureToken(),
              inviteExpiresAt: new Date(Date.now() + 48 * 3600000),
            },
          });
          await syncUserSystemPermissionSet(
            tx,
            {
              tenantId: input.tenantId,
              userId: user.id,
              role: 'EMPLOYEE',
              grantedBy: input.actorUserId,
            },
            this.logger,
          );
          await tx.userPermissionSet.create({
            data: {
              userId: user.id,
              permissionSetId: baseline.id,
              grantedBy: input.actorUserId,
            },
          });
          const command = await tx.employeeAccessCommand.create({
            data: {
              id: input.operationId,
              tenantId: input.tenantId,
              employeeId: input.employeeId,
              actorUserId: input.actorUserId,
              employeePermission: input.employeePermission,
              idempotencyKey: input.idempotencyKey,
              requestHash: input.requestHash,
              payloadHash,
              targetUserId: user.id,
              email: user.email,
              firstName: user.firstName,
              tenantName: tenant.name,
              tenantSlug: tenant.slug,
            },
          });
          await tx.auditLog.create({
            data: {
              tenantId: input.tenantId,
              userId: input.actorUserId,
              action: 'CREATE',
              resource: 'users',
              resourceId: user.id,
              changes: {
                after: {
                  employeeId: input.employeeId,
                  operationId: input.operationId,
                  status: 'PENDING_VERIFICATION',
                },
              },
            },
          });
          return this.result(command);
        },
        { timeout: 15000 },
      );
    } catch (error) {
      if (!(error instanceof AccessFailure)) throw error;
      if (
        ['IDEMPOTENCY_CONFLICT', 'COMMAND_SCOPE_MISMATCH'].includes(error.code)
      )
        throw error;
      const prior = await this.prisma.employeeAccessCommand.findUnique({
        where: { id: input.operationId },
      });
      if (prior) {
        this.assertReference(prior, input);
        // Do not mutate a command in response to a conflicting replay.
        if (prior.payloadHash !== payloadHash)
          throw new AccessFailure('IDEMPOTENCY_CONFLICT');
        return {
          ...this.result(prior),
          status: 'PAUSED',
          errorCode: error.code,
        };
      }
      const failure = await this.prisma.employeeAccessCommand.upsert({
        where: { id: input.operationId },
        update: {},
        create: {
          id: input.operationId,
          tenantId: input.tenantId,
          employeeId: input.employeeId,
          actorUserId: input.actorUserId,
          employeePermission: input.employeePermission,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          payloadHash,
          email: input.email,
          firstName: input.firstName,
          tenantName: '',
          tenantSlug: '',
          status: 'FAILED',
          lastErrorCode: error.code,
          completedAt: new Date(),
        },
      });
      this.assertReference(failure, input);
      if (failure.payloadHash !== payloadHash)
        throw new AccessFailure('IDEMPOTENCY_CONFLICT');
      if (failure.targetUserId && error.code.startsWith('ACTOR_'))
        return {
          ...this.result(failure),
          status: 'PAUSED',
          errorCode: error.code,
        };
      return this.result(failure);
    }
  }

  async finalize(ref: EmployeeAccessReference) {
    const command = this.assertReference(
      await this.prisma.employeeAccessCommand.findUnique({
        where: { id: ref.operationId },
      }),
      ref,
    );
    if (!ref.userId || !command.targetUserId)
      throw new AccessFailure('COMMAND_SCOPE_MISMATCH');
    await this.authorize(command);
    if (command.status !== 'PROVISIONED') return this.result(command);
    const confirmation = await this.rabbitmq.verifyEmployeeAccessLink(ref);
    if (!confirmation.linked) throw new AccessFailure('LINK_NOT_CONFIRMED');
    await this.prisma.employeeAccessCommand.updateMany({
      where: { id: command.id, status: 'PROVISIONED' },
      data: { status: 'READY', nextAttemptAt: new Date() },
    });
    return this.status(ref);
  }

  async publishReadyInvitations() {
    if (this.publishing) return;
    this.publishing = true;
    try {
      const now = new Date();
      const commands = await this.prisma.employeeAccessCommand.findMany({
        where: {
          status: 'READY',
          nextAttemptAt: { lte: now },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        },
        take: 20,
        orderBy: { createdAt: 'asc' },
      });
      for (const command of commands) {
        try {
          await this.publishOne(command.id);
        } catch {
          this.logger.warn(
            `Employee invite recovery unavailable; operation=${command.id}`,
          );
        }
      }
    } finally {
      this.publishing = false;
    }
  }

  async publishOne(id: string) {
    const leaseToken = randomUUID();
    const now = new Date();
    const claim = await this.prisma.employeeAccessCommand.updateMany({
      where: {
        id,
        status: 'READY',
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: {
        leaseToken,
        leaseUntil: new Date(Date.now() + 120000),
        attemptCount: { increment: 1 },
      },
    });
    if (!claim.count) return;
    const command = await this.prisma.employeeAccessCommand.findUniqueOrThrow({
      where: { id },
    });
    const finish = (
      data: Prisma.EmployeeAccessCommandUpdateManyMutationInput,
    ) =>
      this.prisma.employeeAccessCommand.updateMany({
        where: { id, leaseToken },
        data: { ...data, leaseUntil: null, leaseToken: null },
      });
    try {
      await this.authorize(command);
      const user = await this.prisma.user.findFirst({
        where: {
          id: command.targetUserId ?? '',
          tenantId: command.tenantId,
          role: 'EMPLOYEE',
        },
      });
      if (
        !user ||
        user.status !== 'PENDING_VERIFICATION' ||
        !user.inviteToken ||
        !user.inviteExpiresAt ||
        user.inviteExpiresAt <= now
      ) {
        await finish({
          status: 'EXPIRED',
          lastErrorCode: 'INVITATION_EXPIRED_OR_IDENTITY_INELIGIBLE',
          nextAttemptAt: null,
        });
        return;
      }
      const ref = {
        operationId: id,
        tenantId: command.tenantId,
        employeeId: command.employeeId,
        actorUserId: command.actorUserId,
        requestHash: command.requestHash,
        userId: user.id,
      };
      if (!(await this.rabbitmq.verifyEmployeeAccessLink(ref)).linked)
        throw new AccessFailure('LINK_NOT_CONFIRMED');
      const result = await this.rabbitmq.sendEmployeeAccessInvite({
        operationId: id,
        tenantId: command.tenantId,
        userId: user.id,
        email: command.email,
        firstName: command.firstName,
        tenantName: command.tenantName,
        acceptInviteUrl: WorkspaceUrl.acceptInvite(
          command.tenantSlug,
          user.inviteToken,
        ),
        expiresAt: user.inviteExpiresAt.toISOString(),
      });
      if (result.status === 'PROVIDER_ACCEPTED') {
        await finish({
          status: 'PROVIDER_ACCEPTED',
          nextAttemptAt: null,
          completedAt: new Date(),
          lastErrorCode: null,
        });
      } else if (result.status === 'EXPIRED' || result.status === 'UNKNOWN') {
        await finish({
          status: result.status === 'EXPIRED' ? 'EXPIRED' : 'PAUSED',
          nextAttemptAt: null,
          lastErrorCode: `NOTIFICATION_${result.status}`,
        });
      } else {
        throw new Error('Notification retry required');
      }
    } catch (error) {
      const code =
        error instanceof AccessFailure
          ? error.code
          : 'NOTIFICATION_UNCONFIRMED';
      const paused =
        error instanceof AccessFailure || command.attemptCount >= 8;
      await finish({
        status: paused ? 'PAUSED' : 'READY',
        lastErrorCode:
          paused && !(error instanceof AccessFailure)
            ? 'NOTIFICATION_RETRY_EXHAUSTED'
            : code,
        nextAttemptAt: paused
          ? null
          : new Date(
              Date.now() + Math.min(900000, 5000 * 2 ** command.attemptCount),
            ),
      });
    }
  }
}
