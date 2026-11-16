import { randomUUID } from 'crypto';
import { EmployeeAccessCommandService } from './employee-access-command.service';
import { EmployeeAccessCommand, Prisma } from '../../prisma/generated/client';
import { accessFingerprint, signAccessRpc } from '@work-phelo/internal-auth';
import {
  EmployeeAccessCommandPayload,
  EmployeeAccessPatterns,
  RequestUser,
} from '@work-phelo/types';
import { EmployeeAccessCommandHandler } from './employee-access-command.handler';

describe('Employee access RPC acknowledgments', () => {
  it.each(['success', 'failure', 'forged'])(
    'acknowledges %s exactly once',
    async (outcome) => {
      const original = process.env.INTERNAL_SERVICE_AUTH_SECRET;
      process.env.INTERNAL_SERVICE_AUTH_SECRET =
        'local-test-employee-access-ack-secret-12345';
      const ack = jest.fn();
      const context = {
        getChannelRef: () => ({ ack }),
        getMessage: () => ({}),
      };
      const execute =
        outcome === 'failure'
          ? jest.fn().mockRejectedValue(new Error('database unavailable'))
          : jest.fn().mockResolvedValue({ status: 'PROVISIONED' });
      const handler = new EmployeeAccessCommandHandler(
        { execute } as never,
        {} as never,
        {} as never,
      );
      try {
        const envelope = signAccessRpc(
          'hr-service',
          EmployeeAccessPatterns.execute,
          {} as EmployeeAccessCommandPayload,
        );
        if (outcome === 'forged') envelope.proof.signature = 'invalid';
        const result = handler.execute(envelope, context as never);
        if (outcome === 'success')
          await expect(result).resolves.toEqual({ status: 'PROVISIONED' });
        else await expect(result).rejects.toBeDefined();
        expect(ack).toHaveBeenCalledTimes(1);
      } finally {
        if (original === undefined)
          delete process.env.INTERNAL_SERVICE_AUTH_SECRET;
        else process.env.INTERNAL_SERVICE_AUTH_SECRET = original;
      }
    },
  );
});

