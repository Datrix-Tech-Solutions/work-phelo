import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingCrmSettingCategory,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSegmentDto,
  SegmentRulesDto,
  UpdateSegmentDto,
} from './dto/segment.dto';

/** A business type offered as a ready-made segment: everyone with that type. */
export const BUILT_IN_PREFIX = 'business-type:';

const NOT_FOUND_MESSAGE = 'Segment not found';
const UNKNOWN_SEGMENT_MESSAGE =
  'One or more selected segments no longer exist or are not active';
const EMPTY_RULES_MESSAGE =
  'Add at least one filter or pick at least one prospect for the segment';
const DUPLICATE_NAME_MESSAGE = 'A segment with this name already exists';

interface Rules {
  businessTypeIds: string[];
  pipelineStageIds: string[];
  includeProspectIds: string[];
  excludeProspectIds: string[];
}

export interface ResolvedSegments {
  /** One entry per segment chosen, in the order chosen. */
  segments: { id: string; name: string }[];
  /** Business types the segments filter on, for display on the campaign. */
  businessTypes: { id: string; name: string }[];
  /** Matches a prospect in any of the segments. */
  where: Prisma.MarketingProspectWhereInput;
}

const normalize = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

const rulesOf = (dto: SegmentRulesDto): Rules => ({
  businessTypeIds: dto.businessTypeIds ?? [],
  pipelineStageIds: dto.pipelineStageIds ?? [],
  includeProspectIds: dto.includeProspectIds ?? [],
  excludeProspectIds: dto.excludeProspectIds ?? [],
});

/** The prospect filter for one segment: its filters or its picks, minus its exclusions. */
export function segmentWhere(rules: Rules): Prisma.MarketingProspectWhereInput {
  const filters: Prisma.MarketingProspectWhereInput[] = [];
  if (rules.businessTypeIds.length) {
    filters.push({ businessTypeId: { in: rules.businessTypeIds } });
  }
  if (rules.pipelineStageIds.length) {
    filters.push({ pipelineStageId: { in: rules.pipelineStageIds } });
  }
  const matches: Prisma.MarketingProspectWhereInput[] = [];
  if (filters.length) matches.push({ AND: filters });
  if (rules.includeProspectIds.length) {
    matches.push({ id: { in: rules.includeProspectIds } });
  }
  return {
    AND: [
      { OR: matches },
      ...(rules.excludeProspectIds.length
        ? [{ id: { notIn: rules.excludeProspectIds } }]
        : []),
    ],
  };
}

const hasRules = (rules: Rules) =>
  rules.businessTypeIds.length > 0 ||
  rules.pipelineStageIds.length > 0 ||
  rules.includeProspectIds.length > 0;

