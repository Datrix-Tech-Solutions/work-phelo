import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CampaignSegmentsService,
  segmentWhere,
} from './campaign-segments.service';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/campaign.dto';

const TENANT = '11111111-1111-4111-8111-111111111111';
const BUSINESS_TYPE = '22222222-2222-4222-8222-222222222222';
const BUILT_IN = `business-type:${BUSINESS_TYPE}`;
const SENDER = '44444444-4444-4444-8444-444444444444';
const user = { id: 'user-1', tenantId: TENANT } as RequestUser;

const prospect = (
  id: string,
  phone: string | null,
  email: string | null,
  withPrimary = true,
) => ({
  id: `p-${id}`,
  companyName: `Company ${id}`,
  contacts: withPrimary
    ? [{ id: `c-${id}`, name: `Contact ${id}`, phone, email }]
    : [],
});

function campaignRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'camp-1',
    tenantId: TENANT,
    name: 'Q4 Launch',
    channels: ['SMS'],
    businessTypeIds: [BUSINESS_TYPE],
    businessTypeNames: ['Insurance'],
    segmentIds: [BUILT_IN],
    segmentNames: ['Insurance'],
    senderIdentityId: SENDER,
    senderIdSnapshot: 'WORKPHELO',
    subject: 'Hello',
    message: 'Body',
    dispatchMode: 'INSTANT',
    scheduledDate: null,
    status: 'PENDING_DISPATCH',
    estimatedCredits: 1,
    smsReservationId: null,
    reservedCredits: 0,
    consumedCredits: 0,
    dispatchedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-10-05T00:00:00.000Z'),
    ...overrides,
  };
}

const baseDto: CreateCampaignDto = {
  name: 'Q4 Launch',
  channels: ['SMS'],
  segmentIds: [BUILT_IN],
  subject: 'Hello',
  message: 'Body',
  dispatchMode: 'INSTANT',
  senderIdentityId: SENDER,
};

/** Typed wrapper so nested matchers don't leak `any` into object literals. */
const like = (fields: Record<string, unknown>): unknown =>
  expect.objectContaining(fields);

/** The filter a built-in (business type) segment makes. */
const builtInWhere = (...businessTypeIds: string[]) =>
  segmentWhere({
    businessTypeIds,
    pipelineStageIds: [],
    includeProspectIds: [],
    excludeProspectIds: [],
  });

const PROSPECT_1 = '11111111-1111-4111-8111-aaaaaaaaaaaa';
const PROSPECT_2 = '11111111-1111-4111-8111-bbbbbbbbbbbb';

