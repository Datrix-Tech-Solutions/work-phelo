import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { accessFingerprint } from '@work-phelo/internal-auth';
import {
  EmployeeAccessRecovery,
  EmployeeAccessRecoveryResult,
} from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { AccessFailure } from './employee-access-command.service';

@Injectable()
export class EmployeeAccessRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly current: JwtStrategy,
    private readonly rabbit: RabbitMQPublisher,
  ) {}
  private async authority(
    userId: string,
    tenantId: string,
    employeeAction: string,
    userAction: string,
    operator = false,
  ) {
    const user = await this.current
      .resolveCurrentUser(userId, tenantId)
      .catch((error: unknown) => {
        if ((error as { getStatus?: () => number })?.getStatus?.() === 401)
          throw new AccessFailure('RECOVERY_AUTHORITY_REQUIRED');
        throw error;
      });
    if (
      user.moduleConfig.hr !== true ||
      (!['TENANT_ADMIN', 'SUPER_ADMIN'].includes(user.role) &&
        (!user.permissions.includes(`employees:${employeeAction}`) ||
          !user.permissions.includes(`users:${userAction}`) ||
          (operator && !user.permissions.includes('users:EDIT'))))
    )
      throw new AccessFailure('RECOVERY_AUTHORITY_REQUIRED');
  }
  async recover(
    input: EmployeeAccessRecovery,
  ): Promise<EmployeeAccessRecoveryResult> {
    if (
      !input ||
      !isUUID(input.recoveryId) ||
      !isUUID(input.operationId) ||
      !isUUID(input.employeeId) ||
      !['CREATE', 'EDIT'].includes(input.employeePermission) ||
      typeof input.reason !== 'string' ||
      !input.reason?.trim() ||
      input.reason.length > 500 ||
      !['GRANT', 'SUSPEND', 'RESTORE', 'RESEND'].includes(input.action)
    )
      throw new AccessFailure('INVALID_RECOVERY');
    const userAction =
      input.action === 'SUSPEND'
        ? 'DELETE'
        : input.action === 'RESTORE'
          ? 'EDIT'
          : 'CREATE';
    await this.authority(
      input.operatorUserId,
      input.tenantId,
      'EDIT',
      userAction,
      true,
    );
    const payloadHash = accessFingerprint(input);
    const prior = await this.prisma.employeeAccessRecoveryReceipt.findUnique({
      where: { id: input.recoveryId },
    });
    if (prior) {
      if (prior.payloadHash !== payloadHash)
        throw new AccessFailure('RECOVERY_KEY_CONFLICT');
      return {
        outcome: prior.outcome as EmployeeAccessRecoveryResult['outcome'],
        errorCode: prior.lastErrorCode,
      };
    }
    const grant = input.action === 'GRANT';
    const command = grant
      ? await this.prisma.employeeAccessCommand.findUnique({
          where: { id: input.operationId },
        })
      : await this.prisma.employeeAccessLifecycleCommand.findUnique({
          where: { id: input.operationId },
        });
    if (
      command &&
      (command.tenantId !== input.tenantId ||
        command.employeeId !== input.employeeId ||
        command.actorUserId !== input.actorUserId ||
        command.requestHash !== input.requestHash ||
        command.action !== input.action ||
        (input.userId && input.userId !== command.targetUserId))
    )
      throw new AccessFailure('COMMAND_SCOPE_MISMATCH');
    await this.authority(
      input.actorUserId,
      input.tenantId,
      grant
        ? command && 'employeePermission' in command
          ? command.employeePermission
          : input.employeePermission
        : 'EDIT',
      userAction,
    );
    let result: EmployeeAccessRecoveryResult = {
      outcome: 'REQUEUE',
      errorCode: null,
    };
    let wake = false;
    let accepted = false;
    let expired = false;
    if (!command && grant) {
      const facts = await this.rabbit.verifyEmployeeAccessLink(input);
      if (facts.hasIdentity !== false || facts.action !== 'GRANT')
        result = {
          outcome: 'BLOCKED',
          errorCode: 'COMMAND_MISSING_OR_IDENTITY_UNCERTAIN',
        };
    }
    if (command) {
      if (command.leaseUntil && command.leaseUntil > new Date())
        throw new AccessFailure('COMMAND_BUSY');
      if (command.status === 'FAILED')
        result = {
          outcome: 'FAILED',
          errorCode: command.lastErrorCode ?? 'COMMAND_FAILED',
        };
      else if (['READY', 'PAUSED', 'EXPIRED'].includes(command.status)) {
        const user = await this.prisma.user.findFirst({
          where: { id: command.targetUserId ?? '', tenantId: input.tenantId },
        });
        if (
          !user ||
          user.role !== 'EMPLOYEE' ||
          user.id === input.operatorUserId ||
          user.accessSuspendedAt
        )
          result = {
            outcome: 'BLOCKED',
            errorCode: 'INVITATION_OR_TARGET_INELIGIBLE',
          };
        else if (user.status === 'ACTIVE' && user.emailVerifiedAt) {
          const receipt = await this.rabbit.inspectEmployeeInvite({
            operationId: command.id,
            tenantId: input.tenantId,
            userId: user.id,
          });
          if (receipt.status === 'PROVIDER_ACCEPTED') accepted = true;
          else
            result = {
              outcome: 'BLOCKED',
              errorCode: 'ACTIVE_IDENTITY_DELIVERY_REVIEW_REQUIRED',
            };
        } else if (
          command.status === 'EXPIRED' &&
          user.status === 'PENDING_VERIFICATION'
        ) {
          result = {
            outcome: 'FAILED',
            errorCode: 'INVITATION_EXPIRED_RESEND_REQUIRED',
          };
        } else if (user.status !== 'PENDING_VERIFICATION') {
          result = {
            outcome: 'BLOCKED',
            errorCode: 'INVITATION_OR_TARGET_INELIGIBLE',
          };
        } else if (
          !user.inviteToken ||
          !user.inviteExpiresAt ||
          user.inviteExpiresAt <= new Date()
        ) {
          expired = true;
          result = {
            outcome: 'FAILED',
            errorCode: 'INVITATION_EXPIRED_RESEND_REQUIRED',
          };
        } else {
          const receipt = await this.rabbit.inspectEmployeeInvite({
            operationId: command.id,
            tenantId: input.tenantId,
            userId: user.id,
          });
          if (receipt.status === 'PROVIDER_ACCEPTED') accepted = true;
          else if (
            receipt.status === 'RETRY' ||
            (receipt.status === 'MISSING' &&
              Date.now() - command.createdAt.getTime() < 23 * 3600000)
          )
            wake = true;
          else
            result = {
              outcome: 'BLOCKED',
              errorCode: receipt.errorCode ?? 'DELIVERY_REVIEW_REQUIRED',
            };
        }
      }
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`access-recovery:${input.recoveryId}`}, 0))::text`;
      const replay = await tx.employeeAccessRecoveryReceipt.findUnique({
        where: { id: input.recoveryId },
      });
      if (replay) {
        if (replay.payloadHash !== payloadHash)
          throw new AccessFailure('RECOVERY_KEY_CONFLICT');
        return {
          outcome: replay.outcome as EmployeeAccessRecoveryResult['outcome'],
          errorCode: replay.lastErrorCode,
        };
      }
      if (command && (wake || accepted || expired)) {
        const where = {
          id: command.id,
          updatedAt: command.updatedAt,
          status: { in: ['READY', 'PAUSED', 'EXPIRED'] },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
        };
        const data = {
          status: accepted
            ? grant
              ? ('PROVIDER_ACCEPTED' as const)
              : 'COMPLETED'
            : 'READY',
          attemptCount: 0,
          nextAttemptAt: accepted || expired ? null : new Date(),
          lastErrorCode: expired ? result.errorCode : null,
          leaseToken: null,
          leaseUntil: null,
          completedAt: accepted || expired ? new Date() : null,
        };
        const changed = grant
          ? await tx.employeeAccessCommand.updateMany({
              where: {
                ...where,
                status: { in: ['READY', 'PAUSED', 'EXPIRED'] },
              },
              data: {
                ...data,
                status: expired
                  ? 'EXPIRED'
                  : accepted
                    ? 'PROVIDER_ACCEPTED'
                    : 'READY',
              },
            })
          : await tx.employeeAccessLifecycleCommand.updateMany({
              where,
              data: {
                ...data,
                status: expired ? 'FAILED' : accepted ? 'COMPLETED' : 'READY',
              },
            });
        if (changed.count !== 1)
          throw new AccessFailure('COMMAND_CHANGED_DURING_RECOVERY');
      }
      await tx.employeeAccessRecoveryReceipt.create({
        data: {
          id: input.recoveryId,
          tenantId: input.tenantId,
          operationId: input.operationId,
          operatorUserId: input.operatorUserId,
          reason: input.reason,
          payloadHash,
          outcome: result.outcome,
          lastErrorCode: result.errorCode,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          userId: input.operatorUserId,
          action: 'UPDATE',
          resource: 'users',
          resourceId: command?.targetUserId ?? input.employeeId,
          changes: {
            after: {
              operationId: input.operationId,
              recoveryId: input.recoveryId,
              reason: input.reason,
              outcome: result.outcome,
              errorCode: result.errorCode,
            },
          },
        },
      });
      return result;
    });
  }
}
