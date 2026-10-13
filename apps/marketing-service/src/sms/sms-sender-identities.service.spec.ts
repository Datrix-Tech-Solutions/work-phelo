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
  const originalReadinessMode = process.env.SMS_SENDER_READINESS_MODE;
  const originalMaxAge = process.env.SMS_SENDER_PROVIDER_STATUS_MAX_AGE_HOURS;
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
  const rabbit = {
    submitSmsSenderIdentity: jest.fn(),
    refreshSmsSenderIdentityStatus: jest.fn(),
  };
  const service = new SmsSenderIdentitiesService(
    prisma as never,
    rabbit as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.SMS_SENDER_READINESS_MODE;
    delete process.env.SMS_SENDER_PROVIDER_STATUS_MAX_AGE_HOURS;
    rabbit.submitSmsSenderIdentity.mockResolvedValue({
      provider: 'pilosms',
      providerStatus: 'PENDING',
      providerReferenceId: 'pilo-sender-1',
      providerStatusReason: 'Sender registration requested',
      providerPayload: { status: 1001 },
    });
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
      fn(tx),
    );
  });

  afterAll(() => {
    if (originalReadinessMode === undefined) {
      delete process.env.SMS_SENDER_READINESS_MODE;
    } else {
      process.env.SMS_SENDER_READINESS_MODE = originalReadinessMode;
    }
    if (originalMaxAge === undefined) {
      delete process.env.SMS_SENDER_PROVIDER_STATUS_MAX_AGE_HOURS;
    } else {
      process.env.SMS_SENDER_PROVIDER_STATUS_MAX_AGE_HOURS = originalMaxAge;
    }
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
      sender({ status: 'PENDING_PROVIDER_APPROVAL', provider: 'pilosms' }),
    );
    prisma.marketingSmsSenderIdentity.update.mockResolvedValue(
      sender({
        status: 'PENDING_PROVIDER_APPROVAL',
        approvedBy: 'platform-1',
        internalReviewStatus: 'APPROVED',
        providerStatus: 'PENDING',
        providerReferenceId: 'pilo-sender-1',
      }),
    );

    const result = await service.approve(platformUser, 'sender-1');

    expect(result.status).toBe('PENDING_PROVIDER_APPROVAL');
    expect(rabbit.submitSmsSenderIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'pilosms',
        senderId: 'Work Phelo',
      }),
    );
    expect(prisma.marketingSmsSenderIdentity.update).toHaveBeenCalledWith({
      where: { id: 'sender-1' },
      data: like({
        status: 'PENDING_PROVIDER_APPROVAL',
        internalReviewStatus: 'APPROVED',
        providerStatus: 'PENDING',
        providerReferenceId: 'pilo-sender-1',
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

  it('returns rollout inventory for legacy-approved senders missing provider approval', async () => {
    prisma.marketingSmsSenderIdentity.findMany.mockResolvedValue([
      sender({
        status: 'APPROVED',
        providerStatus: 'UNKNOWN',
        ownershipStatus: 'VERIFIED',
        internalReviewStatus: 'APPROVED',
      }),
    ]);

    const result = await service.list(TENANT, {
      status: 'APPROVED',
      providerStatusNot: 'APPROVED',
    });

    expect(prisma.marketingSmsSenderIdentity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: like({
          tenantId: TENANT,
          status: 'APPROVED',
          providerStatus: { not: 'APPROVED' },
        }),
      }),
    );
    expect(result.items[0].readiness).toMatchObject({
      ready: true,
      effectiveReady: false,
      reasonCode: 'PROVIDER_UNKNOWN',
    });
  });

  it('refreshes stale supported provider status before campaign dispatch readiness is enforced', async () => {
    process.env.SMS_SENDER_READINESS_MODE = 'strict';
    prisma.marketingSmsSenderIdentity.findFirst.mockResolvedValue(
      sender({
        status: 'APPROVED',
        ownershipStatus: 'VERIFIED',
        internalReviewStatus: 'APPROVED',
        provider: 'sasusync',
        providerStatus: 'APPROVED',
        providerLastSyncedAt: null,
      }),
    );
    rabbit.refreshSmsSenderIdentityStatus.mockResolvedValue({
      provider: 'sasusync',
      providerStatus: 'APPROVED',
      providerReferenceId: 'sasu-1',
      providerStatusReason: 'approved',
      providerPayload: { status: 'approved' },
    });
    prisma.marketingSmsSenderIdentity.update.mockResolvedValue(
      sender({
        status: 'APPROVED',
        ownershipStatus: 'VERIFIED',
        internalReviewStatus: 'APPROVED',
        provider: 'sasusync',
        providerStatus: 'APPROVED',
        providerLastSyncedAt: new Date(),
      }),
    );

    const result = await service.evaluateForCampaign(TENANT, 'sender-1', {
      refreshIfDue: true,
      campaignId: 'campaign-1',
    });

    expect(rabbit.refreshSmsSenderIdentityStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'sasusync',
        senderId: 'Work Phelo',
      }),
    );
    expect(result).toMatchObject({
      ready: true,
      effectiveReady: true,
      reasonCode: 'READY',
    });
  });

  it('does not fake provider refresh for PiloSMS and blocks stale approval in strict mode', async () => {
    process.env.SMS_SENDER_READINESS_MODE = 'strict';
    prisma.marketingSmsSenderIdentity.findFirst.mockResolvedValue(
      sender({
        status: 'APPROVED',
        ownershipStatus: 'VERIFIED',
        internalReviewStatus: 'APPROVED',
        provider: 'pilosms',
        providerStatus: 'APPROVED',
        providerLastSyncedAt: null,
      }),
    );

    const result = await service.evaluateForCampaign(TENANT, 'sender-1', {
      refreshIfDue: true,
      campaignId: 'campaign-1',
    });

    expect(rabbit.refreshSmsSenderIdentityStatus).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ready: false,
      providerStatusStale: true,
      reasonCode: 'PROVIDER_STATUS_STALE',
    });
  });
});
