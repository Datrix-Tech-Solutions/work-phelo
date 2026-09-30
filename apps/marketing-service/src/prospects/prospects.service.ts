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
import {
  CreateProspectInteractionDto,
  ProspectInteractionParticipantDto,
} from './dto/create-prospect-interaction.dto';
import { QueryProspectsDto } from './dto/query-prospects.dto';
import {
  UpdateProspectDto,
  UpdateProspectProductDto,
} from './dto/update-prospect.dto';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';

const INVALID_REFERENCE_MESSAGE = 'Invalid prospect reference';
const DUPLICATE_PRODUCT_MESSAGE =
  'A product or service can only be added once per prospect';
const EMPTY_PATCH_MESSAGE = 'At least one field is required';
const INVALID_PRODUCT_REFERENCE_MESSAGE = 'Invalid prospect product reference';
const REQUIRED_PRODUCT_FIELDS_MESSAGE =
  'New prospect products require productId and expectedValue';
const EMPTY_PRODUCTS_MESSAGE = 'A prospect must have at least one product';
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type SettingReference = {
  id: string | undefined;
  category: MarketingCrmSettingCategory;
};

type ProspectInteractionWithParticipants = {
  id: string;
  interactionMediumId: string | null;
  occurredAt: Date;
  notes: string | null;
  decisionMakerInvolved: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  participants: Array<{
    id: string;
    fullName: string;
    phone: string;
    role: string;
    createdAt: Date;
  }>;
};

