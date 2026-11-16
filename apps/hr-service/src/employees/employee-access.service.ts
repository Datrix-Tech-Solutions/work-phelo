import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { accessFingerprint, verifyAccessRpc } from '@work-phelo/internal-auth';
import {
  EmployeeAccessCommandPayload,
  EmployeeAccessPatterns,
  EmployeeAccessReference,
  RequestUser,
} from '@work-phelo/types';
import {
  Employee,
  EmployeeAccessOperation,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMQPublisher } from '../messaging/rabbitmq.publisher';
import { normalizeEmployeeEmail } from './employee-email';
import { deriveEmployeeAccessState } from './employee-access-state';

export function accessKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
    throw new BadRequestException(
      'A valid Idempotency-Key (8-128 letters, digits, . _ : -) is required.',
    );
  }
  return value;
}

export function assertAccessActor(
  actor: RequestUser | undefined,
  tenantId: string,
  employeeAction: 'CREATE' | 'EDIT' | 'VIEW',
  userAction: 'CREATE' | 'VIEW' | 'EDIT' | 'DELETE',
) {
  if (
    !actor ||
    actor.tenantId !== tenantId ||
    actor.moduleConfig?.hr !== true ||
    (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(actor.role) &&
      (!actor.permissions.includes(`employees:${employeeAction}`) ||
        !actor.permissions.includes(`users:${userAction}`)))
  ) {
    throw new ForbiddenException('Employee system access permission required.');
  }
}

