import { randomUUID } from 'crypto';
import { EmployeeAccessRecovery } from '@work-phelo/types';
import { EmployeeAccessRecoveryService } from './employee-access-recovery.service';

describe('Scoped employee access recovery', () => {
  function setup() {
    const input: EmployeeAccessRecovery = {
      recoveryId: randomUUID(),
      operationId: randomUUID(),
      employeeId: randomUUID(),
      tenantId: 'tenant',
      actorUserId: 'initiator',
      operatorUserId: 'operator',
      requestHash: 'hash',
      employeePermission: 'EDIT',
      action: 'GRANT',
      reason: 'Dependency repaired',
    };
    const command = {
      id: input.operationId,
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      actorUserId: input.actorUserId,
      requestHash: input.requestHash,
      employeePermission: 'EDIT',
      action: 'GRANT',
      targetUserId: 'target',
      status: 'PAUSED',
      updatedAt: new Date(),
      createdAt: new Date(),
      leaseUntil: null as Date | null,
    };
    const current = {
      resolveCurrentUser: jest.fn().mockResolvedValue({
        role: 'TENANT_ADMIN',
        moduleConfig: { hr: true },
        permissions: [],
      }),
    };
    const rabbit = {
      verifyEmployeeAccessLink: jest.fn().mockResolvedValue({
        linked: false,
        action: 'GRANT',
        hasIdentity: false,
      }),
      inspectEmployeeInvite: jest.fn().mockResolvedValue({ status: 'RETRY' }),
    };
    const prisma = {
      employeeAccessCommand: {
        findUnique: jest.fn().mockResolvedValue(command),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      employeeAccessLifecycleCommand: { findUnique: jest.fn() },
      employeeAccessRecoveryReceipt: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'target',
          role: 'EMPLOYEE',
          status: 'PENDING_VERIFICATION',
          inviteToken: 'private-not-returned',
          inviteExpiresAt: new Date(Date.now() + 3600000),
        }),
      },
      auditLog: { create: jest.fn() },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
    );
    return {
      input,
      command,
      current,
      rabbit,
      prisma,
      service: new EmployeeAccessRecoveryService(
        prisma as never,
        current as never,
        rabbit as never,
      ),
    };
  }
  it('does not retry a missing provisioning command when HR already knows an identity', async () => {
    const { service, input, prisma, rabbit } = setup();
    prisma.employeeAccessCommand.findUnique.mockResolvedValue(null);
    rabbit.verifyEmployeeAccessLink.mockResolvedValue({
      linked: false,
      action: 'GRANT',
      hasIdentity: true,
    });
    await expect(service.recover(input)).resolves.toMatchObject({
      outcome: 'BLOCKED',
      errorCode: 'COMMAND_MISSING_OR_IDENTITY_UNCERTAIN',
    });
    expect(prisma.employeeAccessCommand.updateMany).not.toHaveBeenCalled();
  });
  it('rearms only the same command after a safe receipt, recording actor/reason/outcome atomically', async () => {
    const { service, input, prisma } = setup();
    await expect(service.recover(input)).resolves.toEqual({
      outcome: 'REQUEUE',
      errorCode: null,
    });
    expect(prisma.employeeAccessCommand.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: input.operationId }),
        data: expect.objectContaining({ status: 'READY', attemptCount: 0 }),
      }),
    );
    expect(prisma.employeeAccessRecoveryReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          operatorUserId: input.operatorUserId,
          reason: input.reason,
          outcome: 'REQUEUE',
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
  it('never retries an ambiguous provider outcome', async () => {
    const { service, input, prisma, rabbit } = setup();
    rabbit.inspectEmployeeInvite.mockResolvedValue({
      status: 'BLOCKED',
      errorCode: 'DELIVERY_REVIEW_REQUIRED',
    });
    await expect(service.recover(input)).resolves.toMatchObject({
      outcome: 'BLOCKED',
    });
    expect(prisma.employeeAccessCommand.updateMany).not.toHaveBeenCalled();
  });
  it('does not steal an active worker lease', async () => {
    const { service, input, command, prisma } = setup();
    command.leaseUntil = new Date(Date.now() + 100000);
    await expect(service.recover(input)).rejects.toThrow('COMMAND_BUSY');
    expect(prisma.employeeAccessCommand.updateMany).not.toHaveBeenCalled();
  });
  it('does not re-execute terminal failed commands', async () => {
    const { service, input, command, prisma } = setup();
    command.status = 'FAILED';
    await expect(service.recover(input)).resolves.toMatchObject({
      outcome: 'FAILED',
    });
    expect(prisma.employeeAccessCommand.updateMany).not.toHaveBeenCalled();
  });
  it('enforces operator user-edit authority and original actor current permissions', async () => {
    const { service, input, current, prisma } = setup();
    current.resolveCurrentUser.mockResolvedValue({
      role: 'EMPLOYEE',
      moduleConfig: { hr: true },
      permissions: ['employees:EDIT', 'users:CREATE'],
    });
    await expect(service.recover(input)).rejects.toThrow(
      'RECOVERY_AUTHORITY_REQUIRED',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects cross-tenant command references', async () => {
    const { service, input, command } = setup();
    command.tenantId = 'foreign';
    await expect(service.recover(input)).rejects.toThrow(
      'COMMAND_SCOPE_MISMATCH',
    );
  });
});
