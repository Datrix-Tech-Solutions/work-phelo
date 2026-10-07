import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import {
  CampaignSegmentsService,
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
  pipelineStageIds: [STAGE],
  includeProspectIds: [],
  excludeProspectIds: [],
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
  };
  const service = new CampaignSegmentsService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.marketingProspect.count.mockResolvedValue(5);
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
      expect(result).toMatchObject({ id: 'seg-1', prospectCount: 5 });
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
      ).resolves.toEqual({ prospectCount: 5 });
    });

    it('is zero with no rules', async () => {
      await expect(service.count(user, {})).resolves.toEqual({
        prospectCount: 0,
      });
      expect(prisma.marketingProspect.count).not.toHaveBeenCalled();
    });
  });
});
