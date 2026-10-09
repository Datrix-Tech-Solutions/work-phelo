import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  normalizeSenderId,
  SmsSenderIdentitiesService,
} from './sms-sender-identities.service';

const TENANT = 'tenant-1';
const user = { id: 'user-1', tenantId: TENANT } as RequestUser;
const platformUser = {
  id: 'platform-1',
  tenantId: TENANT,
  role: 'SUPER_ADMIN',
} as RequestUser;
const like = (fields: Record<string, unknown>): unknown =>
  expect.objectContaining(fields);

const sender = (overrides: Record<string, unknown> = {}) => ({
  id: 'sender-1',
  tenantId: TENANT,
  senderId: 'Work Phelo',
  normalizedSenderId: 'workphelo',
  displayName: null,
  tenantDomainId: null,
  purpose: null,
  provider: null,
  providerReference: null,
  providerReferenceId: null,
  status: 'DRAFT',
  ownershipStatus: 'UNVERIFIED',
  internalReviewStatus: 'NOT_REQUIRED',
  providerStatus: 'NOT_SUBMITTED',
  providerSubmittedAt: null,
  providerLastSyncedAt: null,
  providerStatusReason: null,
  isDefault: false,
  requestedBy: null,
  requestedAt: null,
  approvedBy: null,
  approvedAt: null,
  rejectedBy: null,
  rejectedAt: null,
  rejectionReason: null,
  createdBy: 'user-1',
  createdAt: new Date('2026-10-05T00:00:00.000Z'),
  updatedAt: new Date('2026-10-05T00:00:00.000Z'),
  ...overrides,
});

describe('SmsSenderIdentitiesService', () => {
  const tx = {
    marketingSmsSenderIdentity: {
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    marketingSmsSenderIdentity: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    marketingCampaign: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new SmsSenderIdentitiesService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
      fn(tx),
    );
  });

  it('normalizes sender IDs ignoring case and whitespace', () => {
    expect(normalizeSenderId(' Work Phelo ')).toBe('workphelo');
  });

  it('creates a draft sender identity within the tenant', async () => {
    prisma.marketingSmsSenderIdentity.findFirst.mockResolvedValue(null);
    prisma.marketingSmsSenderIdentity.create.mockResolvedValue(sender());

    const result = await service.create(user, { senderId: 'Work Phelo' });

    expect(prisma.marketingSmsSenderIdentity.create).toHaveBeenCalledWith({
      data: like({
        tenantId: TENANT,
        senderId: 'Work Phelo',
        normalizedSenderId: 'workphelo',
        createdBy: 'user-1',
      }),
    });
    expect(result.status).toBe('DRAFT');
  });

  it('creates an approved sender identity for another tenant on a platform admin’s behalf', async () => {
    prisma.marketingSmsSenderIdentity.findFirst.mockResolvedValue(null);
    prisma.marketingSmsSenderIdentity.create.mockResolvedValue(
      sender({
        tenantId: 'tenant-2',
        status: 'APPROVED',
        internalReviewStatus: 'APPROVED',
        providerStatus: 'UNKNOWN',
      }),
    );

    const result = await service.createApproved('tenant-2', 'platform-1', {
      senderId: 'Work Phelo',
    });

    expect(prisma.marketingSmsSenderIdentity.findFirst).toHaveBeenCalledWith({
      where: like({ tenantId: 'tenant-2', normalizedSenderId: 'workphelo' }),
      select: { id: true },
    });
    expect(prisma.marketingSmsSenderIdentity.create).toHaveBeenCalledWith({
      data: like({
        tenantId: 'tenant-2',
        createdBy: 'platform-1',
        status: 'APPROVED',
        internalReviewStatus: 'APPROVED',
        providerStatus: 'UNKNOWN',
        approvedBy: 'platform-1',
        approvedAt: expect.any(Date) as Date,
      }),
    });
    expect(result.status).toBe('APPROVED');
    expect(result.providerStatus).toBe('UNKNOWN');
  });

  it('rejects duplicate sender IDs within a tenant', async () => {
    prisma.marketingSmsSenderIdentity.findFirst.mockResolvedValue({
      id: 'sender-1',
    });

    await expect(
      service.create(user, { senderId: 'workphelo' }),
    ).rejects.toThrow(ConflictException);
  });

  it('submits draft or rejected sender identities for approval', async () => {
    prisma.marketingSmsSenderIdentity.findFirst.mockResolvedValue(sender());
    prisma.marketingSmsSenderIdentity.update.mockResolvedValue(
      sender({ status: 'PENDING_PROVIDER_APPROVAL', requestedBy: 'user-1' }),
    );

    const result = await service.submit(user, 'sender-1');

    expect(prisma.marketingSmsSenderIdentity.update).toHaveBeenCalledWith({
      where: { id: 'sender-1' },
      data: like({
        status: 'PENDING_PROVIDER_APPROVAL',
        internalReviewStatus: 'PENDING',
        providerStatus: 'NOT_SUBMITTED',
        requestedBy: 'user-1',
      }),
    });
    expect(result.status).toBe('PENDING_PROVIDER_APPROVAL');
  });

  it('sets only an approved sender identity as default', async () => {
    prisma.marketingSmsSenderIdentity.findFirst.mockResolvedValue(
      sender({ status: 'APPROVED' }),
    );
    tx.marketingSmsSenderIdentity.update.mockResolvedValue(
      sender({ status: 'APPROVED', isDefault: true }),
    );

    const result = await service.setDefault(user, 'sender-1');

    expect(tx.marketingSmsSenderIdentity.updateMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT, isDefault: true },
      data: { isDefault: false },
    });
    expect(result.isDefault).toBe(true);
  });

  it('blocks tenant users from approving provider approval', async () => {
    await expect(service.approve(user, 'sender-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.marketingSmsSenderIdentity.findFirst).not.toHaveBeenCalled();
  });

  it('allows platform admins to approve pending sender identities', async () => {
    prisma.marketingSmsSenderIdentity.findFirst.mockResolvedValue(
      sender({ status: 'PENDING_PROVIDER_APPROVAL' }),
    );
    prisma.marketingSmsSenderIdentity.update.mockResolvedValue(
      sender({ status: 'APPROVED', approvedBy: 'platform-1' }),
    );

    const result = await service.approve(platformUser, 'sender-1');

    expect(result.status).toBe('APPROVED');
    expect(prisma.marketingSmsSenderIdentity.update).toHaveBeenCalledWith({
      where: { id: 'sender-1' },
      data: like({
        status: 'APPROVED',
        internalReviewStatus: 'APPROVED',
        providerStatus: 'UNKNOWN',
        approvedBy: 'platform-1',
      }),
    });
  });

  it('does not set pending sender identities as default', async () => {
    prisma.marketingSmsSenderIdentity.findFirst.mockResolvedValue(
      sender({ status: 'PENDING_PROVIDER_APPROVAL' }),
    );

    await expect(service.setDefault(user, 'sender-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('does not expose another tenant sender identity', async () => {
    prisma.marketingSmsSenderIdentity.findFirst.mockResolvedValue(null);

    await expect(service.findOne(TENANT, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('blocks archiving while active campaigns reference the sender', async () => {
    prisma.marketingSmsSenderIdentity.findFirst.mockResolvedValue(sender());
    prisma.marketingCampaign.count.mockResolvedValue(1);

    await expect(service.archive(user, 'sender-1')).rejects.toThrow(
      ConflictException,
    );
  });
});
