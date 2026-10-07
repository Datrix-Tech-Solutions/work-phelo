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
  'Add at least one filter or pick at least one person for the segment';
const TYPE_LOCKED_MESSAGE =
  'The recipient type of a saved segment cannot be changed';
const PROSPECT_ONLY_MESSAGE =
  'Client picks cannot be used in a prospect segment';
const CLIENT_ONLY_MESSAGE =
  'Sales stages and prospect picks cannot be used in a client segment';
const DUPLICATE_NAME_MESSAGE = 'A segment with this name already exists';

interface Rules {
  businessTypeIds: string[];
  productIds: string[];
  pipelineStageIds: string[];
  includeProspectIds: string[];
  excludeProspectIds: string[];
  includeClientIds: string[];
  excludeClientIds: string[];
}

type RecipientType = 'PROSPECT' | 'CLIENT';

/** The rules a prospect segment is made of; client picks are not part of it. */
type ProspectRules = Pick<
  Rules,
  | 'businessTypeIds'
  | 'pipelineStageIds'
  | 'includeProspectIds'
  | 'excludeProspectIds'
> &
  Partial<Pick<Rules, 'productIds'>>;

/** The rules a client segment is made of: no sales stage, and client picks. */
type ClientRules = Pick<
  Rules,
  'businessTypeIds' | 'includeClientIds' | 'excludeClientIds'
> &
  Partial<Pick<Rules, 'productIds'>>;

export interface ResolvedSegments {
  /** One entry per segment chosen, in the order chosen. */
  segments: { id: string; name: string }[];
  /** Business types the segments filter on, for display on the campaign. */
  businessTypes: { id: string; name: string }[];
  /** Matches a prospect in any of the prospect segments; null when none was chosen. */
  prospectWhere: Prisma.MarketingProspectWhereInput | null;
  /** Matches a client in any of the client segments; null when none was chosen. */
  clientWhere: Prisma.MarketingClientWhereInput | null;
}

const normalize = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

const rulesOf = (dto: SegmentRulesDto): Rules => ({
  businessTypeIds: dto.businessTypeIds ?? [],
  productIds: dto.productIds ?? [],
  pipelineStageIds: dto.pipelineStageIds ?? [],
  includeProspectIds: dto.includeProspectIds ?? [],
  excludeProspectIds: dto.excludeProspectIds ?? [],
  includeClientIds: dto.includeClientIds ?? [],
  excludeClientIds: dto.excludeClientIds ?? [],
});

