import { randomUUID } from 'crypto';
import { EmployeeAccessLifecycle, RequestUser } from '@work-phelo/types';
import { accessFingerprint } from '@work-phelo/internal-auth';
import { EmployeeAccessLifecycleService } from './employee-access-lifecycle.service';

describe('Employee access lifecycle commands', () => {
  it('classifies a bounded snapshot with one database query, including explicit missing identities', async () => {
    const { service, prisma, input } = setup();
    prisma.$queryRaw.mockResolvedValue([
      {
        userId: 'known',
        status: 'ACTIVE',
        suspended: false,
        hasInvite: false,
        inviteExpiresAt: null,
        grantStatus: null,
        resendStatus: null,
        capturedAt: new Date(),
      },
    ]);
    const result = await service.snapshot({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      userIds: ['known', 'missing'],
    });
    expect(result.items).toEqual([
      { userId: 'known', status: 'ACTIVE' },
      { userId: 'missing', status: 'MISSING' },
    ]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    await expect(
      service.snapshot({
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        userIds: Array(1001).fill('id') as string[],
      }),
    ).rejects.toThrow('INVALID_SNAPSHOT');
  });
  function setup(action: EmployeeAccessLifecycle['action'] = 'SUSPEND') {
    const input: EmployeeAccessLifecycle = {
      operationId: randomUUID(),
      tenantId: 'tenant',
      employeeId: randomUUID(),
      actorUserId: 'actor',
      requestHash: accessFingerprint('test'),
      idempotencyKey: 'lifecycle:test-key',
      userId: 'target',
      action,
      reason: 'Approved change',
    };
    const user = {
      id: 'target',
      tenantId: 'tenant',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      sessionVersion: 0,
      emailVerifiedAt: new Date(),
      accessSuspendedAt: null as Date | null,
    };
    const current = {
      resolveCurrentUser: jest.fn().mockResolvedValue({
        tenantId: 'tenant',
        role: 'TENANT_ADMIN',
        permissions: [],
        moduleConfig: { hr: true },
      } as unknown as RequestUser),
    };
    const rabbit = {
      verifyEmployeeAccessLink: jest
        .fn()
        .mockResolvedValue({ linked: true, action }),
      sendEmployeeAccessInvite: jest.fn(),
    };
    const rows = {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve(data),
        ),
      upsert: jest
        .fn()
        .mockImplementation(({ create }: { create: object }) =>
          Promise.resolve(create),
        ),
    };
    const prisma = {
      employeeAccessLifecycleCommand: rows,
      employeeAccessCommand: { findFirst: jest.fn().mockResolvedValue(null) },
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn() },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
    );
    return {
      input,
      user,
      current,
      rabbit,
      rows,
      prisma,
      service: new EmployeeAccessLifecycleService(
        prisma as never,
        current as never,
        rabbit as never,
      ),
    };
  }

  it('suspends with session invalidation and audit in one transaction without changing permissions', async () => {
    const { service, input, prisma } = setup();
    await expect(service.execute(input)).resolves.toMatchObject({
      status: 'COMPLETED',
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SUSPENDED',
          sessionVersion: { increment: 1 },
          accessSuspensionReason: input.reason,
        }),
      }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it('restores only explicitly suspended verified identities, advancing sessions again', async () => {
    const { service, input, user, prisma } = setup('RESTORE');
    user.status = 'SUSPENDED';
    user.accessSuspendedAt = new Date();
    await expect(service.execute(input)).resolves.toMatchObject({
      status: 'COMPLETED',
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ACTIVE',
          sessionVersion: { increment: 1 },
          accessSuspendedAt: null,
        }),
      }),
    );
  });
  it.each(['INACTIVE', 'PENDING_VERIFICATION', 'ACTIVE'])(
    'does not restore %s accounts',
    async (status) => {
      const { service, input, user, prisma } = setup('RESTORE');
      user.status = status;
      await expect(service.execute(input)).resolves.toMatchObject({
        status: 'FAILED',
        errorCode: 'TARGET_NOT_RESTORABLE',
      });
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    },
  );
  it.each(['TENANT_ADMIN', 'SUPER_ADMIN'])(
    'protects %s targets',
    async (role) => {
      const { service, input, user } = setup();
      user.role = role;
      await expect(service.execute(input)).resolves.toMatchObject({
        errorCode: 'TARGET_INELIGIBLE',
      });
    },
  );
  it('rejects self-suspension', async () => {
    const { service, input, user } = setup();
    user.id = input.actorUserId;
    await expect(service.execute(input)).resolves.toMatchObject({
      errorCode: 'TARGET_INELIGIBLE',
    });
  });

  it('cannot restore an unverified identity even with a suspension marker', async () => {
    const { service, input, prisma, user } = setup('RESTORE');
    prisma.user.findFirst.mockResolvedValue({
      ...user,
      status: 'SUSPENDED',
      accessSuspendedAt: new Date(),
      emailVerifiedAt: null,
    });
    await expect(service.execute(input)).resolves.toMatchObject({
      errorCode: 'TARGET_NOT_RESTORABLE',
    });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('treats a revoked actor as a rejected command, but leaves database outages uncertain', async () => {
    const { service, input, current } = setup();
    current.resolveCurrentUser.mockRejectedValueOnce({ getStatus: () => 401 });
    await expect(service.execute(input)).rejects.toThrow('ACTOR_INELIGIBLE');
    current.resolveCurrentUser.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await expect(service.execute(input)).rejects.toThrow(
      'database unavailable',
    );
  });
  it('does not treat an already inactive identity as an ordinary suspension', async () => {
    const { service, input, user } = setup();
    user.status = 'INACTIVE';
    await expect(service.execute(input)).resolves.toMatchObject({
      errorCode: 'TARGET_NOT_ACTIVE',
    });
  });
  it('rechecks user deactivation authority independently from employee editing', async () => {
    const { service, input, current, prisma } = setup();
    current.resolveCurrentUser.mockResolvedValue({
      role: 'EMPLOYEE',
      permissions: ['employees:EDIT', 'users:EDIT'],
      moduleConfig: { hr: true },
    });
    await expect(service.execute(input)).rejects.toThrow(
      'ACTOR_PERMISSION_REVOKED',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('does not execute with a missing or mismatched correlated HR link', async () => {
    const { service, input, rabbit, prisma } = setup();
    rabbit.verifyEmployeeAccessLink.mockResolvedValue({ linked: false });
    await expect(service.execute(input)).rejects.toThrow('LINK_NOT_CONFIRMED');
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it('replays an identical command without repeating mutation, but rejects changed payloads', async () => {
    const { service, input, rows, prisma } = setup();
    const row = {
      id: input.operationId,
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      targetUserId: input.userId,
      status: 'COMPLETED',
      payloadHash: accessFingerprint(input),
    };
    rows.findUnique.mockResolvedValue(row);
    await expect(service.execute(input)).resolves.toMatchObject({
      status: 'COMPLETED',
    });
    await expect(
      service.execute({ ...input, reason: 'Different' }),
    ).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it('resend rotates the token once but does not publish until durable outbox processing', async () => {
    const { service, input, user, rabbit, prisma } = setup('RESEND');
    user.status = 'PENDING_VERIFICATION';
    await expect(service.execute(input)).resolves.toMatchObject({
      status: 'READY',
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inviteToken: expect.any(String),
          inviteExpiresAt: expect.any(Date),
        }),
      }),
    );
    expect(rabbit.sendEmployeeAccessInvite).not.toHaveBeenCalled();
  });
  it('does not resend to active identities or create a missing identity', async () => {
    const { service, input, prisma } = setup('RESEND');
    await expect(service.execute(input)).resolves.toMatchObject({
      errorCode: 'TARGET_NOT_PENDING',
    });
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.execute({ ...input, operationId: randomUUID() }),
    ).resolves.toMatchObject({ errorCode: 'TARGET_INELIGIBLE' });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    ['PENDING_VERIFICATION', false, 'INVITE_EXPIRED'],
    ['SUSPENDED', true, 'SUSPENDED'],
    ['SUSPENDED', false, 'INCONSISTENT'],
    ['ACTIVE', true, 'INCONSISTENT'],
    ['ACTIVE', false, 'ACTIVE'],
    ['INACTIVE', false, 'INACTIVE'],
  ])('maps %s / suspension=%s to %s', async (status, suspended, expected) => {
    const { service, input, user } = setup();
    user.status = status;
    user.accessSuspendedAt = suspended ? new Date() : null;
    await expect(service.account(input)).resolves.toEqual({ status: expected });
  });
});
