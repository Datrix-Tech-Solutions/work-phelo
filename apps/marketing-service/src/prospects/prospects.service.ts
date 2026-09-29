import {
  BadRequestException,
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
  CreateProspectDto,
  CreateProspectProductDto,
} from './dto/create-prospect.dto';
import { QueryProspectsDto } from './dto/query-prospects.dto';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';

const INVALID_REFERENCE_MESSAGE = 'Invalid prospect reference';
const DUPLICATE_PRODUCT_MESSAGE =
  'A product or service can only be added once per prospect';
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type SettingReference = {
  id: string | undefined;
  category: MarketingCrmSettingCategory;
};

@Injectable()
export class ProspectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(user: RequestUser, id: string) {
    const prospect = await this.prisma.marketingProspect.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...this.visibilityWhere(user, this.canViewAllProspects(user)),
      },
      include: {
        contacts: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        },
        products: {
          orderBy: [
            { expectedCloseDate: 'asc' },
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        },
        interactions: {
          orderBy: [
            { occurredAt: 'desc' },
            { createdAt: 'desc' },
            { id: 'asc' },
          ],
        },
      },
    });

    if (!prospect) throw new NotFoundException('Prospect not found');

    const [stage, settings] = await Promise.all([
      this.prisma.marketingPipelineStage.findFirst({
        where: {
          id: prospect.pipelineStageId,
          tenantId: user.tenantId,
        },
        select: {
          id: true,
          name: true,
          probability: true,
          displayOrder: true,
        },
      }),
      this.findSettingsByIds(user.tenantId, [
        prospect.businessTypeId,
        prospect.sourceTypeId,
        ...prospect.contacts.map((contact) => contact.decisionMakerTypeId),
        ...prospect.products.map((product) => product.productId),
        ...prospect.interactions.map(
          (interaction) => interaction.interactionMediumId,
        ),
      ]),
    ]);

    const settingsById = new Map(
      settings.map((setting) => [setting.id, setting]),
    );

    return {
      id: prospect.id,
      companyName: prospect.companyName,
      businessType: prospect.businessTypeId
        ? this.namedReference(
            prospect.businessTypeId,
            settingsById,
            'Unknown business type',
          )
        : null,
      sourceType: prospect.sourceTypeId
        ? this.namedReference(
            prospect.sourceTypeId,
            settingsById,
            'Unknown source type',
          )
        : null,
      assignedUserId: prospect.assignedUserId,
      location: {
        label: prospect.locationLabel,
        latitude: prospect.latitude.toString(),
        longitude: prospect.longitude.toString(),
      },
      salesStage: {
        id: prospect.pipelineStageId,
        name: stage?.name ?? 'Unknown stage',
        probability: stage?.probability ?? 0,
        displayOrder: stage?.displayOrder ?? 0,
      },
      progress: stage?.probability ?? 0,
      contacts: prospect.contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        isPrimary: contact.isPrimary,
        decisionMaker: contact.decisionMakerTypeId
          ? this.namedReference(
              contact.decisionMakerTypeId,
              settingsById,
              'Unknown decision maker',
            )
          : null,
      })),
      products: prospect.products.map((product) => ({
        id: product.id,
        product: this.namedReference(
          product.productId,
          settingsById,
          'Unknown product',
        ),
        expectedValue: this.decimalToFixed(product.expectedValue),
        achievedValue: this.decimalToFixed(product.achievedValue),
        commissionRate: this.decimalToString(product.commissionRate),
        commissionAmount: this.decimalToFixed(product.commissionAmount),
        expectedCloseDate: product.expectedCloseDate,
      })),
      totalExpectedValue: this.sumDecimal(
        prospect.products.map((product) => product.expectedValue),
      ),
      totalAchievedValue: this.sumDecimal(
        prospect.products.map((product) => product.achievedValue),
      ),
      interactions: prospect.interactions.map((interaction) => ({
        id: interaction.id,
        occurredAt: interaction.occurredAt,
        interactionMedium: interaction.interactionMediumId
          ? this.namedReference(
              interaction.interactionMediumId,
              settingsById,
              'Unknown interaction medium',
            )
          : null,
        notes: interaction.notes,
        createdByUserId: interaction.createdByUserId,
        createdAt: interaction.createdAt,
      })),
      createdAt: prospect.createdAt,
      updatedAt: prospect.updatedAt,
    };
  }

  async list(user: RequestUser, query: QueryProspectsDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const canViewAll = this.canViewAllProspects(user);
    const where = this.buildListWhere(user, query, canViewAll);

    const [total, prospects] = await this.prisma.$transaction([
      this.prisma.marketingProspect.count({ where }),
      this.prisma.marketingProspect.findMany({
        where,
        select: {
          id: true,
          companyName: true,
          pipelineStageId: true,
          assignedUserId: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { companyName: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    if (prospects.length === 0) {
      return {
        data: [],
        meta: this.pageMeta(page, limit, total),
      };
    }

    const prospectIds = prospects.map((prospect) => prospect.id);
    const [products, primaryContacts, latestInteractions, stages] =
      await Promise.all([
        this.prisma.marketingProspectProduct.findMany({
          where: { tenantId: user.tenantId, prospectId: { in: prospectIds } },
          orderBy: [
            { expectedCloseDate: 'asc' },
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        }),
        this.prisma.marketingProspectContact.findMany({
          where: {
            tenantId: user.tenantId,
            prospectId: { in: prospectIds },
            isPrimary: true,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
        this.prisma.marketingProspectInteraction.groupBy({
          by: ['prospectId'],
          where: { tenantId: user.tenantId, prospectId: { in: prospectIds } },
          _max: { occurredAt: true },
        }),
        this.prisma.marketingPipelineStage.findMany({
          where: {
            tenantId: user.tenantId,
            id: { in: [...new Set(prospects.map((p) => p.pipelineStageId))] },
          },
          select: { id: true, name: true, probability: true },
        }),
      ]);

    const settingIds = [
      ...products.map((product) => product.productId),
      ...primaryContacts
        .map((contact) => contact.decisionMakerTypeId)
        .filter((id): id is string => Boolean(id)),
    ];
    const settings =
      settingIds.length > 0
        ? await this.prisma.marketingCrmSettingOption.findMany({
            where: {
              tenantId: user.tenantId,
              id: { in: [...new Set(settingIds)] },
            },
            select: { id: true, name: true },
          })
        : [];

    const settingsById = new Map(
      settings.map((setting) => [setting.id, setting]),
    );
    const stagesById = new Map(stages.map((stage) => [stage.id, stage]));
    const productsByProspect = this.groupByProspect(products);
    const contactsByProspect = new Map(
      primaryContacts.map((contact) => [contact.prospectId, contact]),
    );
    const interactionByProspect = new Map(
      latestInteractions.map((interaction) => [
        interaction.prospectId,
        interaction._max.occurredAt,
      ]),
    );

    const data = prospects.map((prospect) => {
      const prospectProducts = productsByProspect.get(prospect.id) ?? [];
      const primaryContact = contactsByProspect.get(prospect.id);
      const stage = stagesById.get(prospect.pipelineStageId);

      return {
        id: prospect.id,
        companyName: prospect.companyName,
        expectedValue: this.sumDecimal(
          prospectProducts.map((product) => product.expectedValue),
        ),
        achievedValue: this.sumDecimal(
          prospectProducts.map((product) => product.achievedValue),
        ),
        products: prospectProducts.map((product) => ({
          id: product.productId,
          name: settingsById.get(product.productId)?.name ?? 'Unknown product',
        })),
        primaryContact: primaryContact
          ? {
              name: primaryContact.name,
              phone: primaryContact.phone,
              decisionMaker: primaryContact.decisionMakerTypeId
                ? this.settingReference(
                    primaryContact.decisionMakerTypeId,
                    settingsById,
                  )
                : null,
            }
          : null,
        salesStage: {
          id: prospect.pipelineStageId,
          name: stage?.name ?? 'Unknown stage',
          probability: stage?.probability ?? 0,
        },
        progress: stage?.probability ?? 0,
        lastInteractionDate: interactionByProspect.get(prospect.id) ?? null,
        expectedCloseDate: this.earliestDate(
          prospectProducts.map((product) => product.expectedCloseDate),
        ),
        assignedUserId: prospect.assignedUserId,
        createdAt: prospect.createdAt,
      };
    });

    return {
      data,
      meta: this.pageMeta(page, limit, total),
    };
  }

  async create(user: RequestUser, dto: CreateProspectDto) {
    this.assertUniqueProducts(dto.products);
    await this.assertReferences(user.tenantId, dto);

    return this.prisma.$transaction((tx) => {
      return tx.marketingProspect.create({
        data: {
          tenantId: user.tenantId,
          companyName: this.formatText(dto.companyName),
          normalizedCompanyName: this.normalizeText(dto.companyName),
          businessTypeId: dto.businessTypeId ?? null,
          sourceTypeId: dto.sourceTypeId ?? null,
          pipelineStageId: dto.pipelineStageId,
          assignedUserId: user.id,
          locationLabel: this.formatText(dto.location.label),
          latitude: dto.location.latitude,
          longitude: dto.location.longitude,
          createdByUserId: user.id,
          updatedByUserId: user.id,
          contacts: {
            create: {
              tenantId: user.tenantId,
              name: this.formatText(dto.primaryContact.name),
              phone: this.formatOptionalText(dto.primaryContact.phone),
              email: this.formatOptionalText(dto.primaryContact.email),
              decisionMakerTypeId:
                dto.primaryContact.decisionMakerTypeId ?? null,
              isPrimary: true,
            },
          },
          products: {
            create: dto.products.map((product) =>
              this.toProductCreateInput(user.tenantId, product),
            ),
          },
          ...(dto.initialInteraction
            ? {
                interactions: {
                  create: {
                    tenantId: user.tenantId,
                    interactionMediumId:
                      dto.initialInteraction.interactionMediumId ?? null,
                    occurredAt: new Date(dto.initialInteraction.occurredAt),
                    notes: this.formatOptionalText(
                      dto.initialInteraction.notes,
                    ),
                    createdByUserId: user.id,
                  },
                },
              }
            : {}),
        },
        include: {
          contacts: true,
          products: true,
          interactions: true,
        },
      });
    });
  }

  private async assertReferences(tenantId: string, dto: CreateProspectDto) {
    await Promise.all([
      this.assertActivePipelineStage(tenantId, dto.pipelineStageId),
      ...this.settingReferences(dto).map((reference) =>
        this.assertActiveSetting(tenantId, reference),
      ),
    ]);
  }

  private settingReferences(dto: CreateProspectDto): SettingReference[] {
    return [
      {
        id: dto.businessTypeId,
        category: MarketingCrmSettingCategory.PROSPECT_BUSINESS_TYPE,
      },
      {
        id: dto.sourceTypeId,
        category: MarketingCrmSettingCategory.SOURCE_TYPE,
      },
      {
        id: dto.primaryContact.decisionMakerTypeId,
        category: MarketingCrmSettingCategory.DECISION_MAKER,
      },
      {
        id: dto.initialInteraction?.interactionMediumId,
        category: MarketingCrmSettingCategory.INTERACTION_MEDIUM,
      },
      ...dto.products.map((product) => ({
        id: product.productId,
        category: MarketingCrmSettingCategory.PRODUCT,
      })),
    ];
  }

  private async assertActiveSetting(
    tenantId: string,
    reference: SettingReference,
  ) {
    if (!reference.id) return;

    const setting = await this.prisma.marketingCrmSettingOption.findFirst({
      where: {
        id: reference.id,
        tenantId,
        category: reference.category,
        archivedAt: null,
        isActive: true,
      },
      select: { id: true },
    });

    if (!setting) throw new BadRequestException(INVALID_REFERENCE_MESSAGE);
  }

  private async assertActivePipelineStage(tenantId: string, id: string) {
    const stage = await this.prisma.marketingPipelineStage.findFirst({
      where: {
        id,
        tenantId,
        archivedAt: null,
        isActive: true,
      },
      select: { id: true },
    });

    if (!stage) throw new BadRequestException(INVALID_REFERENCE_MESSAGE);
  }

  private assertUniqueProducts(products: CreateProspectProductDto[]) {
    const seen = new Set<string>();
    for (const product of products) {
      if (seen.has(product.productId)) {
        throw new BadRequestException(DUPLICATE_PRODUCT_MESSAGE);
      }
      seen.add(product.productId);
    }
  }

  private toProductCreateInput(
    tenantId: string,
    product: CreateProspectProductDto,
  ): Prisma.MarketingProspectProductCreateWithoutProspectInput {
    return {
      tenantId,
      productId: product.productId,
      expectedValue: product.expectedValue,
      achievedValue: product.achievedValue ?? null,
      commissionRate: product.commissionRate ?? null,
      commissionAmount: product.commissionAmount ?? null,
      expectedCloseDate: product.expectedCloseDate
        ? new Date(product.expectedCloseDate)
        : null,
    };
  }

  private formatText(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeText(value: string): string {
    return this.formatText(value).toLocaleLowerCase();
  }

  private formatOptionalText(value: string | undefined): string | null {
    if (value === undefined) return null;
    const normalized = this.formatText(value);
    return normalized.length > 0 ? normalized : null;
  }

  private canViewAllProspects(user: RequestUser): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') {
      return true;
    }

    return user.permissions.includes(
      MarketingCrmSettingsPermission.PROSPECTS_VIEW_ALL,
    );
  }

  private buildListWhere(
    user: RequestUser,
    query: QueryProspectsDto,
    canViewAll: boolean,
  ): Prisma.MarketingProspectWhereInput {
    return {
      tenantId: user.tenantId,
      ...this.visibilityWhere(user, canViewAll, query.assignedUserId),
      ...(query.search
        ? {
            normalizedCompanyName: {
              contains: this.normalizeText(query.search),
            },
          }
        : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom
                ? { gte: this.parseDateBound(query.createdFrom, 'from') }
                : {}),
              ...(query.createdTo
                ? { lte: this.parseDateBound(query.createdTo, 'to') }
                : {}),
            },
          }
        : {}),
    };
  }

  private visibilityWhere(
    user: RequestUser,
    canViewAll: boolean,
    assignedUserId?: string,
  ): Prisma.MarketingProspectWhereInput {
    if (!canViewAll) return { assignedUserId: user.id };
    return assignedUserId ? { assignedUserId } : {};
  }

  private parseDateBound(value: string, bound: 'from' | 'to'): Date {
    if (DATE_ONLY_PATTERN.test(value)) {
      return new Date(
        bound === 'from' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`,
      );
    }

    return new Date(value);
  }

  private groupByProspect<
    T extends {
      prospectId: string;
    },
  >(items: T[]): Map<string, T[]> {
    const grouped = new Map<string, T[]>();
    for (const item of items) {
      const existing = grouped.get(item.prospectId) ?? [];
      existing.push(item);
      grouped.set(item.prospectId, existing);
    }
    return grouped;
  }

  private sumDecimal(
    values: Array<Prisma.Decimal | number | string | null>,
  ): string {
    let total = new Prisma.Decimal(0);
    for (const value of values) {
      if (value !== null) {
        total = total.plus(value);
      }
    }

    return total.toFixed(2);
  }

  private earliestDate(values: Array<Date | null>): Date | null {
    const dates = values.filter((value): value is Date => Boolean(value));
    if (dates.length === 0) return null;
    return dates.reduce((earliest, current) =>
      current.getTime() < earliest.getTime() ? current : earliest,
    );
  }

  private settingReference(
    id: string,
    settingsById: Map<string, { id: string; name: string }>,
  ) {
    return this.namedReference(id, settingsById, 'Unknown decision maker');
  }

  private pageMeta(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private async findSettingsByIds(tenantId: string, ids: Array<string | null>) {
    const uniqueIds = [
      ...new Set(ids.filter((id): id is string => Boolean(id))),
    ];
    if (uniqueIds.length === 0) return [];

    return this.prisma.marketingCrmSettingOption.findMany({
      where: {
        tenantId,
        id: { in: uniqueIds },
      },
      select: { id: true, name: true },
    });
  }

  private namedReference(
    id: string,
    settingsById: Map<string, { id: string; name: string }>,
    fallbackName: string,
  ) {
    const setting = settingsById.get(id);
    if (!setting) return { id, name: fallbackName };
    return { id: setting.id, name: setting.name };
  }

  private decimalToString(value: Prisma.Decimal | null): string | null {
    return value === null ? null : value.toString();
  }

  private decimalToFixed(value: Prisma.Decimal | null): string | null {
    return value === null ? null : value.toFixed(2);
  }
}