/** The prospect filter for one segment: its filters or its picks, minus its exclusions. */
export function segmentWhere(
  rules: ProspectRules,
): Prisma.MarketingProspectWhereInput {
  const filters: Prisma.MarketingProspectWhereInput[] = [];
  if (rules.businessTypeIds.length) {
    filters.push({ businessTypeId: { in: rules.businessTypeIds } });
  }
  if (rules.pipelineStageIds.length) {
    filters.push({ pipelineStageId: { in: rules.pipelineStageIds } });
  }
  if (rules.productIds?.length) {
    filters.push({
      products: { some: { productId: { in: rules.productIds } } },
    });
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

/** The client filter for one segment: its business types or its picks, minus its exclusions. */
export function clientSegmentWhere(
  rules: ClientRules,
): Prisma.MarketingClientWhereInput {
  const filters: Prisma.MarketingClientWhereInput[] = [];
  if (rules.businessTypeIds.length) {
    filters.push({ businessTypeId: { in: rules.businessTypeIds } });
  }
  if (rules.productIds?.length) {
    // A product the client turned down is not one they have.
    filters.push({
      products: {
        some: {
          productId: { in: rules.productIds },
          status: { not: 'UNINTERESTED' },
        },
      },
    });
  }
  const matches: Prisma.MarketingClientWhereInput[] = [];
  if (filters.length) matches.push({ AND: filters });
  if (rules.includeClientIds.length) {
    matches.push({ id: { in: rules.includeClientIds } });
  }
  return {
    AND: [
      { OR: matches },
      ...(rules.excludeClientIds.length
        ? [{ id: { notIn: rules.excludeClientIds } }]
        : []),
    ],
  };
}

const hasRules = (type: RecipientType, rules: Rules) =>
  type === 'CLIENT'
    ? rules.businessTypeIds.length > 0 ||
      rules.productIds.length > 0 ||
      rules.includeClientIds.length > 0
    : rules.businessTypeIds.length > 0 ||
      rules.productIds.length > 0 ||
      rules.pipelineStageIds.length > 0 ||
      rules.includeProspectIds.length > 0;

/** A segment holds prospects or clients, never both, so the rules of the other kind must be empty. */
function assertRulesMatchType(type: RecipientType, rules: Rules) {
  if (type === 'CLIENT') {
    if (
      rules.pipelineStageIds.length ||
      rules.includeProspectIds.length ||
      rules.excludeProspectIds.length
    ) {
      throw new BadRequestException(CLIENT_ONLY_MESSAGE);
    }
  } else if (rules.includeClientIds.length || rules.excludeClientIds.length) {
    throw new BadRequestException(PROSPECT_ONLY_MESSAGE);
  }
}

type SegmentRow = Prisma.MarketingCampaignSegmentGetPayload<object>;

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
      saved.map((segment) => this.countMembers(user.tenantId, segment)),
    );

    return [
      ...saved.map((segment, index) => ({
        ...this.toResponse(segment),
        ...savedCounts[index],
      })),
      ...businessTypes.map((type) => ({
        id: `${BUILT_IN_PREFIX}${type.id}`,
        name: type.name,
        builtIn: true,
        recipientType: 'PROSPECT' as const,
        businessTypeIds: [type.id],
        productIds: [],
        pipelineStageIds: [],
        includeProspectIds: [],
        excludeProspectIds: [],
        includeClientIds: [],
        excludeClientIds: [],
        prospectCount: countByType.get(type.id) ?? 0,
        clientCount: 0,
      })),
    ];
  }

  /** How many people some rules would match, without saving anything. */
  async count(user: RequestUser, dto: SegmentRulesDto) {
    const type = dto.recipientType ?? 'PROSPECT';
    const rules = rulesOf(dto);
    assertRulesMatchType(type, rules);
    if (!hasRules(type, rules)) return { prospectCount: 0, clientCount: 0 };
    return this.countMembers(user.tenantId, { recipientType: type, ...rules });
  }

  async create(user: RequestUser, dto: CreateSegmentDto) {
    const type = dto.recipientType ?? 'PROSPECT';
    const rules = rulesOf(dto);
    assertRulesMatchType(type, rules);
    if (!hasRules(type, rules))
      throw new BadRequestException(EMPTY_RULES_MESSAGE);
    await this.assertValidFilters(user.tenantId, rules);
    try {
      const segment = await this.prisma.marketingCampaignSegment.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          normalizedName: normalize(dto.name),
          recipientType: type,
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
    if (dto.recipientType && dto.recipientType !== existing.recipientType) {
      throw new BadRequestException(TYPE_LOCKED_MESSAGE);
    }
    const rules: Rules = {
      businessTypeIds: dto.businessTypeIds ?? existing.businessTypeIds,
      productIds: dto.productIds ?? existing.productIds,
      pipelineStageIds: dto.pipelineStageIds ?? existing.pipelineStageIds,
      includeProspectIds: dto.includeProspectIds ?? existing.includeProspectIds,
      excludeProspectIds: dto.excludeProspectIds ?? existing.excludeProspectIds,
      includeClientIds: dto.includeClientIds ?? existing.includeClientIds,
      excludeClientIds: dto.excludeClientIds ?? existing.excludeClientIds,
    };
    assertRulesMatchType(existing.recipientType, rules);
    if (!hasRules(existing.recipientType, rules)) {
      throw new BadRequestException(EMPTY_RULES_MESSAGE);
    }
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
   * and one client filter, each matching anyone in any of the segments of that kind. A filter
   * is null when no segment of that kind was chosen. Anything unknown is rejected.
   */
  async resolve(tenantId: string, ids: string[]): Promise<ResolvedSegments> {
    const builtInTypeIds = ids
      .filter((id) => id.startsWith(BUILT_IN_PREFIX))
      .map((id) => id.slice(BUILT_IN_PREFIX.length));
    const savedIds = ids.filter((id) => !id.startsWith(BUILT_IN_PREFIX));

    const saved: SegmentRow[] = savedIds.length
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
    const prospectWheres: Prisma.MarketingProspectWhereInput[] = [];
    const clientWheres: Prisma.MarketingClientWhereInput[] = [];
    const typeIds = new Set<string>();
    for (const id of ids) {
      if (id.startsWith(BUILT_IN_PREFIX)) {
        const type = typeById.get(id.slice(BUILT_IN_PREFIX.length));
        if (!type) throw new BadRequestException(UNKNOWN_SEGMENT_MESSAGE);
        segments.push({ id, name: type.name });
        prospectWheres.push(
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
        if (segment.recipientType === 'CLIENT') {
          clientWheres.push(clientSegmentWhere(segment));
        } else {
          prospectWheres.push(segmentWhere(segment));
        }
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
      prospectWhere: prospectWheres.length
        ? { tenantId, OR: prospectWheres }
        : null,
      clientWhere: clientWheres.length ? { tenantId, OR: clientWheres } : null,
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

  /** Business types, products and stages named in a segment must belong to this tenant. */
  private async assertValidFilters(tenantId: string, rules: Rules) {
    const countOptions = (
      ids: string[],
      category: MarketingCrmSettingCategory,
    ) =>
      ids.length
        ? this.prisma.marketingCrmSettingOption.count({
            where: { tenantId, id: { in: ids }, category },
          })
        : Promise.resolve(0);
    const [types, products, stages] = await Promise.all([
      countOptions(
        rules.businessTypeIds,
        MarketingCrmSettingCategory.PROSPECT_BUSINESS_TYPE,
      ),
      countOptions(rules.productIds, MarketingCrmSettingCategory.PRODUCT),
      rules.pipelineStageIds.length
        ? this.prisma.marketingPipelineStage.count({
            where: { tenantId, id: { in: rules.pipelineStageIds } },
          })
        : Promise.resolve(0),
    ]);
    if (
      types !== rules.businessTypeIds.length ||
      products !== rules.productIds.length ||
      stages !== rules.pipelineStageIds.length
    ) {
      throw new BadRequestException(
        'One or more selected business types, products or sales stages were not found',
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

  /** How many prospects or clients a segment's rules match, under the count of its own kind. */
  private async countMembers(
    tenantId: string,
    segment: Rules & { recipientType: RecipientType },
  ) {
    if (segment.recipientType === 'CLIENT') {
      const clientCount = await this.prisma.marketingClient.count({
        where: { tenantId, ...clientSegmentWhere(segment) },
      });
      return { prospectCount: 0, clientCount };
    }
    const prospectCount = await this.prisma.marketingProspect.count({
      where: { tenantId, ...segmentWhere(segment) },
    });
    return { prospectCount, clientCount: 0 };
  }

  private async withCount(tenantId: string, segment: SegmentRow) {
    return {
      ...this.toResponse(segment),
      ...(await this.countMembers(tenantId, segment)),
    };
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

  private toResponse(segment: SegmentRow) {
    return {
      id: segment.id,
      name: segment.name,
      builtIn: false,
      recipientType: segment.recipientType,
      businessTypeIds: segment.businessTypeIds,
      productIds: segment.productIds,
      pipelineStageIds: segment.pipelineStageIds,
      includeProspectIds: segment.includeProspectIds,
      excludeProspectIds: segment.excludeProspectIds,
      includeClientIds: segment.includeClientIds,
      excludeClientIds: segment.excludeClientIds,
    };
  }
}
