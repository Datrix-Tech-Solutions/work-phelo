import { randomUUID } from 'crypto';
import {
  EmployeeAccessInviteService,
  EmployeeAccessInviteHandler,
} from './employee-access-invite.handler';
import { signAccessRpc } from '@work-phelo/internal-auth';
import { EmployeeAccessPatterns } from '@work-phelo/types';
import {
  EmployeeInviteReceipt,
  EmployeeInviteReceiptStatus,
} from '../../prisma/generated/client';

type ReceiptCreate = Pick<
  EmployeeInviteReceipt,
  'id' | 'tenantId' | 'userId' | 'requestHash' | 'status'
>;
type ReceiptWrite = {
  status?: EmployeeInviteReceiptStatus;
  leaseToken?: string | null;
  leaseUntil?: Date | null;
  attemptCount?: { increment: number };
  lastErrorCode?: string | null;
};

describe('Durable employee invitation receipt', () => {
  const oldBase = process.env.FRONTEND_BASE_URL;
  const oldSecret = process.env.INTERNAL_SERVICE_AUTH_SECRET;
  let receipt: EmployeeInviteReceipt | null;
  let service: EmployeeAccessInviteService;
  let email: { sendEmployeeInviteEmail: jest.Mock<Promise<boolean>, []> };
  const payload = () => ({
    operationId: randomUUID(),
    tenantId: 'tenant-1',
    userId: 'user-1',
    email: 'person@example.test',
    firstName: 'Ama',
    tenantName: 'Test',
    acceptInviteUrl: 'http://localhost:3000/invite?token=test-only',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  beforeEach(() => {
    process.env.FRONTEND_BASE_URL = 'http://localhost:3000';
    process.env.INTERNAL_SERVICE_AUTH_SECRET =
      'notification-test-only-shared-secret-123456789';
    receipt = null;
    const prisma = {
      employeeInviteReceipt: {
        findUnique: jest.fn(() => Promise.resolve(receipt)),
        upsert: jest.fn(({ create }: { create: ReceiptCreate }) => {
          receipt ??= {
            ...create,
            createdAt: new Date(),
            attemptCount: 0,
            leaseUntil: null,
            leaseToken: null,
            lastErrorCode: null,
            updatedAt: new Date(),
          };
          return Promise.resolve({ ...receipt });
        }),
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: { leaseToken?: string; OR?: unknown };
            data: ReceiptWrite;
          }) => {
            if (!receipt) throw new Error('Missing test receipt');
            if (where.leaseToken && receipt.leaseToken !== where.leaseToken)
              return Promise.resolve({ count: 0 });
            if (
              where.OR &&
              receipt.leaseUntil &&
              receipt.leaseUntil > new Date()
            )
              return Promise.resolve({ count: 0 });
            receipt = {
              ...receipt,
              ...data,
              attemptCount: data.attemptCount?.increment
                ? receipt.attemptCount + 1
                : receipt.attemptCount,
            };
            return Promise.resolve({ count: 1 });
          },
        ),
      },
    };
    email = {
      sendEmployeeInviteEmail: jest
        .fn<Promise<boolean>, []>()
        .mockResolvedValue(true),
    };
    service = new EmployeeAccessInviteService(prisma as never, email as never);
  });
  it('returns safe receipt diagnostics without resetting an ambiguous outcome', async () => {
    const input = payload();
    await service.deliver(input);
    const request = {
      operationId: input.operationId,
      tenantId: input.tenantId,
      userId: input.userId,
    };
    await expect(service.inspect(request)).resolves.toEqual({
      status: 'PROVIDER_ACCEPTED',
      errorCode: null,
    });
    receipt!.status = 'UNKNOWN';
    await expect(service.inspect(request)).resolves.toMatchObject({
      status: 'BLOCKED',
    });
    await expect(
      service.inspect({ ...request, tenantId: 'foreign' }),
    ).resolves.toMatchObject({
      status: 'BLOCKED',
      errorCode: 'RECEIPT_SCOPE_MISMATCH',
    });
    expect(receipt!.status).toBe('UNKNOWN');
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(1);
  });
  afterAll(() => {
    if (oldBase === undefined) delete process.env.FRONTEND_BASE_URL;
    else process.env.FRONTEND_BASE_URL = oldBase;
    if (oldSecret === undefined)
      delete process.env.INTERNAL_SERVICE_AUTH_SECRET;
    else process.env.INTERNAL_SERVICE_AUTH_SECRET = oldSecret;
  });
  it('deduplicates provider-accepted sends and uses a stable provider idempotency key', async () => {
    const input = payload();
    await expect(service.deliver(input)).resolves.toEqual({
      status: 'PROVIDER_ACCEPTED',
    });
    await expect(service.deliver(input)).resolves.toEqual({
      status: 'PROVIDER_ACCEPTED',
    });
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(1);
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledWith(
      input.email,
      input.firstName,
      input.tenantName,
      input.acceptInviteUrl,
      `employee-access/${input.operationId}`,
    );
    expect(receipt).not.toHaveProperty('acceptInviteUrl');
    expect(receipt).not.toHaveProperty('inviteToken');
  });
  it('retries provider failures without claiming delivery', async () => {
    email.sendEmployeeInviteEmail.mockRejectedValueOnce(new Error('timeout'));
    const input = payload();
    await expect(service.deliver(input)).resolves.toEqual({ status: 'RETRY' });
    await expect(service.deliver(input)).resolves.toEqual({
      status: 'PROVIDER_ACCEPTED',
    });
  });
  it('does not send an expired invitation', async () => {
    await expect(
      service.deliver({ ...payload(), expiresAt: new Date(0).toISOString() }),
    ).resolves.toEqual({ status: 'EXPIRED' });
    expect(email.sendEmployeeInviteEmail).not.toHaveBeenCalled();
  });
  it('does not overwrite or send a conflicting replay', async () => {
    const input = payload();
    await service.deliver(input);
    await expect(
      service.deliver({ ...input, email: 'other@example.test' }),
    ).resolves.toEqual({ status: 'UNKNOWN' });
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(1);
  });
  it('waits for a live lease and recovers an expired send lease', async () => {
    const input = payload();
    email.sendEmployeeInviteEmail.mockResolvedValueOnce(false);
    await service.deliver(input);
    receipt = {
      ...receipt!,
      status: 'SENDING',
      leaseUntil: new Date(Date.now() + 10000),
      leaseToken: 'other',
    };
    await expect(service.deliver(input)).resolves.toEqual({ status: 'RETRY' });
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(1);
    receipt.leaseUntil = new Date(0);
    await expect(service.deliver(input)).resolves.toEqual({
      status: 'PROVIDER_ACCEPTED',
    });
  });
  it('pauses uncertain delivery before provider idempotency protection expires', async () => {
    const input = payload();
    email.sendEmployeeInviteEmail.mockResolvedValueOnce(false);
    await service.deliver(input);
    receipt!.createdAt = new Date(Date.now() - 24 * 3600000);
    await expect(service.deliver(input)).resolves.toEqual({
      status: 'UNKNOWN',
    });
    expect(email.sendEmployeeInviteEmail).toHaveBeenCalledTimes(1);
  });
  it('requires signed Auth provenance and never accepts a body/tenant substitution', async () => {
    const handler = new EmployeeAccessInviteHandler(service);
    const signed = signAccessRpc(
      'auth-service',
      EmployeeAccessPatterns.notify,
      payload(),
    );
    await expect(
      handler.deliver({
        ...signed,
        payload: { ...signed.payload, tenantId: 'spoofed' },
      }),
    ).rejects.toBeDefined();
    expect(email.sendEmployeeInviteEmail).not.toHaveBeenCalled();
  });

  it.each(['success', 'failure', 'forged'])(
    'acknowledges %s delivery RPC exactly once',
    async (outcome) => {
      const deliver =
        outcome === 'failure'
          ? jest.fn().mockRejectedValue(new Error('database unavailable'))
          : jest.fn().mockResolvedValue({ status: 'PROVIDER_ACCEPTED' });
      const handler = new EmployeeAccessInviteHandler({ deliver } as never);
      const ack = jest.fn();
      const context = {
        getChannelRef: () => ({ ack }),
        getMessage: () => ({}),
      } as never;
      const envelope = signAccessRpc(
        'auth-service',
        EmployeeAccessPatterns.notify,
        payload(),
      );
      if (outcome === 'forged') envelope.payload.tenantId = 'spoofed';
      const result = handler.deliver(envelope, context);
      if (outcome === 'success')
        await expect(result).resolves.toMatchObject({
          status: 'PROVIDER_ACCEPTED',
        });
      else await expect(result).rejects.toBeDefined();
      expect(ack).toHaveBeenCalledTimes(1);
    },
  );
});