@Injectable()
export class EmployeeAccessService {
  private readonly logger = new Logger(EmployeeAccessService.name);
  private recovering = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQPublisher,
  ) {}

  publicOperation(op: EmployeeAccessOperation) {
    return {
      id: op.id,
      employeeId: op.employeeId,
      actorUserId: op.actorUserId,
      reason: op.reason,
      action: op.action,
      status: op.status,
      attemptCount: op.attemptCount,
      errorCode: op.lastErrorCode,
      retryable: ['QUEUED', 'RUNNING', 'RECONCILING', 'LINKED'].includes(
        op.status,
      ),
      createdAt: op.createdAt,
      completedAt: op.completedAt,
    };
  }

  async filterPage(
    tx: Prisma.TransactionClient,
    tenantId: string,
    where: Prisma.EmployeeWhereInput,
    actor: RequestUser,
    status: string,
    take: number,
    skip: number,
  ) {
    assertAccessActor(actor, tenantId, 'VIEW', 'VIEW');
    if (status === 'UNAVAILABLE')
      throw new ServiceUnavailableException({
        code: 'ACCESS_STATE_UNAVAILABLE',
        message:
          'Unavailability is a request failure, not an enumerable account state.',
      });
    const candidates = await tx.employee.findMany({
      where: { ...where, tenantId },
      take: 1001,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, userId: true },
    });
    if (candidates.length > 1000)
      throw new ServiceUnavailableException({
        code: 'ACCESS_FILTER_COHORT_LIMIT',
        message:
          'Narrow the employee search to at most 1000 candidates for exact access filtering.',
      });
    if (!candidates.length)
      return {
        ids: [],
        total: 0,
        states: new Map<string, string>(),
        capturedAt: null,
      };
    const operations = await tx.$queryRaw<
      {
        employeeId: string;
        status: string;
        targetUserId: string | null;
        action: string;
      }[]
    >(Prisma.sql`
      SELECT DISTINCT ON ("employeeId") "employeeId", "status"::text AS status, "targetUserId", "action"
      FROM "hr"."EmployeeAccessOperation" WHERE "tenantId" = ${tenantId} AND "employeeId" IN (${Prisma.join(candidates.map((c) => c.id))})
      ORDER BY "employeeId", "createdAt" DESC, "id" DESC`);
    const latest = new Map(operations.map((op) => [op.employeeId, op]));
    const userIds = [
      ...new Set(candidates.flatMap((c) => (c.userId ? [c.userId] : []))),
    ];
    let snapshot: import('@work-phelo/types').EmployeeAccessSnapshot = {
      items: [],
      capturedAt: new Date().toISOString(),
    };
    if (userIds.length) {
      try {
        snapshot = await this.rabbitmq.employeeAccessSnapshot({
          tenantId,
          actorUserId: actor.id,
          userIds,
        });
      } catch {
        throw new ServiceUnavailableException({
          code: 'ACCESS_STATE_UNAVAILABLE',
          message: 'Current Auth access states could not be established.',
        });
      }
      if (
        !Array.isArray(snapshot.items) ||
        snapshot.items.length !== userIds.length ||
        new Set(snapshot.items.map((item) => item.userId)).size !==
          userIds.length ||
        !Number.isFinite(Date.parse(snapshot.capturedAt)) ||
        snapshot.items.some(
          (item) =>
            !userIds.includes(item.userId) ||
            ![
              'MISSING',
              'ACTIVE',
              'SUSPENDED',
              'INACTIVE',
              'INVITED',
              'INVITE_EXPIRED',
              'PROVISIONING',
              'PROVISIONING_FAILED',
              'INCONSISTENT',
            ].includes(item.status),
        )
      )
        throw new ServiceUnavailableException('Invalid Auth snapshot');
    }
    const accounts = new Map(
      snapshot.items.map((item) => [item.userId, item.status]),
    );
    const states = new Map(
      candidates.map((c) => [
        c.id,
        deriveEmployeeAccessState(
          c.userId,
          latest.get(c.id) ?? null,
          c.userId ? (accounts.get(c.userId) ?? 'MISSING') : null,
        ),
      ]),
    );
    const matches = candidates.filter((c) => states.get(c.id) === status);
    return {
      ids: matches.slice(skip, skip + take).map((c) => c.id),
      total: matches.length,
      states,
      capturedAt: snapshot.capturedAt,
    };
  }

  async enqueue(
    tx: Prisma.TransactionClient,
    employee: Employee,
    actor: RequestUser,
    key: string,
    employeePermission: 'CREATE' | 'EDIT',
    email: string,
  ) {
    assertAccessActor(actor, employee.tenantId, employeePermission, 'CREATE');
    if (
      employee.userId ||
      employee.employmentStatus === 'OFFBOARDED' ||
      employee.offboardedAt
    ) {
      throw new ConflictException(
        'Employee is linked or ineligible for system access.',
      );
    }
    const requestHash = accessFingerprint({
      employeeId: employee.id,
      actorUserId: actor.id,
      email,
      employeePermission,
    });
    const existing = await tx.employeeAccessOperation.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: employee.tenantId,
          idempotencyKey: key,
        },
      },
    });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new ConflictException(
          'Idempotency key was used for a different request.',
        );
      return existing;
    }
    return tx.employeeAccessOperation.create({
      data: {
        tenantId: employee.tenantId,
        employeeId: employee.id,
        actorUserId: actor.id,
        idempotencyKey: key,
        requestHash,
        employeePermission,
        email,
        firstName: employee.firstName,
        lastName: employee.lastName,
      },
    });
  }

  async grant(
    tenantId: string,
    employeeId: string,
    actor: RequestUser,
    keyInput: string,
    emailInput?: string | null,
  ) {
    assertAccessActor(actor, tenantId, 'EDIT', 'CREATE');
    const key = `grant:${accessKey(keyInput)}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`employee-access:${tenantId}:${employeeId}`}, 0))::text`;
        const employee = await tx.employee.findFirst({
          where: { tenantId, id: employeeId },
        });
        if (!employee) throw new NotFoundException('Employee not found');
        if (employee.userId === actor.id)
          throw new ForbiddenException(
            'Self-directed access changes are not allowed.',
          );
        const prior = await tx.employeeAccessOperation.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
        });
        // A retry must not resolve an omitted login email from mutable HR data again.
        const email = normalizeEmployeeEmail(
          emailInput === undefined
            ? prior
              ? prior.email
              : employee.email
            : emailInput,
        );
        if (!email)
          throw new BadRequestException('A valid login email is required.');
        if (prior) {
          const hash = accessFingerprint({
            employeeId,
            actorUserId: actor.id,
            email,
            employeePermission: 'EDIT',
          });
          if (prior.requestHash !== hash)
            throw new ConflictException(
              'Idempotency key was used for a different request.',
            );
          return this.publicOperation(prior);
        }
        const op = await this.enqueue(tx, employee, actor, key, 'EDIT', email);
        return this.publicOperation(op);
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002')
        throw new ConflictException(
          'Another employee access operation already exists.',
        );
      throw error;
    }
  }

  async lifecycle(
    tenantId: string,
    employeeId: string,
    actor: RequestUser,
    keyInput: string,
    action: 'SUSPEND' | 'RESTORE' | 'RESEND',
    reasonInput: string,
  ) {
    assertAccessActor(
      actor,
      tenantId,
      'EDIT',
      action === 'SUSPEND'
        ? 'DELETE'
        : action === 'RESTORE'
          ? 'EDIT'
          : 'CREATE',
    );
    const key = `lifecycle:${accessKey(keyInput)}`;
    const reason = typeof reasonInput === 'string' ? reasonInput.trim() : '';
    if (!reason || reason.length > 500)
      throw new BadRequestException(
        'A reason of 1-500 characters is required.',
      );
    const requestHash = accessFingerprint({
      employeeId,
      actorUserId: actor.id,
      action,
      reason,
    });
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`employee-access:${tenantId}:${employeeId}`}, 0))::text`;
        const employee = await tx.employee.findFirst({
          where: { id: employeeId, tenantId },
        });
        if (!employee) throw new NotFoundException('Employee not found');
        if (employee.userId === actor.id)
          throw new ForbiddenException(
            'Self-directed access changes are not allowed.',
          );
        const prior = await tx.employeeAccessOperation.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
        });
        if (prior) {
          if (prior.requestHash !== requestHash)
            throw new ConflictException(
              'Idempotency key was used for a different request.',
            );
          return this.publicOperation(prior);
        }
        if (
          !employee.userId ||
          employee.offboardedAt ||
          employee.employmentStatus === 'OFFBOARDED' ||
          (action === 'RESTORE' && employee.employmentStatus !== 'ACTIVE')
        )
          throw new ConflictException(
            'Employee is not eligible for this access operation.',
          );
        const op = await tx.employeeAccessOperation.create({
          data: {
            tenantId,
            employeeId,
            actorUserId: actor.id,
            action,
            reason,
            idempotencyKey: key,
            requestHash,
            employeePermission: 'EDIT',
            email: employee.email ?? '',
            firstName: employee.firstName,
            lastName: employee.lastName,
            expectedUserId: employee.userId,
            targetUserId: employee.userId,
          },
        });
        return this.publicOperation(op);
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002')
        throw new ConflictException(
          'Another employee access operation already exists.',
        );
      throw error;
    }
  }

  private async scopedEmployee(
    tenantId: string,
    employeeId: string,
    actor: RequestUser,
  ) {
    assertAccessActor(actor, tenantId, 'VIEW', 'VIEW');
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, id: employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async readOperation(
    tenantId: string,
    employeeId: string,
    id: string,
    actor: RequestUser,
  ) {
    await this.scopedEmployee(tenantId, employeeId, actor);
    const op = await this.prisma.employeeAccessOperation.findFirst({
      where: { id, tenantId, employeeId },
    });
    if (!op) throw new NotFoundException('Operation not found');
    return this.publicOperation(op);
  }

  async read(tenantId: string, employeeId: string, actor: RequestUser) {
    const employee = await this.scopedEmployee(tenantId, employeeId, actor);
    const op = await this.prisma.employeeAccessOperation.findFirst({
      where: { tenantId, employeeId },
      orderBy: { createdAt: 'desc' },
    });
    let accountStatus: string | null = null;
    let status = employee.userId ? 'UNAVAILABLE' : 'NONE';
    if (employee.userId) {
      try {
        const account = await this.rabbitmq.employeeAccessAccount({
          tenantId,
          employeeId,
          actorUserId: actor.id,
          userId: employee.userId,
        });
        accountStatus = account.status;
        status = account.status === 'MISSING' ? 'INCONSISTENT' : account.status;
      } catch {
        status = 'UNAVAILABLE';
      }
    } else if (op) {
      status =
        op.status === 'FAILED'
          ? 'PROVISIONING_FAILED'
          : op.status === 'PAUSED'
            ? 'PROVISIONING_FAILED'
            : 'PROVISIONING';
    }
    if (
      op &&
      ((op.status === 'COMPLETED' && employee.userId !== op.targetUserId) ||
        (employee.userId &&
          op.targetUserId &&
          employee.userId !== op.targetUserId))
    ) {
      status = 'INCONSISTENT';
    }
    let invitationStatus: string | null = null;
    if (status !== 'UNAVAILABLE')
      status = deriveEmployeeAccessState(employee.userId, op, accountStatus);
    if (op && op.targetUserId && op.action === 'GRANT') {
      try {
        invitationStatus = (
          await this.rabbitmq.employeeAccessCommand(
            EmployeeAccessPatterns.status,
            this.reference(op),
          )
        ).status;
      } catch {
        invitationStatus = 'UNAVAILABLE';
      }
    }
    return {
      employeeId,
      userId: employee.userId,
      status,
      accountStatus,
      invitationStatus,
      operation: op ? this.publicOperation(op) : null,
      pendingAction:
        op && ['QUEUED', 'RUNNING', 'RECONCILING', 'LINKED'].includes(op.status)
          ? op.action
          : null,
    };
  }

  reference(op: EmployeeAccessOperation): EmployeeAccessReference {
    return {
      operationId: op.id,
      tenantId: op.tenantId,
      employeeId: op.employeeId,
      actorUserId: op.actorUserId,
      requestHash: op.requestHash,
      userId: op.targetUserId ?? undefined,
    };
  }
  async verifyOffboarded(
    envelope: Parameters<
      typeof verifyAccessRpc<{ tenantId: string; userId: string }>
    >[2],
  ) {
    const input = verifyAccessRpc(
      'auth-service',
      EmployeeAccessPatterns.offboarded,
      envelope,
    );
    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        employmentStatus: 'OFFBOARDED',
      },
      select: { id: true },
    });
    return { offboarded: !!employee };
  }

  async verifyLink(
    envelope: Parameters<typeof verifyAccessRpc<EmployeeAccessReference>>[2],
  ) {
    const ref = verifyAccessRpc(
      'auth-service',
      EmployeeAccessPatterns.verifyLink,
      envelope,
    );
    const op = await this.prisma.employeeAccessOperation.findFirst({
      where: {
        id: ref.operationId,
        tenantId: ref.tenantId,
        employeeId: ref.employeeId,
        actorUserId: ref.actorUserId,
        requestHash: ref.requestHash,
        ...(ref.userId ? { targetUserId: ref.userId } : {}),
        status: { in: ['LINKED', 'RUNNING', 'RECONCILING', 'COMPLETED'] },
      },
    });
    if (!op) return { linked: false };
    if (!ref.userId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: ref.employeeId, tenantId: ref.tenantId },
        select: { userId: true },
      });
      return {
        linked: false,
        action: op.action,
        hasIdentity: !employee || !!employee.userId || !!op.targetUserId,
      };
    }
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: ref.employeeId,
        tenantId: ref.tenantId,
        userId: ref.userId,
        employmentStatus: { not: 'OFFBOARDED' },
        offboardedAt: null,
      },
    });
    return {
      linked:
        !!employee &&
        (op.action !== 'RESTORE' || employee.employmentStatus === 'ACTIVE'),
      action: op.action,
    };
  }

  @Cron('*/10 * * * * *')
  async reconcile() {
    if (this.recovering) return;
    this.recovering = true;
    try {
      const now = new Date();
      const operations = await this.prisma.employeeAccessOperation.findMany({
        where: {
          status: { in: ['QUEUED', 'RUNNING', 'RECONCILING', 'LINKED'] },
          nextAttemptAt: { lte: now },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        },
        take: 20,
        orderBy: { createdAt: 'asc' },
      });
      for (const op of operations) {
        try {
          await this.process(op.id);
        } catch {
          this.logger.warn(
            `Employee access recovery unavailable; operation=${op.id}`,
          );
        }
      }
    } finally {
      this.recovering = false;
    }
  }

  async process(id: string) {
    const now = new Date();
    const leaseToken = randomUUID();
    const claimed = await this.prisma.employeeAccessOperation.updateMany({
      where: {
        id,
        status: { in: ['QUEUED', 'RUNNING', 'RECONCILING', 'LINKED'] },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: {
        status: 'RUNNING',
        leaseToken,
        leaseUntil: new Date(Date.now() + 120000),
        attemptCount: { increment: 1 },
      },
    });
    if (!claimed.count) return;
    const op = await this.prisma.employeeAccessOperation.findUniqueOrThrow({
      where: { id },
    });
    const finish = (
      data: Prisma.EmployeeAccessOperationUpdateManyMutationInput,
    ) =>
      this.prisma.employeeAccessOperation.updateMany({
        where: { id, leaseToken },
        data: { ...data, leaseToken: null, leaseUntil: null },
      });
    try {
      const employee = await this.prisma.employee.findFirst({
        where: { id: op.employeeId, tenantId: op.tenantId },
      });
      if (
        !employee ||
        employee.employmentStatus === 'OFFBOARDED' ||
        employee.offboardedAt ||
        (employee.userId && employee.userId !== op.targetUserId)
      ) {
        await finish({
          status: 'PAUSED',
          lastErrorCode: 'EMPLOYEE_INELIGIBLE_OR_LINK_CONFLICT',
          nextAttemptAt: null,
        });
        return;
      }
      if (op.action !== 'GRANT') {
        if (
          !employee.userId ||
          employee.userId !== op.expectedUserId ||
          (op.action === 'RESTORE' && employee.employmentStatus !== 'ACTIVE')
        ) {
          await finish({
            status: 'FAILED',
            lastErrorCode: 'EMPLOYEE_LINK_OR_ELIGIBILITY_CHANGED',
            nextAttemptAt: null,
          });
          return;
        }
        const result = await this.rabbitmq.employeeAccessLifecycle({
          ...this.reference(op),
          userId: employee.userId,
          action: op.action as 'SUSPEND' | 'RESTORE' | 'RESEND',
          reason: op.reason ?? '',
          idempotencyKey: op.idempotencyKey,
        });
        if (
          result.operationId !== op.id ||
          result.tenantId !== op.tenantId ||
          result.employeeId !== op.employeeId ||
          result.userId !== employee.userId
        )
          throw new Error('Invalid lifecycle result');
        await finish(
          result.status === 'COMPLETED'
            ? {
                status: 'COMPLETED',
                completedAt: new Date(),
                nextAttemptAt: null,
                lastErrorCode: null,
              }
            : result.status === 'READY'
              ? {
                  status: 'LINKED',
                  attemptCount: 0,
                  nextAttemptAt: new Date(Date.now() + 30000),
                }
              : {
                  status: result.status === 'FAILED' ? 'FAILED' : 'PAUSED',
                  nextAttemptAt: null,
                  lastErrorCode: result.errorCode,
                },
        );
        return;
      }
      const payload: EmployeeAccessCommandPayload = {
        tenantId: op.tenantId,
        employeeId: op.employeeId,
        actorUserId: op.actorUserId,
        requestHash: op.requestHash,
        operationId: op.id,
        idempotencyKey: op.idempotencyKey,
        employeePermission: op.employeePermission as 'CREATE' | 'EDIT',
        email: op.email,
        firstName: op.firstName,
        lastName: op.lastName,
      };
      // Replay the same command after uncertain timeouts; Auth returns the existing identity.
      const result = await this.rabbitmq.employeeAccessCommand(
        EmployeeAccessPatterns.execute,
        payload,
      );
      if (
        result.operationId !== op.id ||
        result.tenantId !== op.tenantId ||
        result.employeeId !== op.employeeId
      )
        throw new Error('Invalid command result');
      if (
        result.status === 'FAILED' ||
        result.status === 'PAUSED' ||
        result.status === 'EXPIRED'
      ) {
        await finish({
          status: result.userId ? 'PAUSED' : 'FAILED',
          targetUserId: result.userId,
          lastErrorCode: result.errorCode ?? result.status,
          nextAttemptAt: null,
          completedAt: new Date(),
        });
        return;
      }
      if (!result.userId) throw new Error('Missing command identity');
      const recorded = await this.prisma.employeeAccessOperation.updateMany({
        where: { id, leaseToken },
        data: { targetUserId: result.userId },
      });
      if (!recorded.count) return;
      await this.prisma.$transaction(async (tx) => {
        const stillOwned = await tx.employeeAccessOperation.updateMany({
          where: { id, leaseToken },
          data: { targetUserId: result.userId },
        });
        if (!stillOwned.count) throw new Error('Operation lease changed');
        const linked = await tx.employee.updateMany({
          where: {
            id: op.employeeId,
            tenantId: op.tenantId,
            employmentStatus: { not: 'OFFBOARDED' },
            offboardedAt: null,
            OR: [{ userId: null }, { userId: result.userId }],
          },
          data: { userId: result.userId },
        });
        if (!linked.count) throw new Error('Employee link conflict');
        await tx.employeeAccessOperation.updateMany({
          where: { id, leaseToken },
          data: { status: 'LINKED' },
        });
      });
      const finalized = await this.rabbitmq.employeeAccessCommand(
        EmployeeAccessPatterns.finalize,
        { ...this.reference(op), userId: result.userId },
      );
      if (finalized.status === 'PROVIDER_ACCEPTED') {
        await finish({
          status: 'COMPLETED',
          completedAt: new Date(),
          nextAttemptAt: null,
          lastErrorCode: null,
        });
      } else if (['FAILED', 'PAUSED', 'EXPIRED'].includes(finalized.status)) {
        await finish({
          status: 'PAUSED',
          nextAttemptAt: null,
          lastErrorCode: finalized.errorCode ?? finalized.status,
        });
      } else {
        await finish({
          status: 'LINKED',
          attemptCount: 0,
          nextAttemptAt: new Date(Date.now() + 30000),
          lastErrorCode: null,
        });
      }
    } catch (error) {
      const remote = error as { statusCode?: number; code?: string };
      if (
        [401, 403, 409].includes(remote?.statusCode ?? 0) ||
        remote?.code === 'P2002'
      ) {
        await finish({
          status: 'PAUSED',
          lastErrorCode:
            remote.code === 'P2002'
              ? 'IDENTITY_LINK_CONFLICT'
              : 'COMMAND_REJECTED',
          nextAttemptAt: null,
        });
        return;
      }
      const exhausted = op.attemptCount >= 8;
      await finish({
        status: exhausted ? 'PAUSED' : 'RECONCILING',
        lastErrorCode: exhausted
          ? 'RETRY_EXHAUSTED'
          : 'DEPENDENCY_OR_LINK_UNCERTAIN',
        nextAttemptAt: exhausted
          ? null
          : new Date(
              Date.now() + Math.min(900000, 5000 * 2 ** op.attemptCount),
            ),
      });
    }
  }
}
