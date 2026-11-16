import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { accessFingerprint } from '@work-phelo/internal-auth';
import { RequestUser, EmployeeAccessRecoveryResult } from '@work-phelo/types';
import { randomUUID } from 'crypto';
import {
  EmployeeAccessOperationStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import {
  accessKey,
  assertAccessActor,
  EmployeeAccessService,
} from './employee-access.service';

@Injectable()
export class EmployeeAccessRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbit: RabbitMQPublisher,
    private readonly access: EmployeeAccessService,
  ) {}
  async history(
    tenantId: string,
    employeeId: string,
    operationId: string,
    actor: RequestUser,
  ) {
    await this.access.readOperation(tenantId, employeeId, operationId, actor);
    return this.prisma.employeeAccessRecoveryRequest.findMany({
      where: { tenantId, employeeId, operationId },
      take: 20,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        operatorUserId: true,
        reason: true,
        outcome: true,
        lastErrorCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  async list(
    actor: RequestUser,
    limit: number,
    status?: EmployeeAccessOperationStatus,
    cursor?: string,
  ) {
    assertAccessActor(actor, actor.tenantId, 'VIEW', 'VIEW');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException('Limit must be 1-100.');
    const where: Prisma.EmployeeAccessOperationWhereInput = {
      tenantId: actor.tenantId,
      ...(status ? { status } : {}),
    };
    if (cursor) {
      const anchor = await this.prisma.employeeAccessOperation.findFirst({
        where: { id: cursor, tenantId: actor.tenantId },
      });
      if (!anchor) throw new NotFoundException('Operation not found');
      where.OR = [
        { createdAt: { lt: anchor.createdAt } },
        { createdAt: anchor.createdAt, id: { lt: anchor.id } },
      ];
    }
    const rows = await this.prisma.employeeAccessOperation.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return {
      items: rows.slice(0, limit).map((op) => ({
        ...this.access.publicOperation(op),
        nextAttemptAt: op.nextAttemptAt,
        leaseExpiresAt: op.leaseUntil,
      })),
      nextCursor: rows.length > limit ? rows[limit - 1].id : null,
    };
  }
  async reconcile(
    tenantId: string,
    employeeId: string,
    operationId: string,
    actor: RequestUser,
    keyInput: string,
    reasonInput: string,
  ) {
    assertAccessActor(actor, tenantId, 'EDIT', 'EDIT');
    const key = `recovery:${accessKey(keyInput)}`;
    const reason = typeof reasonInput === 'string' ? reasonInput.trim() : '';
    if (!reason || reason.length > 500)
      throw new BadRequestException(
        'A reason of 1-500 characters is required.',
      );
    const requestHash = accessFingerprint({
      employeeId,
      operationId,
      actorUserId: actor.id,
      reason,
    });
    const leaseToken = randomUUID();
    const prepared = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`employee-access:${tenantId}:${employeeId}`}, 0))::text`;
      const employee = await tx.employee.findFirst({
        where: { id: employeeId, tenantId },
      });
      const op = await tx.employeeAccessOperation.findFirst({
        where: { id: operationId, tenantId, employeeId },
      });
      if (!employee || !op) throw new NotFoundException('Operation not found');
      assertAccessActor(
        actor,
        tenantId,
        'EDIT',
        op.action === 'SUSPEND'
          ? 'DELETE'
          : op.action === 'RESTORE'
            ? 'EDIT'
            : 'CREATE',
      );
      if (employee.userId === actor.id)
        throw new ForbiddenException('Self-directed recovery is not allowed.');
      const prior = await tx.employeeAccessRecoveryRequest.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
      });
      if (prior && prior.requestHash !== requestHash)
        throw new ConflictException('Recovery idempotency key conflict.');
      if (prior && prior.outcome !== 'PENDING')
        return { op, employee, request: prior, replay: true };
      if (prior && ['COMPLETED', 'FAILED'].includes(op.status)) {
        const settled = await tx.employeeAccessRecoveryRequest.update({
          where: { id: prior.id },
          data: {
            outcome: 'BLOCKED',
            lastErrorCode: 'OPERATION_ALREADY_TERMINAL',
          },
        });
        return { op, employee, request: settled, replay: true };
      }
      if (['COMPLETED', 'FAILED'].includes(op.status))
        throw new ConflictException('Terminal operations cannot be restarted.');
      if (op.leaseUntil && op.leaseUntil > new Date())
        throw new ConflictException('Operation has an active lease.');
      if (
        employee.offboardedAt ||
        employee.employmentStatus === 'OFFBOARDED' ||
        (employee.userId && employee.userId !== op.targetUserId)
      )
        throw new ConflictException(
          'Employee is ineligible or linkage has changed.',
        );
      const request =
        prior ??
        (await tx.employeeAccessRecoveryRequest.create({
          data: {
            tenantId,
            employeeId,
            operationId,
            operatorUserId: actor.id,
            reason,
            idempotencyKey: key,
            requestHash,
          },
        }));
      const claim = await tx.employeeAccessOperation.updateMany({
        where: {
          id: op.id,
          tenantId,
          status: op.status,
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
        },
        data: {
          status: 'RECONCILING',
          nextAttemptAt: new Date(Date.now() + 120000),
          leaseToken,
          leaseUntil: new Date(Date.now() + 120000),
        },
      });
      if (!claim.count)
        throw new ConflictException('Operation changed during recovery.');
      return { op, employee, request, replay: false };
    });
    if (prepared.replay)
      return {
        recoveryId: prepared.request.id,
        outcome: prepared.request.outcome,
        errorCode: prepared.request.lastErrorCode,
        operation: this.access.publicOperation(prepared.op),
      };
    let result: EmployeeAccessRecoveryResult;
    try {
      result = await this.rabbit.recoverEmployeeAccess({
        ...this.access.reference(prepared.op),
        userId: undefined,
        recoveryId: prepared.request.id,
        operatorUserId: actor.id,
        reason,
        action: prepared.op.action as
          | 'GRANT'
          | 'SUSPEND'
          | 'RESTORE'
          | 'RESEND',
        employeePermission: prepared.op.employeePermission as 'CREATE' | 'EDIT',
      });
    } catch (error) {
      if (
        (error as { statusCode?: number })?.statusCode === 409 ||
        (error as { statusCode?: number })?.statusCode === 401
      )
        result = {
          outcome: 'BLOCKED',
          errorCode: 'RECOVERY_AUTHORITY_OR_SCOPE_REJECTED',
        };
      else {
        await this.prisma.$transaction(async (tx) => {
          await tx.employeeAccessOperation.updateMany({
            where: { id: operationId, leaseToken },
            data: {
              leaseToken: null,
              leaseUntil: null,
              lastErrorCode: 'RECOVERY_UNCONFIRMED',
              nextAttemptAt: new Date(Date.now() + 30000),
            },
          });
          await tx.employeeAccessRecoveryRequest.updateMany({
            where: { id: prepared.request.id, outcome: 'PENDING' },
            data: { lastErrorCode: 'RECOVERY_UNCONFIRMED' },
          });
        });
        return {
          recoveryId: prepared.request.id,
          outcome: 'PENDING',
          errorCode: 'RECOVERY_UNCONFIRMED',
        };
      }
    }
    if (!['REQUEUE', 'FAILED', 'BLOCKED'].includes(result.outcome))
      throw new ConflictException('Invalid recovery outcome.');
    if (
      result.outcome === 'FAILED' &&
      prepared.op.targetUserId &&
      prepared.employee.userId !== prepared.op.targetUserId
    )
      result = {
        outcome: 'BLOCKED',
        errorCode: 'PARTIAL_LINK_REVIEW_REQUIRED',
      };
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.employeeAccessOperation.updateMany({
        where: { id: operationId, tenantId, leaseToken },
        data: {
          status:
            result.outcome === 'REQUEUE'
              ? 'RECONCILING'
              : result.outcome === 'FAILED'
                ? 'FAILED'
                : 'PAUSED',
          attemptCount: result.outcome === 'REQUEUE' ? 0 : undefined,
          nextAttemptAt: result.outcome === 'REQUEUE' ? new Date() : null,
          completedAt: result.outcome === 'FAILED' ? new Date() : null,
          lastErrorCode: result.errorCode,
          leaseToken: null,
          leaseUntil: null,
        },
      });
      if (!changed.count)
        throw new ConflictException('Recovery lease expired or was replaced.');
      await tx.employeeAccessRecoveryRequest.update({
        where: { id: prepared.request.id },
        data: { outcome: result.outcome, lastErrorCode: result.errorCode },
      });
      const op = await tx.employeeAccessOperation.findUniqueOrThrow({
        where: { id: operationId },
      });
      return {
        recoveryId: prepared.request.id,
        outcome: result.outcome,
        errorCode: result.errorCode,
        operation: this.access.publicOperation(op),
      };
    });
  }
}