describe('Employee access command invariants', () => {
  const oldOwner = process.env.SUPER_ADMIN_EMAIL;
  let saved: EmployeeAccessCommand | null;
  let service: EmployeeAccessCommandService;
  let payload: EmployeeAccessCommandPayload;
  let actor: RequestUser;
  const current = {
    resolveCurrentUser: jest.fn<Promise<RequestUser>, [string, string]>(),
  };
  const rabbitmq = {
    verifyEmployeeAccessLink: jest.fn(),
    sendEmployeeAccessInvite: jest.fn(),
  };
  const user = { findFirst: jest.fn(), create: jest.fn() };
  const baseline = { findFirst: jest.fn() };
  const assignment = { create: jest.fn(), deleteMany: jest.fn() };
  const resource = { upsert: jest.fn() };
  const persist = ({
    data,
  }: {
    data: Prisma.EmployeeAccessCommandUncheckedCreateInput;
  }) => {
    saved = {
      ...data,
      status: data.status ?? 'PROVISIONED',
      targetUserId: data.targetUserId ?? null,
      lastErrorCode: data.lastErrorCode ?? null,
    } as EmployeeAccessCommand;
    return Promise.resolve(saved);
  };

  beforeEach(() => {
    jest.resetAllMocks();
    saved = null;
    process.env.SUPER_ADMIN_EMAIL = 'owner@example.test';
    payload = {
      operationId: randomUUID(),
      employeeId: randomUUID(),
      tenantId: randomUUID(),
      actorUserId: randomUUID(),
      idempotencyKey: 'grant:test-operation',
      requestHash: accessFingerprint('test'),
      employeePermission: 'EDIT',
      email: 'employee@example.test',
      firstName: 'Ama',
      lastName: 'Test',
    };
    actor = {
      id: payload.actorUserId,
      tenantId: payload.tenantId,
      role: 'TENANT_ADMIN',
      email: 'admin@example.test',
      firstName: 'Admin',
      tenantSlug: 'test',
      tenantName: 'Test',
      permissions: [],
      moduleConfig: { hr: true },
      featureConfig: {},
    };
    current.resolveCurrentUser.mockResolvedValue(actor);
    const target = {
      id: randomUUID(),
      role: 'EMPLOYEE',
      status: 'PENDING_VERIFICATION',
    };
    user.findFirst.mockImplementation(({ where }: { where: { id?: string } }) =>
      Promise.resolve(where.id ? target : null),
    );
    user.create.mockResolvedValue(target);
    baseline.findFirst.mockResolvedValue({ id: 'baseline' });
    assignment.create.mockResolvedValue({});
    assignment.deleteMany.mockResolvedValue({ count: 0 });
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(prisma),
      employeeAccessCommand: {
        findUnique: jest.fn(() => Promise.resolve(saved)),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(persist),
        upsert: jest.fn(
          ({
            create,
          }: {
            create: Prisma.EmployeeAccessCommandUncheckedCreateInput;
          }) => persist({ data: create }),
        ),
      },
      user,
      permissionSet: baseline,
      userPermissionSet: assignment,
      resource,
      tenant: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ name: 'Test', slug: 'test' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    service = new EmployeeAccessCommandService(
      prisma as never,
      current as never,
      rabbitmq as never,
    );
  });
  afterAll(() => {
    if (oldOwner === undefined) delete process.env.SUPER_ADMIN_EMAIL;
    else process.env.SUPER_ADMIN_EMAIL = oldOwner;
  });

  it('creates once and assigns the existing baseline without global seeding or invitation publication', async () => {
    const first = await service.execute(payload);
    const replay = await service.execute(payload);
    expect(first.userId).toBe(replay.userId);
    expect(user.create).toHaveBeenCalledTimes(1);
    expect(assignment.create).toHaveBeenCalledWith({
      data: {
        userId: first.userId,
        permissionSetId: 'baseline',
        grantedBy: actor.id,
      },
    });
    expect(resource.upsert).not.toHaveBeenCalled();
    expect(rabbitmq.sendEmployeeAccessInvite).not.toHaveBeenCalled();
    expect(current.resolveCurrentUser).toHaveBeenCalledTimes(2);
  });
  it('fails closed without the tenant baseline, without creating an identity', async () => {
    baseline.findFirst.mockResolvedValue(null);
    await expect(service.execute(payload)).resolves.toMatchObject({
      status: 'FAILED',
      errorCode: 'EMPLOYEE_BASELINE_MISSING',
      userId: null,
    });
    expect(user.create).not.toHaveBeenCalled();
  });
  it('uses current permissions rather than authority previously held by the actor', async () => {
    current.resolveCurrentUser.mockResolvedValue({
      ...actor,
      role: 'EMPLOYEE',
      permissions: ['employees:EDIT'],
    });
    await expect(service.execute(payload)).resolves.toMatchObject({
      status: 'FAILED',
      errorCode: 'ACTOR_PERMISSION_REVOKED',
    });
    expect(user.create).not.toHaveBeenCalled();
  });
  it('rejects inactive actors and treats database outages as uncertain, not revocation', async () => {
    current.resolveCurrentUser.mockRejectedValueOnce({ getStatus: () => 401 });
    await expect(service.execute(payload)).resolves.toMatchObject({
      status: 'FAILED',
      errorCode: 'ACTOR_INELIGIBLE',
    });
    saved = null;
    current.resolveCurrentUser.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await expect(service.execute(payload)).rejects.toThrow(
      'database unavailable',
    );
    expect(saved).toBeNull();
  });
  it('rejects all existing identities, including administrator identities, instead of linking them', async () => {
    user.findFirst.mockResolvedValue({
      id: 'existing-admin',
      role: 'TENANT_ADMIN',
    });
    await expect(service.execute(payload)).resolves.toMatchObject({
      status: 'FAILED',
      errorCode: 'IDENTITY_CONFLICT',
    });
    expect(user.create).not.toHaveBeenCalled();
  });
  it('rejects a payload change on replay without replacing the persisted outcome', async () => {
    const first = await service.execute(payload);
    await expect(
      service.execute({ ...payload, email: 'different@example.test' }),
    ).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    expect(saved?.targetUserId).toBe(first.userId);
  });
  it('does not mark publication ready without confirmed HR linkage', async () => {
    const first = await service.execute(payload);
    rabbitmq.verifyEmployeeAccessLink.mockResolvedValue({ linked: false });
    await expect(
      service.finalize({
        operationId: payload.operationId,
        tenantId: payload.tenantId,
        employeeId: payload.employeeId,
        actorUserId: actor.id,
        requestHash: payload.requestHash,
        userId: first.userId!,
      }),
    ).rejects.toThrow('LINK_NOT_CONFIRMED');
    expect(saved?.status).toBe('PROVISIONED');
    expect(rabbitmq.sendEmployeeAccessInvite).not.toHaveBeenCalled();
  });
});