/** Saved audiences for campaigns, shared by everyone in the tenant. */
@Injectable()
export class CampaignSegmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Saved segments, then one built-in segment per active business type, each with its size. */
  async list(user: RequestUser) {
    const [saved, businessTypes, byType] = await Promise.all([
      this.prisma.marketingCampaignSegment.findMany({
        where: { tenantId: user.tenantId },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.activeBusinessTypes(user.tenantId),
      this.prisma.marketingProspect.groupBy({
        by: ['businessTypeId'],
        where: { tenantId: user.tenantId },
        _count: { _all: true },
      }),
    ]);
    const countByType = new Map(
      byType.map((row) => [row.businessTypeId, row._count._all]),
    );
    const savedCounts = await Promise.all(
      saved.map((segment) =>
        this.prisma.marketingProspect.count({
          where: { tenantId: user.tenantId, ...segmentWhere(segment) },
        }),
      ),
    );

    return [
      ...saved.map((segment, index) => ({
        ...this.toResponse(segment),
        prospectCount: savedCounts[index],
      })),
      ...businessTypes.map((type) => ({
        id: `${BUILT_IN_PREFIX}${type.id}`,
        name: type.name,
        builtIn: true,
        recipientType: 'PROSPECT' as const,
        businessTypeIds: [type.id],
        pipelineStageIds: [],
        includeProspectIds: [],
        excludeProspectIds: [],
        prospectCount: countByType.get(type.id) ?? 0,
      })),
    ];
  }

  /** How many prospects some rules would match, without saving anything. */
  async count(user: RequestUser, dto: SegmentRulesDto) {
    const rules = rulesOf(dto);
    if (!hasRules(rules)) return { prospectCount: 0 };
    const prospectCount = await this.prisma.marketingProspect.count({
      where: { tenantId: user.tenantId, ...segmentWhere(rules) },
    });
    return { prospectCount };
  }

  async create(user: RequestUser, dto: CreateSegmentDto) {
    const rules = rulesOf(dto);
    if (!hasRules(rules)) throw new BadRequestException(EMPTY_RULES_MESSAGE);
    await this.assertValidFilters(user.tenantId, rules);
    try {
      const segment = await this.prisma.marketingCampaignSegment.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          normalizedName: normalize(dto.name),
          createdByUserId: user.id,
          updatedByUserId: user.id,
          ...rules,
        },
      });
      return this.withCount(user.tenantId, segment);
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async update(user: RequestUser, id: string, dto: UpdateSegmentDto) {
    const existing = await this.findOwned(user.tenantId, id);
    const rules: Rules = {
      businessTypeIds: dto.businessTypeIds ?? existing.businessTypeIds,
      pipelineStageIds: dto.pipelineStageIds ?? existing.pipelineStageIds,
      includeProspectIds: dto.includeProspectIds ?? existing.includeProspectIds,
      excludeProspectIds: dto.excludeProspectIds ?? existing.excludeProspectIds,
    };
    if (!hasRules(rules)) throw new BadRequestException(EMPTY_RULES_MESSAGE);
    await this.assertValidFilters(user.tenantId, rules);
    try {
      const segment = await this.prisma.marketingCampaignSegment.update({
        where: { id },
        data: {
          ...(dto.name !== undefined
            ? { name: dto.name, normalizedName: normalize(dto.name) }
            : {}),
          updatedByUserId: user.id,
          ...rules,
        },
      });
      return this.withCount(user.tenantId, segment);
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  /** Campaigns already made from it keep their own copy of the name and recipients. */
  async remove(user: RequestUser, id: string) {
    await this.findOwned(user.tenantId, id);
    await this.prisma.marketingCampaignSegment.delete({ where: { id } });
  }

  /**
   * Turns the chosen segment ids (saved ids, or "business-type:<id>") into one prospect filter
   * that matches anyone in any of them. Anything unknown is rejected.
   */
  async resolve(tenantId: string, ids: string[]): Promise<ResolvedSegments> {
    const builtInTypeIds = ids
      .filter((id) => id.startsWith(BUILT_IN_PREFIX))
      .map((id) => id.slice(BUILT_IN_PREFIX.length));
    const savedIds = ids.filter((id) => !id.startsWith(BUILT_IN_PREFIX));

    const saved: Prisma.MarketingCampaignSegmentGetPayload<object>[] =
      savedIds.length
        ? await this.prisma.marketingCampaignSegment.findMany({
            where: { tenantId, id: { in: savedIds } },
          })
        : [];
    const builtIn: { id: string; name: string }[] = builtInTypeIds.length
      ? await this.activeBusinessTypes(tenantId, builtInTypeIds)
      : [];

    const savedById = new Map(saved.map((segment) => [segment.id, segment]));
    const typeById = new Map(builtIn.map((type) => [type.id, type]));

    const segments: { id: string; name: string }[] = [];
    const wheres: Prisma.MarketingProspectWhereInput[] = [];
    const typeIds = new Set<string>();
    for (const id of ids) {
      if (id.startsWith(BUILT_IN_PREFIX)) {
        const type = typeById.get(id.slice(BUILT_IN_PREFIX.length));
        if (!type) throw new BadRequestException(UNKNOWN_SEGMENT_MESSAGE);
        segments.push({ id, name: type.name });
        wheres.push(
          segmentWhere({
            businessTypeIds: [type.id],
            pipelineStageIds: [],
            includeProspectIds: [],
            excludeProspectIds: [],
          }),
        );
        typeIds.add(type.id);
      } else {
        const segment = savedById.get(id);
        if (!segment) throw new BadRequestException(UNKNOWN_SEGMENT_MESSAGE);
        segments.push({ id, name: segment.name });
        wheres.push(segmentWhere(segment));
        segment.businessTypeIds.forEach((typeId) => typeIds.add(typeId));
      }
    }

    const names = typeIds.size
      ? await this.prisma.marketingCrmSettingOption.findMany({
          where: { tenantId, id: { in: [...typeIds] } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(names.map((type) => [type.id, type.name]));

    return {
      segments,
      businessTypes: [...typeIds].map((id) => ({
        id,
        name: nameById.get(id) ?? '',
      })),
      where: { tenantId, OR: wheres },
    };
  }

  private async activeBusinessTypes(tenantId: string, ids?: string[]) {
    return this.prisma.marketingCrmSettingOption.findMany({
      where: {
        tenantId,
        category: MarketingCrmSettingCategory.PROSPECT_BUSINESS_TYPE,
        archivedAt: null,
        isActive: true,
        ...(ids ? { id: { in: ids } } : {}),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  /** Business types and stages named in a segment must belong to this tenant. */
  private async assertValidFilters(tenantId: string, rules: Rules) {
    const [types, stages] = await Promise.all([
      rules.businessTypeIds.length
        ? this.prisma.marketingCrmSettingOption.count({
            where: {
              tenantId,
              id: { in: rules.businessTypeIds },
              category: MarketingCrmSettingCategory.PROSPECT_BUSINESS_TYPE,
            },
          })
        : Promise.resolve(0),
      rules.pipelineStageIds.length
        ? this.prisma.marketingPipelineStage.count({
            where: { tenantId, id: { in: rules.pipelineStageIds } },
          })
        : Promise.resolve(0),
    ]);
    if (
      types !== rules.businessTypeIds.length ||
      stages !== rules.pipelineStageIds.length
    ) {
      throw new BadRequestException(
        'One or more selected business types or sales stages were not found',
      );
    }
  }

  private async findOwned(tenantId: string, id: string) {
    const segment = await this.prisma.marketingCampaignSegment.findFirst({
      where: { id, tenantId },
    });
    if (!segment) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return segment;
  }

  private async withCount(
    tenantId: string,
    segment: Prisma.MarketingCampaignSegmentGetPayload<object>,
  ) {
    const prospectCount = await this.prisma.marketingProspect.count({
      where: { tenantId, ...segmentWhere(segment) },
    });
    return { ...this.toResponse(segment), prospectCount };
  }

  private rethrowDuplicate(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(DUPLICATE_NAME_MESSAGE);
    }
    throw error;
  }

  private toResponse(
    segment: Prisma.MarketingCampaignSegmentGetPayload<object>,
  ) {
    return {
      id: segment.id,
      name: segment.name,
      builtIn: false,
      recipientType: segment.recipientType,
      businessTypeIds: segment.businessTypeIds,
      pipelineStageIds: segment.pipelineStageIds,
      includeProspectIds: segment.includeProspectIds,
      excludeProspectIds: segment.excludeProspectIds,
    };
  }
}
