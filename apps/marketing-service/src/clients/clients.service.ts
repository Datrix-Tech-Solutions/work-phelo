import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingClientProductStatus,
  MarketingCrmSettingCategory,
  Prisma,
} from '../../prisma/generated/client';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { AssigneesService } from '../assignees/assignees.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientBillingService } from './client-billing.service';
import { ClientBillingDto } from './dto/billing.dto';
import {
  AddClientProductDto,
  ConvertProspectToClientDto,
  CreateClientDto,
} from './dto/create-client.dto';
import { CreateProspectInteractionDto } from '../prospects/dto/create-prospect-interaction.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const INVALID_REFERENCE_MESSAGE = 'Invalid client reference';
const DUPLICATE_PRODUCT_MESSAGE =
  'A product or service can only be listed once per client';
const PRODUCT_EXISTS_MESSAGE =
  'This client already has that product or service';
const EMPTY_PATCH_MESSAGE = 'At least one field is required';
const FOLLOW_UP_COMPLETION_MESSAGE =
  'Completing a scheduled follow-up is not supported for clients yet';
const ALREADY_CONVERTED_MESSAGE = 'This prospect has already been converted';
const NOT_CONVERTIBLE_MESSAGE =
  'Only prospects at 100% progress can be converted to a client';
const CONTACT_NAME_REQUIRED_MESSAGE = 'A contact name is required';
const BILLING_REQUIRED_MESSAGE =
  'A billable client needs its first billing transaction.';
const BILLING_WITHOUT_BILLABLE_MESSAGE =
  'Billing details can only be sent for a billable client.';
const INVALID_BILLING_PRODUCT_MESSAGE =
  'The billing product must be one of the client’s products.';
const BILLABLE_ON_MESSAGE =
  'Billing is switched on by raising the client’s first billing transaction.';
const HAS_BILLING_MESSAGE =
  'This client has billing in Accounting and cannot be deleted.';

type SettingReference = {
  id: string | null | undefined;
  category: MarketingCrmSettingCategory;
};