describe('CampaignsService', () => {
  const tx = {
    marketingCampaign: {
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    marketingCampaignRecipient: {
      createMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  };
  const prisma = {
    marketingCampaign: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    marketingCampaignRecipient: { groupBy: jest.fn(), aggregate: jest.fn() },
    marketingCrmSettingOption: { findMany: jest.fn(), count: jest.fn() },
    marketingCampaignSegment: { findMany: jest.fn() },
    marketingProspect: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const dispatcher = { dispatch: jest.fn(), cancel: jest.fn() };
  const senderIdentities = {
    findApprovedForCampaign: jest.fn(),
  };
  const wallet = {
    getBalance: jest.fn(),
    reserveCreditsInTransaction: jest.fn(),
    consumeReservationInTransaction: jest.fn(),
    releaseReservationInTransaction: jest.fn(),
  };
  const service = new CampaignsService(
    prisma as never,
    senderIdentities as never,
    wallet as never,
    dispatcher as never,
    new CampaignSegmentsService(prisma as never),
  );

  const createdRows = () =>
    (
      tx.marketingCampaignRecipient.createMany.mock.calls as Array<
        [{ data: Array<Record<string, unknown>> }]
      >
    )[0][0].data;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
      fn(tx),
    );
    prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
      { id: BUSINESS_TYPE, name: 'Insurance' },
    ]);
    prisma.marketingCampaignSegment.findMany.mockResolvedValue([]);
    prisma.marketingCampaignRecipient.groupBy.mockResolvedValue([]);
    tx.marketingCampaign.create.mockResolvedValue(campaignRow());
    tx.marketingCampaign.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(campaignRow(data)),
    );
    prisma.marketingCampaign.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(campaignRow(data)),
    );
    senderIdentities.findApprovedForCampaign.mockResolvedValue({
      id: SENDER,
      senderId: 'WORKPHELO',
      displayName: 'WorkPhelo',
      isDefault: true,
    });
    wallet.getBalance.mockResolvedValue({
      availableCredits: 100,
      reservedCredits: 0,
      totalCredits: 100,
    });
    wallet.reserveCreditsInTransaction.mockResolvedValue({
      id: 'reservation-1',
      reservedCredits: 2,
    });
    wallet.consumeReservationInTransaction.mockResolvedValue({});
    wallet.releaseReservationInTransaction.mockResolvedValue({});
  });

  describe('create', () => {
    it('queues the primary contact of every prospect without dispatching yet', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '0240000001', 'a@x.com'),
        prospect('2', '0240000002', null),
      ]);

      const result = await service.create(user, baseDto);

      expect(prisma.marketingProspect.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT, OR: [builtInWhere(BUSINESS_TYPE)] },
        }),
      );
      expect(tx.marketingCampaign.create).toHaveBeenCalledWith({
        data: like({
          status: 'PENDING_DISPATCH',
          businessTypeIds: [BUSINESS_TYPE],
          businessTypeNames: ['Insurance'],
          segmentIds: [BUILT_IN],
          segmentNames: ['Insurance'],
          senderIdentityId: SENDER,
          senderIdSnapshot: 'WORKPHELO',
          estimatedCredits: 2,
          createdByUserId: 'user-1',
        }),
      });
      const rows = createdRows();
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.channel === 'SMS')).toBe(true);
      expect(rows[0]).toMatchObject({
        campaignId: 'camp-1',
        tenantId: TENANT,
        address: '0240000001',
        status: 'PENDING',
        segmentCount: 1,
        estimatedCredits: 1,
        senderIdentityId: SENDER,
        senderIdSnapshot: 'WORKPHELO',
      });
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
      expect(result.status).toBe('PENDING_DISPATCH');
    });

    it('records one recipient per selected channel and skips missing addresses', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '0240000001', null),
      ]);

      await service.create(user, { ...baseDto, channels: ['SMS', 'EMAIL'] });

      const rows = createdRows();
      expect(rows).toEqual([
        expect.objectContaining({ channel: 'SMS', status: 'PENDING' }),
        expect.objectContaining({
          channel: 'EMAIL',
          address: null,
          status: 'SKIPPED',
          providerDetail: 'Primary contact has no email address',
        }),
      ]);
    });

    it('rejects SMS campaigns without an approved sender identity', async () => {
      senderIdentities.findApprovedForCampaign.mockResolvedValue(null);
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '0240000001', null),
      ]);

      await expect(service.create(user, baseDto)).rejects.toThrow(
        'SMS campaigns require an approved sender identity',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('allows email-only campaigns without a sender identity', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', null, 'a@x.com'),
      ]);

      await service.create(user, {
        ...baseDto,
        channels: ['EMAIL'],
        senderIdentityId: undefined,
      });

      expect(senderIdentities.findApprovedForCampaign).not.toHaveBeenCalled();
      expect(tx.marketingCampaign.create).toHaveBeenCalledWith({
        data: like({
          senderIdentityId: null,
          senderIdSnapshot: null,
          estimatedCredits: 0,
        }),
      });
    });

    it('skips a repeated address instead of messaging it twice', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '024 000 0001', null),
        prospect('2', '0240000001', null),
      ]);

      await service.create(user, baseDto);

      const rows = createdRows();
      expect(rows.map((row) => row.status)).toEqual(['PENDING', 'SKIPPED']);
      expect(rows[1].providerDetail).toBe('Duplicate address in this campaign');
    });

    it('targets every selected segment and keeps their order', async () => {
      const OTHER = '33333333-3333-4333-8333-333333333333';
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
        { id: OTHER, name: 'Retail' },
        { id: BUSINESS_TYPE, name: 'Insurance' },
      ]);
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '0240000001', null),
      ]);

      await service.create(user, {
        ...baseDto,
        segmentIds: [BUILT_IN, `business-type:${OTHER}`],
      });

      expect(prisma.marketingProspect.findMany).toHaveBeenCalledWith(
        like({
          where: {
            tenantId: TENANT,
            OR: [builtInWhere(BUSINESS_TYPE), builtInWhere(OTHER)],
          },
        }),
      );
      expect(tx.marketingCampaign.create).toHaveBeenCalledWith({
        data: like({
          segmentIds: [BUILT_IN, `business-type:${OTHER}`],
          segmentNames: ['Insurance', 'Retail'],
          businessTypeIds: [BUSINESS_TYPE, OTHER],
          businessTypeNames: ['Insurance', 'Retail'],
        }),
      });
    });

    it('rejects when any selected segment is unknown', async () => {
      const OTHER = '33333333-3333-4333-8333-333333333333';

      await expect(
        service.create(user, {
          ...baseDto,
          segmentIds: [BUILT_IN, `business-type:${OTHER}`],
        }),
      ).rejects.toThrow('no longer exist or are not active');
      expect(prisma.marketingProspect.findMany).not.toHaveBeenCalled();
    });

    it('ignores prospects that have no primary contact', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '0240000001', null),
        prospect('2', '0240000002', null, false),
      ]);

      await service.create(user, baseDto);

      expect(createdRows()).toHaveLength(1);
    });

    it('rejects an empty segment', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([]);

      await expect(service.create(user, baseDto)).rejects.toThrow(
        'No prospects were found in the selected segments',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('rejects a segment where nobody is reachable on the chosen channels', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '0240000001', null),
      ]);

      await expect(
        service.create(user, { ...baseDto, channels: ['EMAIL'] }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a business type segment that is not active in this tenant', async () => {
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([]);

      await expect(service.create(user, baseDto)).rejects.toThrow(
        'no longer exist or are not active',
      );
      expect(prisma.marketingCrmSettingOption.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: like({ tenantId: TENANT }),
        }),
      );
    });

    it('stores scheduled campaigns as SCHEDULED on their date', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '0240000001', null),
      ]);
      const date = new Date(Date.now() + 3 * 86_400_000)
        .toISOString()
        .slice(0, 10);

      await service.create(user, {
        ...baseDto,
        dispatchMode: 'SCHEDULED',
        scheduledDate: date,
      });

      expect(tx.marketingCampaign.create).toHaveBeenCalledWith({
        data: like({
          status: 'SCHEDULED',
          scheduledDate: new Date(`${date}T00:00:00.000Z`),
        }),
      });
    });

    it('rejects a scheduled date in the past', async () => {
      await expect(
        service.create(user, {
          ...baseDto,
          dispatchMode: 'SCHEDULED',
          scheduledDate: '2020-01-01',
        }),
      ).rejects.toThrow('The scheduled date cannot be in the past');
      expect(prisma.marketingProspect.findMany).not.toHaveBeenCalled();
    });
  });

  describe('saved segments', () => {
    const SAVED = '55555555-5555-4555-8555-555555555555';
    const STAGE = '66666666-6666-4666-8666-666666666666';
    const saved = (overrides: Record<string, unknown> = {}) => ({
      id: SAVED,
      tenantId: TENANT,
      name: 'Negotiating insurers',
      businessTypeIds: [BUSINESS_TYPE],
      pipelineStageIds: [STAGE],
      includeProspectIds: [PROSPECT_1],
      excludeProspectIds: [PROSPECT_2],
      ...overrides,
    });

    beforeEach(() => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '0240000001', 'a@x.com'),
      ]);
    });

    it('applies a saved segment’s filters, picks and exclusions', async () => {
      prisma.marketingCampaignSegment.findMany.mockResolvedValue([saved()]);

      await service.create(user, { ...baseDto, segmentIds: [SAVED] });

      expect(prisma.marketingProspect.findMany).toHaveBeenCalledWith(
        like({
          where: { tenantId: TENANT, OR: [segmentWhere(saved())] },
        }),
      );
      expect(tx.marketingCampaign.create).toHaveBeenCalledWith({
        data: like({
          segmentIds: [SAVED],
          segmentNames: ['Negotiating insurers'],
          businessTypeIds: [BUSINESS_TYPE],
        }),
      });
    });

    it('combines a saved segment with a built-in one in a single query, so nobody is listed twice', async () => {
      prisma.marketingCampaignSegment.findMany.mockResolvedValue([saved()]);

      await service.create(user, {
        ...baseDto,
        segmentIds: [SAVED, BUILT_IN],
      });

      expect(prisma.marketingProspect.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.marketingProspect.findMany).toHaveBeenCalledWith(
        like({
          where: {
            tenantId: TENANT,
            OR: [segmentWhere(saved()), builtInWhere(BUSINESS_TYPE)],
          },
        }),
      );
    });

    it('rejects a saved segment that no longer exists', async () => {
      prisma.marketingCampaignSegment.findMany.mockResolvedValue([]);

      await expect(
        service.create(user, { ...baseDto, segmentIds: [SAVED] }),
      ).rejects.toThrow('no longer exist or are not active');
    });

    it('applies segments to the preview too', async () => {
      prisma.marketingCampaignSegment.findMany.mockResolvedValue([saved()]);

      await expect(
        service.preview(user, { segmentIds: [SAVED], channels: ['SMS'] }),
      ).resolves.toMatchObject({ prospectCount: 1 });
    });

    it('lists the prospects that can be picked, within filters', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        {
          id: PROSPECT_1,
          companyName: 'Acme Ltd',
          locationLabel: 'Osu, Accra',
          contacts: [{ name: 'Ama' }],
        },
      ]);

      await expect(
        service.recipientOptions(user, {
          businessTypeIds: [BUSINESS_TYPE],
          pipelineStageIds: [STAGE],
          search: ' Acme ',
        }),
      ).resolves.toEqual([
        {
          id: PROSPECT_1,
          companyName: 'Acme Ltd',
          locationLabel: 'Osu, Accra',
          contactName: 'Ama',
        },
      ]);
      expect(prisma.marketingProspect.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: TENANT,
            businessTypeId: { in: [BUSINESS_TYPE] },
            pipelineStageId: { in: [STAGE] },
            normalizedCompanyName: { contains: 'acme' },
          },
        }),
      );
    });
  });

  describe('preview', () => {
    it('counts reachable and skipped messages without saving', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '0240000001', 'a@x.com'),
        prospect('2', null, 'b@x.com'),
      ]);

      await expect(
        service.preview(user, {
          segmentIds: [BUILT_IN],
          channels: ['SMS', 'EMAIL'],
        }),
      ).resolves.toEqual({ prospectCount: 2, reachable: 3, skipped: 1 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('estimate', () => {
    it('estimates SMS segments, wallet sufficiency and sender summary without saving', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '0240000001', 'a@x.com'),
        prospect('2', '0240000002', null),
      ]);

      const result = await service.estimate(user, {
        segmentIds: [BUILT_IN],
        channels: ['SMS'],
        senderIdentityId: SENDER,
        subject: 'Hello',
        message: 'Body',
      });

      expect(result.smsEncoding).toBe('GSM7');
      expect(result.segmentsPerMessage).toBe(1);
      expect(result.estimatedCredits).toBe(2);
      expect(result.wallet.sufficientCredits).toBe(true);
      expect(result.senderIdentity?.senderId).toBe('WORKPHELO');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('warns when SMS credits are insufficient', async () => {
      wallet.getBalance.mockResolvedValue({
        availableCredits: 1,
        reservedCredits: 0,
        totalCredits: 1,
      });
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '0240000001', null),
        prospect('2', '0240000002', null),
      ]);

      const result = await service.estimate(user, {
        segmentIds: [BUILT_IN],
        channels: ['SMS'],
        senderIdentityId: SENDER,
        subject: 'Hello',
        message: 'Body',
      });

      expect(result.wallet.sufficientCredits).toBe(false);
      expect(result.wallet.shortfallCredits).toBe(1);
      expect(result.warnings.map((warning) => warning.code)).toContain(
        'INSUFFICIENT_SMS_CREDITS',
      );
    });
  });

  describe('send', () => {
    beforeEach(() => {
      prisma.marketingCampaign.findFirst.mockResolvedValue(campaignRow());
      prisma.marketingCampaignRecipient.aggregate.mockResolvedValue({
        _sum: { estimatedCredits: 2 },
        _count: { _all: 2 },
      });
      tx.marketingCampaign.updateMany.mockResolvedValue({ count: 1 });
    });

    it('reserves credits and dispatches pending SMS campaigns', async () => {
      const result = await service.send(user, 'camp-1');

      expect(senderIdentities.findApprovedForCampaign).toHaveBeenCalledWith(
        TENANT,
        SENDER,
      );
      expect(wallet.reserveCreditsInTransaction).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          tenantId: TENANT,
          campaignId: 'camp-1',
          credits: 2,
          idempotencyKey: 'campaign:camp-1:sms',
        }),
      );
      expect(tx.marketingCampaign.update).toHaveBeenCalledWith({
        where: { id: 'camp-1' },
        data: like({
          smsReservationId: 'reservation-1',
          reservedCredits: 2,
          senderIdSnapshot: 'WORKPHELO',
        }),
      });
      expect(dispatcher.dispatch).toHaveBeenCalledWith('camp-1');
      expect(prisma.marketingCampaign.update).toHaveBeenCalledWith({
        where: { id: 'camp-1' },
        data: like({ status: 'SENDING' }),
      });
      expect(result.status).toBe('SENDING');
    });

    it('does not dispatch when credits are insufficient', async () => {
      wallet.reserveCreditsInTransaction.mockRejectedValueOnce(
        new BadRequestException('Insufficient SMS credits'),
      );

      await expect(service.send(user, 'camp-1')).rejects.toThrow(
        'Insufficient SMS credits',
      );
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('releases reserved credits when dispatch publishing fails', async () => {
      dispatcher.dispatch.mockRejectedValueOnce(new Error('broker down'));

      await expect(service.send(user, 'camp-1')).rejects.toThrow('broker down');
      expect(wallet.releaseReservationInTransaction).toHaveBeenCalledWith(
        tx,
        TENANT,
        'reservation-1',
      );
      expect(tx.marketingCampaign.update).toHaveBeenLastCalledWith({
        where: { id: 'camp-1' },
        data: like({
          status: 'PENDING_DISPATCH',
          smsReservationId: null,
          reservedCredits: 0,
        }),
      });
    });
  });

  describe('cancel', () => {
    it('cancels a scheduled campaign, cancels its pending recipients and tells the dispatcher', async () => {
      prisma.marketingCampaign.findFirst.mockResolvedValue(
        campaignRow({ status: 'SCHEDULED' }),
      );
      tx.marketingCampaign.findFirst.mockResolvedValue(
        campaignRow({ status: 'SCHEDULED' }),
      );
      tx.marketingCampaignRecipient.aggregate.mockResolvedValue({
        _sum: { estimatedCredits: 0 },
      });
      tx.marketingCampaign.update.mockResolvedValue(
        campaignRow({ status: 'CANCELLED' }),
      );

      const result = await service.cancel(user, 'camp-1');

      expect(tx.marketingCampaignRecipient.updateMany).toHaveBeenCalledWith({
        where: { campaignId: 'camp-1', status: 'PENDING' },
        data: like({
          status: 'CANCELLED',
          providerDetail: 'Campaign cancelled',
        }),
      });
      expect(dispatcher.cancel).toHaveBeenCalledWith('camp-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('refuses once the campaign is no longer scheduled', async () => {
      prisma.marketingCampaign.findFirst.mockResolvedValue(
        campaignRow({ status: 'SENDING' }),
      );

      await expect(service.cancel(user, 'camp-1')).rejects.toThrow(
        'Only campaigns that have not started sending can be cancelled',
      );
      expect(dispatcher.cancel).not.toHaveBeenCalled();
    });

    it('does not cancel when it started sending between the check and the update', async () => {
      prisma.marketingCampaign.findFirst.mockResolvedValue(
        campaignRow({ status: 'SCHEDULED' }),
      );
      tx.marketingCampaign.findFirst.mockResolvedValue(null);

      await expect(service.cancel(user, 'camp-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(dispatcher.cancel).not.toHaveBeenCalled();
    });

    it('404s for another tenant’s campaign', async () => {
      prisma.marketingCampaign.findFirst.mockResolvedValue(null);

      await expect(service.cancel(user, 'camp-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('list', () => {
    it('adds per-status recipient counts to each campaign', async () => {
      prisma.marketingCampaign.count.mockResolvedValue(1);
      prisma.marketingCampaign.findMany.mockResolvedValue([campaignRow()]);
      prisma.marketingCampaignRecipient.groupBy.mockResolvedValue([
        { campaignId: 'camp-1', status: 'PENDING', _count: { _all: 4 } },
        { campaignId: 'camp-1', status: 'SKIPPED', _count: { _all: 1 } },
      ]);

      const result = await service.list(user, { page: 1, limit: 10 });

      expect(result.data[0].recipients).toEqual({
        total: 5,
        pending: 4,
        queued: 0,
        sending: 0,
        accepted: 0,
        delivered: 0,
        sent: 0,
        failed: 0,
        skipped: 1,
        cancelled: 0,
      });
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('applyDeliveryResults', () => {
    const recipient = (overrides: Record<string, unknown> = {}) => ({
      id: 'r1',
      tenantId: TENANT,
      campaignId: 'camp-1',
      prospectId: 'p-1',
      contactId: 'c-1',
      companyName: 'Company 1',
      contactName: 'Contact 1',
      channel: 'SMS',
      address: '0240000001',
      status: 'QUEUED',
      segmentCount: 1,
      estimatedCredits: 1,
      senderIdSnapshot: 'WORKPHELO',
      senderIdentityId: SENDER,
      smsReservationId: 'reservation-1',
      provider: null,
      providerMessageId: null,
      attemptCount: 0,
      lastAttemptAt: null,
      acceptedAt: null,
      deliveredAt: null,
      failedAt: null,
      failureCode: null,
      failureReason: null,
      creditConsumedAt: null,
      creditReleasedAt: null,
      providerDetail: null,
      sentAt: null,
      createdAt: new Date('2026-10-05T00:00:00.000Z'),
      updatedAt: new Date('2026-10-05T00:00:00.000Z'),
      ...overrides,
    });
    const setup = (
      status: string,
      groups: Array<{ status: string; count: number }>,
    ) => {
      prisma.marketingCampaign.findUnique.mockResolvedValue(
        campaignRow({ status, smsReservationId: 'reservation-1' }),
      );
      tx.marketingCampaign.findUnique.mockResolvedValue(
        campaignRow({ status, smsReservationId: 'reservation-1' }),
      );
      tx.marketingCampaign.findFirst.mockResolvedValue(
        campaignRow({ status, smsReservationId: 'reservation-1' }),
      );
      tx.marketingCampaignRecipient.findFirst.mockResolvedValue(recipient());
      tx.marketingCampaignRecipient.groupBy.mockResolvedValue(
        groups.map((group) => ({
          status: group.status,
          _count: { _all: group.count },
        })),
      );
      tx.marketingCampaign.update.mockImplementation(
        ({ data }: { data: { status: string } }) =>
          Promise.resolve(campaignRow({ status: data.status })),
      );
    };

    it('marks the campaign COMPLETED once nothing is pending and something was sent', async () => {
      setup('SENDING', [{ status: 'ACCEPTED', count: 3 }]);

      const result = await service.applyDeliveryResults('camp-1', [
        { recipientId: 'r1', status: 'SENT' },
      ]);

      expect(tx.marketingCampaignRecipient.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: like({ status: 'ACCEPTED', providerDetail: undefined }),
      });
      expect(wallet.consumeReservationInTransaction).toHaveBeenCalled();
      expect(result.status).toBe('COMPLETED');
    });

    it('marks the campaign FAILED when nothing was delivered', async () => {
      setup('SENDING', [{ status: 'FAILED', count: 1 }]);

      const result = await service.applyDeliveryResults('camp-1', [
        { recipientId: 'r1', status: 'FAILED' },
      ]);

      expect(wallet.releaseReservationInTransaction).toHaveBeenCalled();
      expect(result.status).toBe('FAILED');
    });

    it('stays SENDING while recipients are still pending', async () => {
      setup('SENDING', [
        { status: 'QUEUED', count: 2 },
        { status: 'ACCEPTED', count: 1 },
      ]);

      const result = await service.applyDeliveryResults('camp-1', [
        { recipientId: 'r1', status: 'SENT' },
      ]);

      expect(result.status).toBe('SENDING');
    });

    it('leaves a cancelled campaign untouched', async () => {
      prisma.marketingCampaign.findUnique.mockResolvedValue(
        campaignRow({ status: 'CANCELLED' }),
      );
      tx.marketingCampaign.findUnique.mockResolvedValue(
        campaignRow({ status: 'CANCELLED' }),
      );
      tx.marketingCampaign.findFirst.mockResolvedValue(
        campaignRow({ status: 'CANCELLED' }),
      );

      const result = await service.applyDeliveryResults('camp-1', [
        { recipientId: 'r1', status: 'SENT' },
      ]);

      expect(result.status).toBe('CANCELLED');
      expect(tx.marketingCampaignRecipient.update).not.toHaveBeenCalled();
    });
  });
});
