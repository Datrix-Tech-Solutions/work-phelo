import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import {
  CampaignSegmentsService,
  clientSegmentWhere,
  segmentWhere,
} from './campaign-segments.service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const TYPE = '22222222-2222-4222-8222-222222222222';
const STAGE = '66666666-6666-4666-8666-666666666666';
const P1 = '11111111-1111-4111-8111-aaaaaaaaaaaa';
const P2 = '11111111-1111-4111-8111-bbbbbbbbbbbb';
const user = { id: 'user-1', tenantId: TENANT } as RequestUser;

/** Typed wrapper so nested matchers don't leak `any` into object literals. */
const like = (fields: Record<string, unknown>): unknown =>
  expect.objectContaining(fields);

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'seg-1',
  tenantId: TENANT,
  name: 'Negotiating insurers',
  normalizedName: 'negotiating insurers',
  recipientType: 'PROSPECT',
  businessTypeIds: [TYPE],
  productIds: [],
  pipelineStageIds: [STAGE],
  includeProspectIds: [],
  excludeProspectIds: [],
  includeClientIds: [],
  excludeClientIds: [],
  ...overrides,
});

describe('CampaignSegmentsService', () => {
  const prisma = {
    marketingCampaignSegment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    marketingCrmSettingOption: { findMany: jest.fn(), count: jest.fn() },
    marketingPipelineStage: { count: jest.fn() },
    marketingProspect: { count: jest.fn(), groupBy: jest.fn() },
    marketingClient: { count: jest.fn() },
  };
  const service = new CampaignSegmentsService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.marketingProspect.count.mockResolvedValue(5);
    prisma.marketingClient.count.mockResolvedValue(3);
    prisma.marketingCrmSettingOption.count.mockResolvedValue(1);
    prisma.marketingPipelineStage.count.mockResolvedValue(1);
  });

  describe('segmentWhere', () => {
    it('matches the filters together, or the picked prospects, minus the exclusions', () => {
      expect(
        segmentWhere({
          businessTypeIds: [TYPE],
          pipelineStageIds: [STAGE],
          includeProspectIds: [P1],
          excludeProspectIds: [P2],
        }),
      ).toEqual({
        AND: [
          {
            OR: [
              {
                AND: [
                  { businessTypeId: { in: [TYPE] } },
                  { pipelineStageId: { in: [STAGE] } },
                ],
              },
              { id: { in: [P1] } },
            ],
          },
          { id: { notIn: [P2] } },
        ],
      });
    });
  });

  describe('clientSegmentWhere', () => {
    it('matches the business types, or the picked clients, minus the exclusions', () => {
      expect(
        clientSegmentWhere({
          businessTypeIds: [TYPE],
          includeClientIds: [P1],
          excludeClientIds: [P2],
        }),
      ).toEqual({
        AND: [
          {
            OR: [
              { AND: [{ businessTypeId: { in: [TYPE] } }] },
              { id: { in: [P1] } },
            ],
          },
          { id: { notIn: [P2] } },
        ],
      });
    });
  });

  describe('products', () => {
    const PRODUCT = '33333333-3333-4333-8333-333333333333';

    it('limits prospects to those with any of the products, alongside the other filters', () => {
      expect(
        segmentWhere({
          businessTypeIds: [TYPE],
          productIds: [PRODUCT],
          pipelineStageIds: [],
          includeProspectIds: [],
          excludeProspectIds: [],
        }),
      ).toEqual({
        AND: [
          {
            OR: [
              {
                AND: [
                  { businessTypeId: { in: [TYPE] } },
                  { products: { some: { productId: { in: [PRODUCT] } } } },
                ],
              },
            ],
          },
        ],
      });
    });

    it('does not count a product a client is uninterested in', () => {
      expect(
        clientSegmentWhere({
          businessTypeIds: [],
          productIds: [PRODUCT],
          includeClientIds: [],
          excludeClientIds: [],
        }),
      ).toEqual({
        AND: [
          {
            OR: [
              {
                AND: [
                  {
                    products: {
                      some: {
                        productId: { in: [PRODUCT] },
                        status: { not: 'UNINTERESTED' },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it('saves a segment made of products alone', async () => {
      prisma.marketingCampaignSegment.create.mockResolvedValue(
        row({
          businessTypeIds: [],
          pipelineStageIds: [],
          productIds: [PRODUCT],
        }),
      );

      await service.create(user, {
        name: 'Motor cover',
        productIds: [PRODUCT],
      });

      expect(prisma.marketingCampaignSegment.create).toHaveBeenCalledWith({
        data: like({ productIds: [PRODUCT] }),
      });
    });

    it('rejects a product that is not one of the tenant’s', async () => {
      prisma.marketingCrmSettingOption.count.mockResolvedValue(0);

      await expect(
        service.create(user, { name: 'X', productIds: [PRODUCT] }),
      ).rejects.toThrow(/not found/);
      expect(prisma.marketingCampaignSegment.create).not.toHaveBeenCalled();
    });

    it('counts clients with the product for a client segment', async () => {
      await expect(
        service.count(user, { recipientType: 'CLIENT', productIds: [PRODUCT] }),
      ).resolves.toEqual({ prospectCount: 0, clientCount: 3 });
    });
  });

  describe('list', () => {
    it('returns saved segments, then a built-in one per active business type, with their sizes', async () => {
      prisma.marketingCampaignSegment.findMany.mockResolvedValue([row()]);
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
        { id: TYPE, name: 'Insurance' },
      ]);
      prisma.marketingProspect.groupBy.mockResolvedValue([
        { businessTypeId: TYPE, _count: { _all: 12 } },
      ]);

      const result = await service.list(user);

      expect(result).toEqual([
        expect.objectContaining({
          id: 'seg-1',
          builtIn: false,
          prospectCount: 5,
        }),
        expect.objectContaining({
          id: `business-type:${TYPE}`,
          name: 'Insurance',
          builtIn: true,
          prospectCount: 12,
        }),
      ]);
    });
  });

  describe('create', () => {
    it('saves a segment for the whole tenant', async () => {
      prisma.marketingCampaignSegment.create.mockResolvedValue(row());

      const result = await service.create(user, {
        name: 'Negotiating insurers',
        businessTypeIds: [TYPE],
        pipelineStageIds: [STAGE],
      });

      expect(prisma.marketingCampaignSegment.create).toHaveBeenCalledWith({
        data: like({
          tenantId: TENANT,
          name: 'Negotiating insurers',
          normalizedName: 'negotiating insurers',
          createdByUserId: 'user-1',
          businessTypeIds: [TYPE],
          pipelineStageIds: [STAGE],
        }),
      });
      expect(result).toMatchObject({
        id: 'seg-1',
        prospectCount: 5,
        clientCount: 0,
      });
    });

    it('needs at least one filter or picked prospect', async () => {
      await expect(service.create(user, { name: 'Everyone' })).rejects.toThrow(
        /at least one filter/,
      );
      expect(prisma.marketingCampaignSegment.create).not.toHaveBeenCalled();
    });

    it('rejects a business type or stage from another tenant', async () => {
      prisma.marketingCrmSettingOption.count.mockResolvedValue(0);

      await expect(
        service.create(user, { name: 'X', businessTypeIds: [TYPE] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('reports a duplicate name', async () => {
      prisma.marketingCampaignSegment.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.create(user, { name: 'X', includeProspectIds: [P1] }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update and remove', () => {
    it('keeps what is not sent and checks the result still has rules', async () => {
      prisma.marketingCampaignSegment.findFirst.mockResolvedValue(row());
      prisma.marketingCampaignSegment.update.mockResolvedValue(row());

      await service.update(user, 'seg-1', { excludeProspectIds: [P2] });

      expect(prisma.marketingCampaignSegment.update).toHaveBeenCalledWith({
        where: { id: 'seg-1' },
        data: like({
          businessTypeIds: [TYPE],
          pipelineStageIds: [STAGE],
          excludeProspectIds: [P2],
        }),
      });
    });

    it('refuses to empty a segment of all its rules', async () => {
      prisma.marketingCampaignSegment.findFirst.mockResolvedValue(row());

      await expect(
        service.update(user, 'seg-1', {
          businessTypeIds: [],
          pipelineStageIds: [],
        }),
      ).rejects.toThrow(/at least one filter/);
    });

    it('is not found for another tenant’s segment', async () => {
      prisma.marketingCampaignSegment.findFirst.mockResolvedValue(null);

      await expect(service.remove(user, 'seg-9')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.marketingCampaignSegment.delete).not.toHaveBeenCalled();
    });

    it('deletes a segment', async () => {
      prisma.marketingCampaignSegment.findFirst.mockResolvedValue(row());

      await service.remove(user, 'seg-1');

      expect(prisma.marketingCampaignSegment.delete).toHaveBeenCalledWith({
        where: { id: 'seg-1' },
      });
    });
  });

  describe('count', () => {
    it('counts what some rules match without saving', async () => {
      await expect(
        service.count(user, { businessTypeIds: [TYPE] }),
      ).resolves.toEqual({ prospectCount: 5, clientCount: 0 });
    });

    it('is zero with no rules', async () => {
      await expect(service.count(user, {})).resolves.toEqual({
        prospectCount: 0,
        clientCount: 0,
      });
      expect(prisma.marketingProspect.count).not.toHaveBeenCalled();
    });
  });

  describe('client segments', () => {
    it('saves a client segment and counts clients, not prospects', async () => {
      prisma.marketingCampaignSegment.create.mockResolvedValue(
        row({ recipientType: 'CLIENT', pipelineStageIds: [] }),
      );

      const result = await service.create(user, {
        name: 'Insurance clients',
        recipientType: 'CLIENT',
        businessTypeIds: [TYPE],
      });

      expect(prisma.marketingCampaignSegment.create).toHaveBeenCalledWith({
        data: like({ recipientType: 'CLIENT', businessTypeIds: [TYPE] }),
      });
      expect(result).toMatchObject({ prospectCount: 0, clientCount: 3 });
      expect(prisma.marketingProspect.count).not.toHaveBeenCalled();
    });

    it('lets a client segment be made of picked clients alone', async () => {
      prisma.marketingCampaignSegment.create.mockResolvedValue(
        row({
          recipientType: 'CLIENT',
          businessTypeIds: [],
          pipelineStageIds: [],
          includeClientIds: [P1],
        }),
      );

      await expect(
        service.create(user, {
          name: 'VIPs',
          recipientType: 'CLIENT',
          includeClientIds: [P1],
        }),
      ).resolves.toMatchObject({ clientCount: 3 });
    });

    it.each([
      ['a sales stage', { pipelineStageIds: [STAGE] }],
      ['a prospect pick', { includeProspectIds: [P1] }],
    ])('refuses %s in a client segment', async (_label, rules) => {
      await expect(
        service.create(user, {
          name: 'X',
          recipientType: 'CLIENT',
          businessTypeIds: [TYPE],
          ...rules,
        }),
      ).rejects.toThrow(/cannot be used in a client segment/);
      expect(prisma.marketingCampaignSegment.create).not.toHaveBeenCalled();
    });

    it('refuses a client pick in a prospect segment', async () => {
      await expect(
        service.create(user, {
          name: 'X',
          businessTypeIds: [TYPE],
          includeClientIds: [P1],
        }),
      ).rejects.toThrow(/cannot be used in a prospect segment/);
    });

    it('needs a filter or a picked client', async () => {
      await expect(
        service.create(user, { name: 'X', recipientType: 'CLIENT' }),
      ).rejects.toThrow(/at least one filter/);
    });

    it('does not let a saved segment change who it holds', async () => {
      prisma.marketingCampaignSegment.findFirst.mockResolvedValue(row());

      await expect(
        service.update(user, 'seg-1', { recipientType: 'CLIENT' }),
      ).rejects.toThrow(/cannot be changed/);
      expect(prisma.marketingCampaignSegment.update).not.toHaveBeenCalled();
    });

    it('counts clients for client rules', async () => {
      await expect(
        service.count(user, {
          recipientType: 'CLIENT',
          businessTypeIds: [TYPE],
        }),
      ).resolves.toEqual({ prospectCount: 0, clientCount: 3 });
    });

    it('resolves prospect and client segments into separate filters', async () => {
      prisma.marketingCampaignSegment.findMany.mockResolvedValue([
        row({ id: 'seg-p' }),
        row({
          id: 'seg-c',
          recipientType: 'CLIENT',
          pipelineStageIds: [],
        }),
      ]);
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
        { id: TYPE, name: 'Insurance' },
      ]);

      const result = await service.resolve(TENANT, ['seg-p', 'seg-c']);

      expect(result.prospectWhere).toEqual({
        tenantId: TENANT,
        OR: [segmentWhere(row())],
      });
      expect(result.clientWhere).toEqual({
        tenantId: TENANT,
        OR: [
          clientSegmentWhere({
            businessTypeIds: [TYPE],
            includeClientIds: [],
            excludeClientIds: [],
          }),
        ],
      });
    });

    it('has no client filter when only prospect segments were chosen', async () => {
      prisma.marketingCampaignSegment.findMany.mockResolvedValue([row()]);
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([]);

      const result = await service.resolve(TENANT, ['seg-1']);

      expect(result.clientWhere).toBeNull();
    });
  });
});