@Injectable()
export class ProspectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(user: RequestUser, id: string) {
    return this.findProspectDetail(user, id, this.canViewAllProspects(user));
  }

  private async findProspectDetail(
    user: RequestUser,
    id: string,
    canViewAll: boolean,
  ) {
    const prospect = await this.prisma.marketingProspect.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...this.visibilityWhere(user, canViewAll),
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
          include: {
            participants: {
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            },
          },
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
      interactions: prospect.interactions.map((interaction) =>
        this.toInteractionResponse(interaction, settingsById),
      ),
      createdAt: prospect.createdAt,
      updatedAt: prospect.updatedAt,
    };
  }

  async update(user: RequestUser, id: string, dto: UpdateProspectDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(EMPTY_PATCH_MESSAGE);
    }

    const canEditAll = this.canEditAllProspects(user);
    const existing = await this.prisma.marketingProspect.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...this.visibilityWhere(user, canEditAll),
      },
      include: {
        contacts: true,
        products: true,
      },
    });

    if (!existing) throw new NotFoundException('Prospect not found');

    await this.assertUpdateReferences(user.tenantId, dto, existing);

    await this.prisma.$transaction(async (tx) => {
      await tx.marketingProspect.update({
        where: { id: existing.id },
        data: this.toProspectUpdateData(user, dto),
      });

      if (dto.primaryContact !== undefined) {
        await this.updatePrimaryContact(tx, existing, dto);
      }

      if (dto.products !== undefined) {
        await this.updateProducts(tx, user, existing, dto.products);
      }
    });

    return this.findProspectDetail(user, id, canEditAll);
  }

  async remove(user: RequestUser, id: string): Promise<void> {
    const canDeleteAll = this.canDeleteAllProspects(user);
    const existing = await this.prisma.marketingProspect.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...this.visibilityWhere(user, canDeleteAll),
      },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Prospect not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.marketingProspect.delete({
        where: { id: existing.id },
      });
    });
  }

  async createInteraction(
    user: RequestUser,
    prospectId: string,
    dto: CreateProspectInteractionDto,
  ) {
    const canCreateAll = this.canCreateAllInteractions(user);
    await this.assertProspectAccessible(user, prospectId, canCreateAll);
    await this.assertActiveSetting(user.tenantId, {
      id: dto.interactionMediumId,
      category: MarketingCrmSettingCategory.INTERACTION_MEDIUM,
    });

    const interaction = await this.prisma.$transaction((tx) => {
      return tx.marketingProspectInteraction.create({
        data: {
          tenantId: user.tenantId,
          prospectId,
          interactionMediumId: dto.interactionMediumId,
          occurredAt: new Date(dto.occurredAt),
          notes: this.formatOptionalText(dto.notes),
          decisionMakerInvolved: dto.decisionMakerInvolved,
          createdByUserId: user.id,
          ...(dto.participants && dto.participants.length > 0
            ? {
                participants: {
                  create: dto.participants.map((participant) =>
                    this.toInteractionParticipantCreateInput(
                      user.tenantId,
                      participant,
                    ),
                  ),
                },
              }
            : {}),
        },
        include: {
          participants: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
    });

    const settings = await this.findSettingsByIds(user.tenantId, [
      interaction.interactionMediumId,
    ]);
    const settingsById = new Map(
      settings.map((setting) => [setting.id, setting]),
    );

    return this.toInteractionResponse(interaction, settingsById);
  }

  async listInteractions(user: RequestUser, prospectId: string) {
    const canViewAll = this.canViewAllInteractions(user);
    await this.assertProspectAccessible(user, prospectId, canViewAll);

    const interactions =
      await this.prisma.marketingProspectInteraction.findMany({
        where: {
          tenantId: user.tenantId,
          prospectId,
        },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        include: {
          participants: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      });

    const settings = await this.findSettingsByIds(
      user.tenantId,
      interactions.map((interaction) => interaction.interactionMediumId),
    );
    const settingsById = new Map(
      settings.map((setting) => [setting.id, setting]),
    );

    return {
      items: interactions.map((interaction) =>
        this.toInteractionResponse(interaction, settingsById),
      ),
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
                    decisionMakerInvolved:
                      dto.initialInteraction.decisionMakerInvolved ?? false,
                    createdByUserId: user.id,
                    ...(dto.initialInteraction.participants &&
                    dto.initialInteraction.participants.length > 0
                      ? {
                          participants: {
                            create: dto.initialInteraction.participants.map(
                              (participant) =>
                                this.toInteractionParticipantCreateInput(
                                  user.tenantId,
                                  participant,
                                ),
                            ),
                          },
                        }
                      : {}),
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

  private formatRequiredText(value: string, message: string): string {
    const formatted = this.formatText(value);
    if (formatted.length === 0) throw new BadRequestException(message);
    return formatted;
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

  private canEditAllProspects(user: RequestUser): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') {
      return true;
    }

    return user.permissions.includes(
      MarketingCrmSettingsPermission.PROSPECTS_EDIT_ALL,
    );
  }

  private canDeleteAllProspects(user: RequestUser): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') {
      return true;
    }

    return user.permissions.includes(
      MarketingCrmSettingsPermission.PROSPECTS_DELETE_ALL,
    );
  }

  private canViewAllInteractions(user: RequestUser): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') {
      return true;
    }

    return user.permissions.includes(
      MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_VIEW_ALL,
    );
  }

  private canCreateAllInteractions(user: RequestUser): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') {
      return true;
    }

    return user.permissions.includes(
      MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_CREATE_ALL,
    );
  }

  private async assertProspectAccessible(
    user: RequestUser,
    prospectId: string,
    canAccessAll: boolean,
  ) {
    const prospect = await this.prisma.marketingProspect.findFirst({
      where: {
        id: prospectId,
        tenantId: user.tenantId,
        ...this.visibilityWhere(user, canAccessAll),
      },
      select: { id: true },
    });

    if (!prospect) throw new NotFoundException('Prospect not found');
    return prospect;
  }

  private async assertUpdateReferences(
    tenantId: string,
    dto: UpdateProspectDto,
    existing: {
      businessTypeId: string | null;
      sourceTypeId: string | null;
      pipelineStageId: string;
      products: Array<{ id: string; productId: string }>;
      contacts: Array<{
        id: string;
        isPrimary: boolean;
        decisionMakerTypeId: string | null;
      }>;
    },
  ) {
    const checks: Array<Promise<void>> = [];

    if (
      dto.pipelineStageId !== undefined &&
      dto.pipelineStageId !== existing.pipelineStageId
    ) {
      checks.push(
        this.assertActivePipelineStage(tenantId, dto.pipelineStageId),
      );
    }

    if (
      dto.businessTypeId !== undefined &&
      dto.businessTypeId !== null &&
      dto.businessTypeId !== existing.businessTypeId
    ) {
      checks.push(
        this.assertActiveSetting(tenantId, {
          id: dto.businessTypeId,
          category: MarketingCrmSettingCategory.PROSPECT_BUSINESS_TYPE,
        }),
      );
    }

    if (
      dto.sourceTypeId !== undefined &&
      dto.sourceTypeId !== null &&
      dto.sourceTypeId !== existing.sourceTypeId
    ) {
      checks.push(
        this.assertActiveSetting(tenantId, {
          id: dto.sourceTypeId,
          category: MarketingCrmSettingCategory.SOURCE_TYPE,
        }),
      );
    }

    const existingPrimaryContact = existing.contacts.find(
      (contact) => contact.isPrimary,
    );
    if (
      dto.primaryContact?.decisionMakerTypeId !== undefined &&
      dto.primaryContact.decisionMakerTypeId !== null &&
      dto.primaryContact.decisionMakerTypeId !==
        existingPrimaryContact?.decisionMakerTypeId
    ) {
      checks.push(
        this.assertActiveSetting(tenantId, {
          id: dto.primaryContact.decisionMakerTypeId,
          category: MarketingCrmSettingCategory.DECISION_MAKER,
        }),
      );
    }

    if (dto.products !== undefined) {
      this.assertUpdateProducts(dto.products, existing.products);
      const productsById = new Map(
        existing.products.map((product) => [product.id, product]),
      );

      for (const product of dto.products) {
        const existingProduct = product.id
          ? productsById.get(product.id)
          : undefined;
        if (
          product.productId !== undefined &&
          product.productId !== existingProduct?.productId
        ) {
          checks.push(
            this.assertActiveSetting(tenantId, {
              id: product.productId,
              category: MarketingCrmSettingCategory.PRODUCT,
            }),
          );
        }
      }
    }

    await Promise.all(checks);
  }

  private assertUpdateProducts(
    products: UpdateProspectProductDto[],
    existingProducts: Array<{ id: string; productId: string }>,
  ) {
    if (products.length === 0) {
      throw new BadRequestException(EMPTY_PRODUCTS_MESSAGE);
    }

    const existingById = new Map(
      existingProducts.map((product) => [product.id, product]),
    );
    const seenProductIds = new Set<string>();

    for (const product of products) {
      const existing = product.id ? existingById.get(product.id) : undefined;
      if (product.id && !existing) {
        throw new BadRequestException(INVALID_PRODUCT_REFERENCE_MESSAGE);
      }

      if (
        !product.id &&
        (!product.productId || product.expectedValue === undefined)
      ) {
        throw new BadRequestException(REQUIRED_PRODUCT_FIELDS_MESSAGE);
      }

      const effectiveProductId = product.productId ?? existing?.productId;
      if (!effectiveProductId) {
        throw new BadRequestException(INVALID_PRODUCT_REFERENCE_MESSAGE);
      }
      if (seenProductIds.has(effectiveProductId)) {
        throw new BadRequestException(DUPLICATE_PRODUCT_MESSAGE);
      }
      seenProductIds.add(effectiveProductId);
    }
  }

  private toProspectUpdateData(
    user: RequestUser,
    dto: UpdateProspectDto,
  ): Prisma.MarketingProspectUpdateInput {
    return {
      ...(dto.companyName !== undefined
        ? {
            companyName: this.formatRequiredText(
              dto.companyName,
              'Company name is required',
            ),
            normalizedCompanyName: this.normalizeText(dto.companyName),
          }
        : {}),
      ...(dto.businessTypeId !== undefined
        ? { businessTypeId: dto.businessTypeId }
        : {}),
      ...(dto.sourceTypeId !== undefined
        ? { sourceTypeId: dto.sourceTypeId }
        : {}),
      ...(dto.pipelineStageId !== undefined
        ? { pipelineStageId: dto.pipelineStageId }
        : {}),
      ...(dto.location?.label !== undefined
        ? {
            locationLabel: this.formatRequiredText(
              dto.location.label,
              'Location label is required',
            ),
          }
        : {}),
      ...(dto.location?.latitude !== undefined
        ? { latitude: dto.location.latitude }
        : {}),
      ...(dto.location?.longitude !== undefined
        ? { longitude: dto.location.longitude }
        : {}),
      updatedByUserId: user.id,
    };
  }

  private async updatePrimaryContact(
    tx: Prisma.TransactionClient,
    existing: {
      id: string;
      tenantId: string;
      contacts: Array<{ id: string; isPrimary: boolean; name: string }>;
    },
    dto: UpdateProspectDto,
  ) {
    const contact = dto.primaryContact;
    if (!contact) return;

    const primaryContact = existing.contacts.find((item) => item.isPrimary);
    if (!primaryContact && contact.name === undefined) {
      throw new BadRequestException('Primary contact name is required');
    }

    const data = {
      ...(contact.name !== undefined
        ? {
            name: this.formatRequiredText(
              contact.name,
              'Primary contact name is required',
            ),
          }
        : {}),
      ...(contact.phone !== undefined
        ? { phone: this.formatOptionalText(contact.phone) }
        : {}),
      ...(contact.email !== undefined
        ? { email: this.formatOptionalText(contact.email) }
        : {}),
      ...(contact.decisionMakerTypeId !== undefined
        ? { decisionMakerTypeId: contact.decisionMakerTypeId }
        : {}),
    };

    if (primaryContact) {
      await tx.marketingProspectContact.update({
        where: { id: primaryContact.id },
        data,
      });
      return;
    }

    await tx.marketingProspectContact.create({
      data: {
        tenantId: existing.tenantId,
        prospectId: existing.id,
        name: this.formatRequiredText(
          contact.name ?? '',
          'Primary contact name is required',
        ),
        phone:
          contact.phone !== undefined
            ? this.formatOptionalText(contact.phone)
            : null,
        email:
          contact.email !== undefined
            ? this.formatOptionalText(contact.email)
            : null,
        decisionMakerTypeId: contact.decisionMakerTypeId ?? null,
        isPrimary: true,
      },
    });
  }

  private async updateProducts(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    existing: {
      id: string;
      tenantId: string;
      products: Array<{ id: string; productId: string }>;
    },
    products: UpdateProspectProductDto[],
  ) {
    const submittedExistingIds = products
      .map((product) => product.id)
      .filter((id): id is string => Boolean(id));

    await tx.marketingProspectProduct.deleteMany({
      where: {
        tenantId: user.tenantId,
        prospectId: existing.id,
        ...(submittedExistingIds.length > 0
          ? { id: { notIn: submittedExistingIds } }
          : {}),
      },
    });

    for (const product of products) {
      if (product.id) {
        await tx.marketingProspectProduct.update({
          where: { id: product.id },
          data: this.toProductUpdateData(product),
        });
      } else {
        await tx.marketingProspectProduct.create({
          data: {
            tenantId: existing.tenantId,
            prospectId: existing.id,
            productId: product.productId,
            expectedValue: product.expectedValue,
            achievedValue: product.achievedValue ?? null,
            commissionRate: product.commissionRate ?? null,
            commissionAmount: product.commissionAmount ?? null,
            expectedCloseDate: product.expectedCloseDate
              ? new Date(product.expectedCloseDate)
              : null,
          },
        });
      }
    }
  }

  private toProductUpdateData(
    product: UpdateProspectProductDto,
  ): Prisma.MarketingProspectProductUpdateInput {
    return {
      ...(product.productId !== undefined
        ? { productId: product.productId }
        : {}),
      ...(product.expectedValue !== undefined
        ? { expectedValue: product.expectedValue }
        : {}),
      ...(product.achievedValue !== undefined
        ? { achievedValue: product.achievedValue }
        : {}),
      ...(product.commissionRate !== undefined
        ? { commissionRate: product.commissionRate }
        : {}),
      ...(product.commissionAmount !== undefined
        ? { commissionAmount: product.commissionAmount }
        : {}),
      ...(product.expectedCloseDate !== undefined
        ? {
            expectedCloseDate: product.expectedCloseDate
              ? new Date(product.expectedCloseDate)
              : null,
          }
        : {}),
    };
  }

  private toInteractionParticipantCreateInput(
    tenantId: string,
    participant: ProspectInteractionParticipantDto,
  ): Prisma.MarketingProspectInteractionParticipantCreateWithoutInteractionInput {
    return {
      tenantId,
      fullName: this.formatRequiredText(
        participant.fullName,
        'Participant full name is required',
      ),
      phone: this.formatRequiredText(
        participant.phone,
        'Participant phone is required',
      ),
      role: this.formatRequiredText(
        participant.role,
        'Participant role is required',
      ),
    };
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

  private toInteractionResponse(
    interaction: ProspectInteractionWithParticipants,
    settingsById: Map<string, { id: string; name: string }>,
  ) {
    return {
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
      decisionMakerInvolved: interaction.decisionMakerInvolved,
      participants: interaction.participants.map((participant) => ({
        id: participant.id,
        fullName: participant.fullName,
        phone: participant.phone,
        role: participant.role,
        createdAt: participant.createdAt,
      })),
      createdByUserId: interaction.createdByUserId,
      createdAt: interaction.createdAt,
    };
  }

  private decimalToString(value: Prisma.Decimal | null): string | null {
    return value === null ? null : value.toString();
  }

  private decimalToFixed(value: Prisma.Decimal | null): string | null {
    return value === null ? null : value.toFixed(2);
  }
}