type NamedSettings = Map<string, { id: string; name: string }>;

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: ClientBillingService,
    private readonly assignees: AssigneesService,
  ) {}

  async list(user: RequestUser, query: QueryClientsDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const canViewAll = this.hasPermission(
      user,
      MarketingCrmSettingsPermission.CLIENTS_VIEW_ALL,
    );

    const where: Prisma.MarketingClientWhereInput = {
      tenantId: user.tenantId,
      ...this.visibilityWhere(user, canViewAll, query.assignedUserId),
      ...(query.search
        ? {
            normalizedCompanyName: {
              contains: this.normalizeText(query.search),
            },
          }
        : {}),
    };

    const [total, clients] = await this.prisma.$transaction([
      this.prisma.marketingClient.count({ where }),
      this.prisma.marketingClient.findMany({
        where,
        include: {
          contacts: {
            where: { isPrimary: true },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: 1,
          },
          products: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        },
        orderBy: [{ createdAt: 'desc' }, { companyName: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const achieved = await this.billing.totalsForEntities(
      user,
      clients
        .map((client) => client.accountingEntityId)
        .filter((id): id is string => Boolean(id)),
    );

    const settings = await this.findSettingsByIds(user.tenantId, [
      ...clients.map((client) => client.businessTypeId),
      ...clients.flatMap((client) =>
        client.contacts.map((contact) => contact.decisionMakerTypeId),
      ),
      ...clients.flatMap((client) =>
        client.products.map((product) => product.productId),
      ),
    ]);

    const assigneeNames = await this.assignees.namesFor(
      user.tenantId,
      clients.map((client) => client.assignedUserId),
    );

    return {
      data: clients.map((client) => {
        const primary = client.contacts[0];
        return {
          id: client.id,
          companyName: client.companyName,
          businessType: client.businessTypeId
            ? this.namedReference(
                client.businessTypeId,
                settings,
                'Unknown business type',
              )
            : null,
          locationLabel: client.locationLabel,
          isBillable: client.isBillable,
          hasAccountingEntity: Boolean(client.accountingEntityId),
          achievedRevenue: client.accountingEntityId
            ? (achieved.get(client.accountingEntityId) ?? null)
            : null,
          primaryContact: primary
            ? {
                name: primary.name,
                phone: primary.phone,
                email: primary.email,
                decisionMaker: primary.decisionMakerTypeId
                  ? this.namedReference(
                      primary.decisionMakerTypeId,
                      settings,
                      'Unknown decision maker',
                    )
                  : null,
              }
            : null,
          products: client.products.map((product) => ({
            id: product.productId,
            name: this.namedReference(
              product.productId,
              settings,
              'Unknown product',
            ).name,
            status: product.status,
          })),
          assignedUserId: client.assignedUserId,
          assignedUserName: assigneeNames.get(client.assignedUserId) ?? null,
          convertedFromProspectId: client.convertedFromProspectId,
          createdAt: client.createdAt,
        };
      }),
      meta: this.pageMeta(page, limit, total),
    };
  }

  async findOne(user: RequestUser, id: string) {
    return this.findClientDetail(
      user,
      id,
      this.hasPermission(user, MarketingCrmSettingsPermission.CLIENTS_VIEW_ALL),
    );
  }

  async create(user: RequestUser, dto: CreateClientDto) {
    const clientId = dto.id ?? randomUUID();
    if (dto.id) {
      // A retry of a create that already went through: hand back what exists.
      const existing = await this.prisma.marketingClient.findFirst({
        where: { id: dto.id, tenantId: user.tenantId },
        select: { id: true },
      });
      if (existing) return this.findClientDetail(user, existing.id, true);
    }

    const productIds = dto.productIds ?? [];
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException(DUPLICATE_PRODUCT_MESSAGE);
    }
    const assignedUserId = await this.assignees.forCreate(
      user,
      'client',
      dto.assignedUserId,
    );

    await this.assertReferences(user.tenantId, [
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
      ...productIds.map((id) => ({
        id,
        category: MarketingCrmSettingCategory.PRODUCT,
      })),
    ]);

    // Accounting first: if it cannot take the transaction, no client is created. If saving the
    // client then fails, a retry with the same client id finds the same entity and draft.
    const firstBilling = await this.sendFirstBilling(user, {
      isBillable: dto.isBillable,
      billing: dto.billing,
      productIds,
      clientId,
      clientName: this.formatText(dto.companyName),
      assignedUserId,
    });

    const client = await this.prisma.marketingClient.create({
      data: {
        id: clientId,
        tenantId: user.tenantId,
        companyName: this.formatText(dto.companyName),
        normalizedCompanyName: this.normalizeText(dto.companyName),
        businessTypeId: dto.businessTypeId ?? null,
        sourceTypeId: dto.sourceTypeId ?? null,
        assignedUserId,
        locationLabel: this.formatText(dto.location.label),
        latitude: dto.location.latitude,
        longitude: dto.location.longitude,
        isBillable: Boolean(firstBilling),
        accountingEntityId: firstBilling?.created.entityId ?? null,
        accountingEntityTypeId: firstBilling?.created.entityTypeId ?? null,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        contacts: {
          create: {
            tenantId: user.tenantId,
            name: this.formatText(dto.primaryContact.name),
            phone: this.formatOptionalText(dto.primaryContact.phone),
            email: this.formatOptionalText(dto.primaryContact.email),
            decisionMakerTypeId: dto.primaryContact.decisionMakerTypeId ?? null,
            isPrimary: true,
          },
        },
        products: {
          create: productIds.map((productId) => ({
            tenantId: user.tenantId,
            productId,
          })),
        },
      },
      select: { id: true },
    });

    if (firstBilling) {
      await this.prisma.$transaction((tx) =>
        this.billing.record(tx, user, {
          clientId: client.id,
          productId: firstBilling.billing.productId,
          transactionId: firstBilling.created.transactionId,
          state: firstBilling.created.state,
          amount: firstBilling.billing.amount,
          idempotencyKey: firstBilling.idempotencyKey,
        }),
      );
    }

    return this.findClientDetail(user, client.id, true);
  }

  async update(user: RequestUser, id: string, dto: UpdateClientDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(EMPTY_PATCH_MESSAGE);
    }
    if (dto.isBillable === true) {
      throw new BadRequestException(BILLABLE_ON_MESSAGE);
    }

    const canEditAll = this.hasPermission(
      user,
      MarketingCrmSettingsPermission.CLIENTS_EDIT_ALL,
    );
    const existing = await this.prisma.marketingClient.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...this.visibilityWhere(user, canEditAll),
      },
      include: {
        contacts: {
          where: { isPrimary: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 1,
        },
      },
    });
    if (!existing) throw new NotFoundException('Client not found');

    await this.assertReferences(user.tenantId, [
      {
        id: dto.businessTypeId,
        category: MarketingCrmSettingCategory.PROSPECT_BUSINESS_TYPE,
      },
      {
        id: dto.sourceTypeId,
        category: MarketingCrmSettingCategory.SOURCE_TYPE,
      },
      {
        id: dto.primaryContact?.decisionMakerTypeId,
        category: MarketingCrmSettingCategory.DECISION_MAKER,
      },
    ]);

    const primary = existing.contacts[0];
    if (dto.primaryContact && !primary && !dto.primaryContact.name?.trim()) {
      throw new BadRequestException(CONTACT_NAME_REQUIRED_MESSAGE);
    }

    const newAssignee = await this.assignees.forUpdate(
      user,
      'client',
      existing.assignedUserId,
      dto.assignedUserId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.marketingClient.update({
        where: { id: existing.id },
        data: {
          updatedByUserId: user.id,
          ...(newAssignee ? { assignedUserId: newAssignee } : {}),
          ...(dto.companyName !== undefined
            ? {
                companyName: this.formatRequiredText(
                  dto.companyName,
                  'Company name cannot be empty',
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
          ...(dto.isBillable !== undefined
            ? { isBillable: dto.isBillable }
            : {}),
          ...(dto.location?.label !== undefined
            ? {
                locationLabel: this.formatRequiredText(
                  dto.location.label,
                  'Location cannot be empty',
                ),
              }
            : {}),
          ...(dto.location?.latitude !== undefined
            ? { latitude: dto.location.latitude }
            : {}),
          ...(dto.location?.longitude !== undefined
            ? { longitude: dto.location.longitude }
            : {}),
        },
      });

      if (dto.primaryContact) {
        const contact = dto.primaryContact;
        if (primary) {
          await tx.marketingClientContact.update({
            where: { id: primary.id },
            data: {
              ...(contact.name !== undefined
                ? {
                    name: this.formatRequiredText(
                      contact.name,
                      CONTACT_NAME_REQUIRED_MESSAGE,
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
            },
          });
        } else {
          await tx.marketingClientContact.create({
            data: {
              tenantId: user.tenantId,
              clientId: existing.id,
              name: this.formatRequiredText(
                contact.name ?? '',
                CONTACT_NAME_REQUIRED_MESSAGE,
              ),
              phone: this.formatOptionalText(contact.phone),
              email: this.formatOptionalText(contact.email),
              decisionMakerTypeId: contact.decisionMakerTypeId ?? null,
              isPrimary: true,
            },
          });
        }
      }
    });

    // Someone who just handed a record on can still see the result of their edit.
    return this.findClientDetail(user, id, canEditAll || !!newAssignee);
  }

  async remove(user: RequestUser, id: string): Promise<void> {
    const canDeleteAll = this.hasPermission(
      user,
      MarketingCrmSettingsPermission.CLIENTS_DELETE_ALL,
    );
    const existing = await this.prisma.marketingClient.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...this.visibilityWhere(user, canDeleteAll),
      },
      select: { id: true, accountingEntityId: true },
    });
    if (!existing) throw new NotFoundException('Client not found');
    // Accounting keeps its postings, so a client that has been billed stays.
    if (existing.accountingEntityId) {
      throw new ConflictException(HAS_BILLING_MESSAGE);
    }

    await this.prisma.$transaction(async (tx) => {
      // Rows that also belong to the originating prospect keep their prospect link (the FK
      // nulls clientId); rows made only for the client have nowhere to go and are removed.
      await tx.marketingProspectInteraction.deleteMany({
        where: { clientId: existing.id, prospectId: null },
      });
      await tx.marketingProspectFollowUp.deleteMany({
        where: { clientId: existing.id, prospectId: null },
      });
      await tx.marketingClient.delete({ where: { id: existing.id } });
    });
  }

  async addProduct(user: RequestUser, id: string, dto: AddClientProductDto) {
    const canEditAll = this.hasPermission(
      user,
      MarketingCrmSettingsPermission.CLIENTS_EDIT_ALL,
    );
    const client = await this.prisma.marketingClient.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...this.visibilityWhere(user, canEditAll),
      },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    await this.assertReferences(user.tenantId, [
      { id: dto.productId, category: MarketingCrmSettingCategory.PRODUCT },
    ]);

    try {
      const product = await this.prisma.marketingClientProduct.create({
        data: {
          tenantId: user.tenantId,
          clientId: client.id,
          productId: dto.productId,
          expectedValue: dto.expectedValue ?? null,
          commissionRate: dto.commissionRate ?? null,
          commissionAmount:
            dto.expectedValue !== undefined && dto.commissionRate !== undefined
              ? new Prisma.Decimal(dto.expectedValue)
                  .mul(dto.commissionRate)
                  .div(100)
                  .toDecimalPlaces(2)
              : null,
        },
      });
      const settings = await this.findSettingsByIds(user.tenantId, [
        product.productId,
      ]);
      return {
        id: product.id,
        product: this.namedReference(
          product.productId,
          settings,
          'Unknown product',
        ),
        status: product.status,
        ...this.productTerms(product),
        createdAt: product.createdAt,
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(PRODUCT_EXISTS_MESSAGE);
      }
      throw error;
    }
  }

  async createInteraction(
    user: RequestUser,
    id: string,
    dto: CreateProspectInteractionDto,
  ) {
    if (dto.followUpId) {
      throw new BadRequestException(FOLLOW_UP_COMPLETION_MESSAGE);
    }

    const canCreateAll = this.hasPermission(
      user,
      MarketingCrmSettingsPermission.PROSPECT_INTERACTIONS_CREATE_ALL,
    );
    const client = await this.prisma.marketingClient.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...this.visibilityWhere(user, canCreateAll),
      },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    await this.assertReferences(user.tenantId, [
      {
        id: dto.interactionMediumId,
        category: MarketingCrmSettingCategory.INTERACTION_MEDIUM,
      },
    ]);

    const interaction = await this.prisma.marketingProspectInteraction.create({
      data: {
        tenantId: user.tenantId,
        clientId: client.id,
        interactionMediumId: dto.interactionMediumId,
        occurredAt: new Date(dto.occurredAt),
        notes: this.formatOptionalText(dto.notes),
        decisionMakerInvolved: dto.decisionMakerInvolved,
        createdByUserId: user.id,
        ...(dto.participants && dto.participants.length > 0
          ? {
              participants: {
                create: dto.participants.map((participant) => ({
                  tenantId: user.tenantId,
                  fullName: this.formatText(participant.fullName),
                  phone: this.formatText(participant.phone),
                  role: this.formatText(participant.role),
                })),
              },
            }
          : {}),
      },
      include: {
        participants: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });

    const settings = await this.findSettingsByIds(user.tenantId, [
      interaction.interactionMediumId,
    ]);
    return this.toInteractionResponse(interaction, settings);
  }

  async convertProspect(
    user: RequestUser,
    prospectId: string,
    dto: ConvertProspectToClientDto,
  ) {
    const canEditAll = this.hasPermission(
      user,
      MarketingCrmSettingsPermission.PROSPECTS_EDIT_ALL,
    );
    const prospect = await this.prisma.marketingProspect.findFirst({
      where: {
        id: prospectId,
        tenantId: user.tenantId,
        ...(canEditAll ? {} : { assignedUserId: user.id }),
      },
      include: {
        contacts: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        products: true,
        client: { select: { id: true } },
      },
    });
    if (!prospect) throw new NotFoundException('Prospect not found');
    if (prospect.client) {
      // A retry of a conversion that already went through gets the same client back.
      if (dto.clientId && prospect.client.id === dto.clientId) {
        return this.findClientDetail(user, prospect.client.id, true);
      }
      throw new ConflictException(ALREADY_CONVERTED_MESSAGE);
    }

    const stage = await this.prisma.marketingPipelineStage.findFirst({
      where: { id: prospect.pipelineStageId, tenantId: user.tenantId },
      select: { probability: true },
    });
    if (!stage || stage.probability < 100) {
      throw new BadRequestException(NOT_CONVERTIBLE_MESSAGE);
    }

    const clientId = dto.clientId ?? randomUUID();
    const firstBilling = await this.sendFirstBilling(user, {
      isBillable: dto.isBillable,
      billing: dto.billing,
      productIds: prospect.products.map((p) => p.productId),
      clientId,
      clientName: prospect.companyName,
      assignedUserId: prospect.assignedUserId,
    });

    try {
      const client = await this.prisma.$transaction(async (tx) => {
        const created = await tx.marketingClient.create({
          data: {
            id: clientId,
            tenantId: user.tenantId,
            companyName: prospect.companyName,
            normalizedCompanyName: prospect.normalizedCompanyName,
            businessTypeId: prospect.businessTypeId,
            sourceTypeId: prospect.sourceTypeId,
            assignedUserId: prospect.assignedUserId,
            locationLabel: prospect.locationLabel,
            latitude: prospect.latitude,
            longitude: prospect.longitude,
            isBillable: Boolean(firstBilling),
            accountingEntityId: firstBilling?.created.entityId ?? null,
            accountingEntityTypeId: firstBilling?.created.entityTypeId ?? null,
            convertedFromProspectId: prospect.id,
            convertedAt: new Date(),
            convertedByUserId: user.id,
            createdByUserId: user.id,
            updatedByUserId: user.id,
            contacts: {
              create: prospect.contacts.map((contact) => ({
                tenantId: user.tenantId,
                name: contact.name,
                phone: contact.phone,
                email: contact.email,
                decisionMakerTypeId: contact.decisionMakerTypeId,
                isPrimary: contact.isPrimary,
              })),
            },
            products: {
              create: [
                ...new Map(
                  prospect.products.map((p) => [p.productId, p] as const),
                ).values(),
              ].map((product) => ({
                tenantId: user.tenantId,
                productId: product.productId,
                status: MarketingClientProductStatus.PENDING,
                // Achieved revenue is not carried over — it comes from the sales module.
                expectedValue: product.expectedValue,
                commissionRate: product.commissionRate,
                commissionAmount: this.expectedCommission(product),
              })),
            },
          },
          select: { id: true },
        });

        // History follows the relationship: the prospect keeps its rows, the client shares them.
        await tx.marketingProspectInteraction.updateMany({
          where: { tenantId: user.tenantId, prospectId: prospect.id },
          data: { clientId: created.id },
        });
        await tx.marketingProspectFollowUp.updateMany({
          where: { tenantId: user.tenantId, prospectId: prospect.id },
          data: { clientId: created.id },
        });

        if (firstBilling) {
          await this.billing.record(tx, user, {
            clientId: created.id,
            productId: firstBilling.billing.productId,
            transactionId: firstBilling.created.transactionId,
            state: firstBilling.created.state,
            amount: firstBilling.billing.amount,
            idempotencyKey: firstBilling.idempotencyKey,
          });
        }

        return created;
      });

      return this.findClientDetail(user, client.id, true);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(ALREADY_CONVERTED_MESSAGE);
      }
      throw error;
    }
  }

  /**
   * Billable clients are created together with their first billing transaction. This sends it to
   * Accounting (which creates the entity and the draft) before anything is saved here.
   */
  private async sendFirstBilling(
    user: RequestUser,
    input: {
      isBillable: boolean | undefined;
      billing: ClientBillingDto | undefined;
      productIds: string[];
      clientId: string;
      clientName: string;
      /** Who the new client belongs to - they can bill it without the billing permission. */
      assignedUserId: string;
    },
  ) {
    if (!input.isBillable) {
      if (input.billing) {
        throw new BadRequestException(BILLING_WITHOUT_BILLABLE_MESSAGE);
      }
      return null;
    }
    if (!input.billing) throw new BadRequestException(BILLING_REQUIRED_MESSAGE);
    this.billing.assertCanBill(user, input.assignedUserId);
    if (
      input.billing.productId &&
      !input.productIds.includes(input.billing.productId)
    ) {
      throw new BadRequestException(INVALID_BILLING_PRODUCT_MESSAGE);
    }

    const idempotencyKey = `client-create:${input.clientId}`;
    const created = await this.billing.submit(user, {
      tenantId: user.tenantId,
      clientId: input.clientId,
      clientName: input.clientName,
      entityId: null,
      entityTypeId: input.billing.entityTypeId,
      transactionTypeId: input.billing.transactionTypeId,
      amount: input.billing.amount,
      description: input.billing.description,
      productId: input.billing.productId,
      idempotencyKey,
      assignedUserId: input.assignedUserId,
    });
    return { created, idempotencyKey, billing: input.billing };
  }

  private async findClientDetail(
    user: RequestUser,
    id: string,
    canViewAll: boolean,
  ) {
    const client = await this.prisma.marketingClient.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...this.visibilityWhere(user, canViewAll),
      },
      include: {
        contacts: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
        },
        products: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        interactions: {
          orderBy: [
            { occurredAt: 'desc' },
            { createdAt: 'desc' },
            { id: 'asc' },
          ],
          include: {
            participants: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
          },
        },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    const assignedUserName = await this.assignees.nameFor(
      user.tenantId,
      client.assignedUserId,
    );

    const settings = await this.findSettingsByIds(user.tenantId, [
      client.businessTypeId,
      client.sourceTypeId,
      ...client.contacts.map((contact) => contact.decisionMakerTypeId),
      ...client.products.map((product) => product.productId),
      ...client.interactions.map(
        (interaction) => interaction.interactionMediumId,
      ),
    ]);

    return {
      id: client.id,
      companyName: client.companyName,
      businessType: client.businessTypeId
        ? this.namedReference(
            client.businessTypeId,
            settings,
            'Unknown business type',
          )
        : null,
      sourceType: client.sourceTypeId
        ? this.namedReference(
            client.sourceTypeId,
            settings,
            'Unknown source type',
          )
        : null,
      assignedUserId: client.assignedUserId,
      assignedUserName,
      isBillable: client.isBillable,
      hasAccountingEntity: Boolean(client.accountingEntityId),
      accountingEntityTypeId: client.accountingEntityTypeId,
      location: {
        label: client.locationLabel,
        latitude: client.latitude.toString(),
        longitude: client.longitude.toString(),
      },
      contacts: client.contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        isPrimary: contact.isPrimary,
        decisionMaker: contact.decisionMakerTypeId
          ? this.namedReference(
              contact.decisionMakerTypeId,
              settings,
              'Unknown decision maker',
            )
          : null,
      })),
      products: client.products.map((product) => ({
        id: product.id,
        product: this.namedReference(
          product.productId,
          settings,
          'Unknown product',
        ),
        status: product.status,
        ...this.productTerms(product),
        createdAt: product.createdAt,
      })),
      interactions: client.interactions.map((interaction) =>
        this.toInteractionResponse(interaction, settings),
      ),
      convertedFromProspectId: client.convertedFromProspectId,
      convertedAt: client.convertedAt,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  /**
   * Commission carried over at conversion: the rate's share of the expected value. With no rate
   * there is nothing to derive from, so a stored amount is kept as it was.
   */
  private expectedCommission(product: {
    expectedValue: Prisma.Decimal;
    commissionRate: Prisma.Decimal | null;
    commissionAmount: Prisma.Decimal | null;
  }): Prisma.Decimal | null {
    if (product.commissionRate === null) return product.commissionAmount;
    return product.expectedValue
      .mul(product.commissionRate)
      .div(100)
      .toDecimalPlaces(2);
  }

  private productTerms(product: {
    expectedValue: Prisma.Decimal | null;
    commissionRate: Prisma.Decimal | null;
    commissionAmount: Prisma.Decimal | null;
  }) {
    return {
      expectedValue: product.expectedValue?.toFixed(2) ?? null,
      commissionRate: product.commissionRate?.toString() ?? null,
      commissionAmount: product.commissionAmount?.toFixed(2) ?? null,
    };
  }

  private toInteractionResponse(
    interaction: {
      id: string;
      occurredAt: Date;
      interactionMediumId: string | null;
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
    },
    settings: NamedSettings,
  ) {
    return {
      id: interaction.id,
      occurredAt: interaction.occurredAt,
      interactionMedium: interaction.interactionMediumId
        ? this.namedReference(
            interaction.interactionMediumId,
            settings,
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

  private async assertReferences(
    tenantId: string,
    references: SettingReference[],
  ) {
    await Promise.all(
      references.map(async (reference) => {
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
      }),
    );
  }

  private async findSettingsByIds(
    tenantId: string,
    ids: Array<string | null | undefined>,
  ): Promise<NamedSettings> {
    const uniqueIds = [
      ...new Set(ids.filter((id): id is string => Boolean(id))),
    ];
    if (uniqueIds.length === 0) return new Map();

    const settings = await this.prisma.marketingCrmSettingOption.findMany({
      where: { tenantId, id: { in: uniqueIds } },
      select: { id: true, name: true },
    });
    return new Map(settings.map((setting) => [setting.id, setting]));
  }

  private namedReference(
    id: string,
    settings: NamedSettings,
    fallbackName: string,
  ) {
    const setting = settings.get(id);
    return { id, name: setting?.name ?? fallbackName };
  }

  private hasPermission(user: RequestUser, permission: string): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') {
      return true;
    }
    return user.permissions.includes(permission);
  }

  private visibilityWhere(
    user: RequestUser,
    canViewAll: boolean,
    assignedUserId?: string,
  ): Prisma.MarketingClientWhereInput {
    if (!canViewAll) return { assignedUserId: user.id };
    return assignedUserId ? { assignedUserId } : {};
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

  private pageMeta(page: number, limit: number, total: number) {
    return {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
