import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/campaign.dto';

const TENANT = '11111111-1111-4111-8111-111111111111';
const BUSINESS_TYPE = '22222222-2222-4222-8222-222222222222';
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
    businessTypeId: BUSINESS_TYPE,
    businessTypeName: 'Insurance',
    subject: 'Hello',
    message: 'Body',
    dispatchMode: 'INSTANT',
    scheduledDate: null,
    status: 'PENDING_DISPATCH',
    cancelledAt: null,
    createdAt: new Date('2026-10-05T00:00:00.000Z'),
    ...overrides,
  };
}

const baseDto: CreateCampaignDto = {
  name: 'Q4 Launch',
  channels: ['SMS'],
  businessTypeId: BUSINESS_TYPE,
  subject: 'Hello',
  message: 'Body',
  dispatchMode: 'INSTANT',
};

/** Typed wrapper so nested matchers don't leak `any` into object literals. */
const like = (fields: Record<string, unknown>): unknown =>
  expect.objectContaining(fields);

describe('CampaignsService', () => {
  const tx = {
    marketingCampaign: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    marketingCampaignRecipient: {
      createMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
  };
  const prisma = {
    marketingCampaign: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    marketingCampaignRecipient: { groupBy: jest.fn() },
    marketingCrmSettingOption: { findFirst: jest.fn() },
    marketingProspect: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const dispatcher = { dispatch: jest.fn(), cancel: jest.fn() };
  const service = new CampaignsService(prisma as never, dispatcher as never);

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
    prisma.marketingCrmSettingOption.findFirst.mockResolvedValue({
      id: BUSINESS_TYPE,
      name: 'Insurance',
    });
    prisma.marketingCampaignRecipient.groupBy.mockResolvedValue([]);
    tx.marketingCampaign.create.mockResolvedValue(campaignRow());
  });

  describe('create', () => {
    it('queues the primary contact of every prospect and hands off to the dispatcher', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '0240000001', 'a@x.com'),
        prospect('2', '0240000002', null),
      ]);

      const result = await service.create(user, baseDto);

      expect(prisma.marketingProspect.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT, businessTypeId: BUSINESS_TYPE },
        }),
      );
      expect(tx.marketingCampaign.create).toHaveBeenCalledWith({
        data: like({
          status: 'PENDING_DISPATCH',
          businessTypeName: 'Insurance',
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
      });
      expect(dispatcher.dispatch).toHaveBeenCalledWith('camp-1');
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
        'No prospects were found under the selected business type',
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

    it('rejects a business type that is not active in this tenant', async () => {
      prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);

      await expect(service.create(user, baseDto)).rejects.toThrow(
        'The selected business type is invalid or inactive',
      );
      expect(prisma.marketingCrmSettingOption.findFirst).toHaveBeenCalledWith(
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

  describe('preview', () => {
    it('counts reachable and skipped messages without saving', async () => {
      prisma.marketingProspect.findMany.mockResolvedValue([
        prospect('1', '0240000001', 'a@x.com'),
        prospect('2', null, 'b@x.com'),
      ]);

      await expect(
        service.preview(user, {
          businessTypeId: BUSINESS_TYPE,
          channels: ['SMS', 'EMAIL'],
        }),
      ).resolves.toEqual({ prospectCount: 2, reachable: 3, skipped: 1 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('cancels a scheduled campaign, skips its pending recipients and tells the dispatcher', async () => {
      prisma.marketingCampaign.findFirst.mockResolvedValue(
        campaignRow({ status: 'SCHEDULED' }),
      );
      tx.marketingCampaign.updateMany.mockResolvedValue({ count: 1 });
      tx.marketingCampaign.findUniqueOrThrow.mockResolvedValue(
        campaignRow({ status: 'CANCELLED' }),
      );

      const result = await service.cancel(user, 'camp-1');

      expect(tx.marketingCampaign.updateMany).toHaveBeenCalledWith({
        where: { id: 'camp-1', tenantId: TENANT, status: 'SCHEDULED' },
        data: like({
          status: 'CANCELLED',
          cancelledByUserId: 'user-1',
        }),
      });
      expect(tx.marketingCampaignRecipient.updateMany).toHaveBeenCalledWith({
        where: { campaignId: 'camp-1', status: 'PENDING' },
        data: { status: 'SKIPPED', providerDetail: 'Campaign cancelled' },
      });
      expect(dispatcher.cancel).toHaveBeenCalledWith('camp-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('refuses once the campaign is no longer scheduled', async () => {
      prisma.marketingCampaign.findFirst.mockResolvedValue(
        campaignRow({ status: 'SENDING' }),
      );

      await expect(service.cancel(user, 'camp-1')).rejects.toThrow(
        'Only scheduled campaigns can be cancelled',
      );
      expect(dispatcher.cancel).not.toHaveBeenCalled();
    });

    it('does not cancel when it started sending between the check and the update', async () => {
      prisma.marketingCampaign.findFirst.mockResolvedValue(
        campaignRow({ status: 'SCHEDULED' }),
      );
      tx.marketingCampaign.updateMany.mockResolvedValue({ count: 0 });

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
        sent: 0,
        failed: 0,
        skipped: 1,
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
    const setup = (status: string, pending: number, sent: number) => {
      tx.marketingCampaign.findUnique.mockResolvedValue(
        campaignRow({ status }),
      );
      tx.marketingCampaignRecipient.count
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(sent);
      tx.marketingCampaign.update.mockImplementation(
        ({ data }: { data: { status: string } }) =>
          Promise.resolve(campaignRow({ status: data.status })),
      );
    };

    it('marks the campaign COMPLETED once nothing is pending and something was sent', async () => {
      setup('SENDING', 0, 3);

      const result = await service.applyDeliveryResults('camp-1', [
        { recipientId: 'r1', status: 'SENT' },
        { recipientId: 'r2', status: 'FAILED', providerDetail: 'bounced' },
      ]);

      expect(tx.marketingCampaignRecipient.updateMany).toHaveBeenCalledTimes(2);
      expect(tx.marketingCampaignRecipient.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', campaignId: 'camp-1', status: 'PENDING' },
        data: like({ status: 'SENT', providerDetail: null }),
      });
      expect(result.status).toBe('COMPLETED');
    });

    it('marks the campaign FAILED when nothing was delivered', async () => {
      setup('SENDING', 0, 0);

      const result = await service.applyDeliveryResults('camp-1', [
        { recipientId: 'r1', status: 'FAILED' },
      ]);

      expect(result.status).toBe('FAILED');
    });

    it('stays SENDING while recipients are still pending', async () => {
      setup('PENDING_DISPATCH', 2, 1);

      const result = await service.applyDeliveryResults('camp-1', [
        { recipientId: 'r1', status: 'SENT' },
      ]);

      expect(result.status).toBe('SENDING');
    });

    it('leaves a cancelled campaign untouched', async () => {
      tx.marketingCampaign.findUnique.mockResolvedValue(
        campaignRow({ status: 'CANCELLED' }),
      );

      const result = await service.applyDeliveryResults('camp-1', [
        { recipientId: 'r1', status: 'SENT' },
      ]);

      expect(result.status).toBe('CANCELLED');
      expect(tx.marketingCampaignRecipient.updateMany).not.toHaveBeenCalled();
    });
  });
});
