import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementParticipantRole,
  PlacementParticipantStatus,
  PlacementStatus,
  PlacementType,
  Prisma,
  RiskTypeFieldSection,
  RiskTypeFieldType,
} from '../../prisma/generated/client';
import { PlacementEventPublisher } from '../messaging/placement-event.publisher';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlacementParticipantDto } from './dto/create-placement-participant.dto';
import { CreatePlacementDto } from './dto/create-placement.dto';
import { PlacementLockStatusDto } from './dto/placement-lock-status.dto';
import { QueryPlacementsDto } from './dto/query-placements.dto';
import { UpdatePlacementParticipantStatusDto } from './dto/update-placement-participant-status.dto';
import { UpdatePlacementParticipantDto } from './dto/update-placement-participant.dto';
import { UpdatePlacementStatusDto } from './dto/update-placement-status.dto';
import { UpdatePlacementDto } from './dto/update-placement.dto';
import { PlacementFinancialLockPolicy } from './placement-financial-lock.policy';

const placementInclude = {
  cedant: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
  participants: {
    include: {
      counterparty: {
        select: {
          id: true,
          type: true,
          name: true,
          registrationNumber: true,
        },
      },
    },
    orderBy: [{ role: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  statusHistory: {
    orderBy: { createdAt: 'desc' as const },
    take: 20,
  },
} satisfies Prisma.PlacementInclude;

const participantAcceptanceInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
} satisfies Prisma.PlacementParticipantInclude;

const participantAcceptanceClosingInclude = {
  participant: {
    include: participantAcceptanceInclude,
  },
} satisfies Prisma.PlacementClosingInclude;

const slipPreviewInclude = {
  cedant: {
    include: {
      contacts: {
        orderBy: [
          { isPrimary: 'desc' as const },
          { createdAt: 'asc' as const },
        ],
      },
      addresses: {
        orderBy: [
          { isPrimary: 'desc' as const },
          { createdAt: 'asc' as const },
        ],
      },
    },
  },
  participants: {
    include: {
      counterparty: {
        include: {
          contacts: {
            orderBy: [
              { isPrimary: 'desc' as const },
              { createdAt: 'asc' as const },
            ],
          },
          addresses: {
            orderBy: [
              { isPrimary: 'desc' as const },
              { createdAt: 'asc' as const },
            ],
          },
        },
      },
    },
    orderBy: [{ role: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  statusHistory: {
    orderBy: { createdAt: 'desc' as const },
    take: 20,
  },
} satisfies Prisma.PlacementInclude;

type PlacementRecord = Prisma.PlacementGetPayload<{
  include: typeof placementInclude;
}>;

type SlipPreviewPlacementRecord = Prisma.PlacementGetPayload<{
  include: typeof slipPreviewInclude;
}>;

type PlacementWithAggregates = PlacementRecord & {
  totalOfferedPercent: number;
  totalAcceptedPercent: number;
  remainingPercent: number;
  lockStatus?: PlacementLockStatusDto;
};

type PlacementParticipantRecord = PlacementRecord['participants'][number];

type PlacementParticipantAcceptanceRecord =
  Prisma.PlacementParticipantGetPayload<{
    include: typeof participantAcceptanceInclude;
  }>;

type PlacementParticipantAcceptanceClosingRecord =
  Prisma.PlacementClosingGetPayload<{
    include: typeof participantAcceptanceClosingInclude;
  }>;

type PlacementParticipantAcceptanceResult = {
  participant: PlacementParticipantAcceptanceRecord;
  closing: PlacementParticipantAcceptanceClosingRecord;
};

type ParticipantCapacityInput = {
  counterpartyId: string;
  role: PlacementParticipantRole;
  status?: PlacementParticipantStatus;
  sharePercent?: number | Prisma.Decimal | null;
  signedLinePercent?: number | Prisma.Decimal | null;
  brokerageFee?: number | Prisma.Decimal | null;
  notes?: string | null;
};

type CounterpartySummary = {
  id: string;
  type: CounterpartyType;
  name: string;
};

@Injectable()
export class PlacementsService {
  private readonly logger = new Logger(PlacementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: PlacementEventPublisher,
    private readonly financialLockPolicy: PlacementFinancialLockPolicy,
  ) {}

  async findAll(tenantId: string, query: QueryPlacementsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.PlacementWhereInput = {
      tenantId,
      archivedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.placementType ? { placementType: query.placementType } : {}),
      ...(query.cedantId ? { cedantId: query.cedantId } : {}),
      ...(query.riskTypeId ? { riskTypeId: query.riskTypeId } : {}),
      ...(query.classOfBusiness
        ? {
            classOfBusiness: {
              contains: query.classOfBusiness,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
              {
                classOfBusiness: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                cedant: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.placement.findMany({
        where,
        include: placementInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.placement.count({ where }),
    ]);

    return {
      items: items.map((item) => this.withAggregates(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    tenantId: string,
    id: string,
  ): Promise<PlacementWithAggregates> {
    const placement = await this.prisma.placement.findFirst({
      where: { id, tenantId, archivedAt: null },
      include: placementInclude,
    });

    if (!placement) {
      throw new NotFoundException('Placement not found');
    }

    return this.withLockStatus(
      this.withAggregates(placement),
      await this.financialLockPolicy.evaluate(placement),
    );
  }

  async getLockStatus(tenantId: string, id: string) {
    const placement = await this.prisma.placement.findFirst({
      where: { id, tenantId, archivedAt: null },
      select: { id: true, tenantId: true, status: true },
    });

    if (!placement) {
      throw new NotFoundException('Placement not found');
    }

    return this.financialLockPolicy.evaluate(placement);
  }

  async getOfferSlipPreview(tenantId: string, id: string) {
    const placement = await this.findSlipPreviewPlacement(tenantId, id);
    const aggregates = this.calculateAggregates(placement);
    const reinsurerParticipants = placement.participants.filter((participant) =>
      this.isReinsurerParticipant(participant.role),
    );

    return {
      placement: this.slipPlacementSummary(placement),
      cedant: this.slipCounterparty(placement.cedant),
      businessEntries: this.detailEntries(placement.businessDetails),
      offerEntries: this.detailEntries(placement.offerDetails),
      debitGuaranteeFinancials:
        this.calculateDebitGuaranteeFinancials(placement),
      participantPreviews: reinsurerParticipants.map((participant) => ({
        participant: this.slipParticipant(participant),
        slipFinancials: this.calculateSlipFinancials(
          placement,
          this.decimalToNumber(participant.brokerageFee),
        ),
        distributionFinancials: this.calculateDistributionFinancials(
          placement,
          participant,
        ),
      })),
      totalOfferedPercent: aggregates.totalOfferedPercent,
      totalAcceptedPercent: aggregates.totalAcceptedPercent,
      remainingPercent: aggregates.remainingPercent,
    };
  }

  async getClosingSlipPreview(
    tenantId: string,
    id: string,
    participantId: string,
  ) {
    const placement = await this.findSlipPreviewPlacement(tenantId, id);
    const participant = placement.participants.find(
      (item) => item.id === participantId,
    );
    if (!participant) {
      throw new NotFoundException('Placement participant not found');
    }
    if (
      participant.status !== PlacementParticipantStatus.ACCEPTED &&
      participant.status !== PlacementParticipantStatus.CLOSED
    ) {
      throw new BadRequestException(
        'Closing slip preview requires an accepted or closed participant',
      );
    }
    if (this.decimalToNumber(participant.signedLinePercent) <= 0) {
      throw new BadRequestException(
        'Closing slip preview requires a signed line percentage',
      );
    }

    const brokerageFee = this.decimalToNumber(participant.brokerageFee);

    return {
      placement: this.slipPlacementSummary(placement),
      cedant: this.slipCounterparty(placement.cedant),
      participant: this.slipParticipant(participant),
      businessEntries: this.detailEntries(placement.businessDetails),
      offerEntries: this.detailEntries(placement.offerDetails),
      slipFinancials: this.calculateSlipFinancials(placement, brokerageFee),
      closingRow: this.calculateClosingRow(placement, participant),
      creditNoteFinancials: this.calculateCreditNoteFinancials(
        placement,
        participant,
      ),
      debitGuaranteeFinancials:
        this.calculateDebitGuaranteeFinancials(placement),
    };
  }

  async create(
    user: RequestUser,
    dto: CreatePlacementDto,
  ): Promise<PlacementWithAggregates> {
    this.validateDates(dto.inceptionDate, dto.expiryDate);
    await this.assertCedant(user.tenantId, dto.cedantId);
    await this.assertParticipants(user.tenantId, dto.participants ?? []);
    this.assertAcceptedCap(dto.participants ?? [], dto.facultativeOffer);

    // Resolve riskTypeId and derive classOfBusiness from RiskType.name
    let resolvedRiskTypeId: string | null = null;
    let resolvedClassOfBusiness = this.cleanOptional(dto.classOfBusiness);

    if (dto.riskTypeId) {
      const rt = await this.prisma.riskType.findFirst({
        where: {
          id: dto.riskTypeId,
          tenantId: user.tenantId,
          archivedAt: null,
        },
        select: { id: true, name: true },
      });
      if (!rt) throw new NotFoundException('Risk type not found');
      resolvedRiskTypeId = rt.id;
      resolvedClassOfBusiness = rt.name;
    }

    await this.validateDynamicFields(
      user.tenantId,
      resolvedRiskTypeId,
      dto.businessDetails,
      dto.offerDetails,
    );

    const cleanCurrency =
      this.cleanOptional(dto.currency)?.toUpperCase() ?? null;
    const exchangeRateToBase = await this.resolveExchangeRate(
      user.tenantId,
      cleanCurrency,
    );

    const data: Prisma.PlacementUncheckedCreateInput = {
      tenantId: user.tenantId,
      reference: this.cleanRequired(dto.reference),
      normalizedReference: this.normalizeReference(dto.reference),
      title: this.cleanRequired(dto.title),
      placementType: dto.placementType ?? PlacementType.FACULTATIVE,
      status: PlacementStatus.DRAFT,
      cedantId: dto.cedantId,
      riskTypeId: resolvedRiskTypeId,
      classOfBusiness: resolvedClassOfBusiness,
      businessDetails:
        this.normalizeJsonObject(dto.businessDetails, 'businessDetails') ??
        Prisma.JsonNull,
      offerDetails:
        this.normalizeJsonObject(dto.offerDetails, 'offerDetails') ??
        Prisma.JsonNull,
      description: this.cleanOptional(dto.description),
      inceptionDate: this.toDate(dto.inceptionDate),
      expiryDate: this.toDate(dto.expiryDate),
      currency: cleanCurrency,
      exchangeRateToBase: exchangeRateToBase ?? undefined,
      sumInsured: dto.sumInsured,
      rate: dto.rate,
      premium: dto.premium,
      commission: dto.commission,
      facultativeOffer: dto.facultativeOffer,
      preliminaryBrokerage: dto.preliminaryBrokerage,
      createdByUserId: user.id,
      updatedByUserId: user.id,
      participants: this.participantsCreateInput(dto.participants),
      statusHistory: {
        create: {
          toStatus: PlacementStatus.DRAFT,
          changedByUserId: user.id,
          note: 'Placement created',
        },
      },
    };

    try {
      const placement = await this.prisma.placement.create({
        data,
        include: placementInclude,
      });
      this.publish('created', placement, user, {
        after: this.auditSnapshot(placement),
      });
      return this.withAggregates(placement);
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdatePlacementDto,
  ): Promise<PlacementWithAggregates> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const existing = await this.findOne(user.tenantId, id);
    this.validateDates(
      dto.inceptionDate ?? existing.inceptionDate?.toISOString(),
      dto.expiryDate ?? existing.expiryDate?.toISOString(),
    );

    if (dto.cedantId) {
      await this.assertCedant(user.tenantId, dto.cedantId);
    }
    if (dto.participants) {
      await this.assertParticipants(user.tenantId, dto.participants);
      const effectiveCap =
        dto.facultativeOffer !== undefined
          ? dto.facultativeOffer
          : existing.facultativeOffer;
      this.assertAcceptedCap(dto.participants, effectiveCap);
    }
    await this.assertEditable(existing);

    // Resolve riskTypeId update
    let riskTypePatch:
      | { riskTypeId: string | null; classOfBusiness?: string | null }
      | undefined;

    if (dto.riskTypeId !== undefined) {
      if (dto.riskTypeId === null) {
        riskTypePatch = { riskTypeId: null };
      } else {
        const rt = await this.prisma.riskType.findFirst({
          where: {
            id: dto.riskTypeId,
            tenantId: user.tenantId,
            archivedAt: null,
          },
          select: { id: true, name: true },
        });
        if (!rt) throw new NotFoundException('Risk type not found');
        riskTypePatch = { riskTypeId: rt.id, classOfBusiness: rt.name };
      }
    }

    if (
      dto.businessDetails !== undefined ||
      dto.offerDetails !== undefined ||
      dto.riskTypeId !== undefined
    ) {
      const effectiveRiskTypeId =
        riskTypePatch !== undefined
          ? riskTypePatch.riskTypeId
          : existing.riskTypeId;
      await this.validateDynamicFields(
        user.tenantId,
        effectiveRiskTypeId,
        dto.businessDetails,
        dto.offerDetails,
      );
    }

    let currencyPatch:
      | { currency: string | null; exchangeRateToBase?: Prisma.Decimal | null }
      | undefined;
    if (dto.currency !== undefined) {
      const newIso = this.cleanOptional(dto.currency)?.toUpperCase() ?? null;
      if (newIso !== existing.currency) {
        const snappedRate = await this.resolveExchangeRate(
          user.tenantId,
          newIso,
        );
        currencyPatch = { currency: newIso, exchangeRateToBase: snappedRate };
      } else {
        currencyPatch = { currency: newIso };
      }
    }

    const data: Prisma.PlacementUpdateInput = {
      ...(dto.reference !== undefined
        ? {
            reference: this.cleanRequired(dto.reference),
            normalizedReference: this.normalizeReference(dto.reference),
          }
        : {}),
      ...(dto.title !== undefined
        ? { title: this.cleanRequired(dto.title) }
        : {}),
      ...(dto.placementType !== undefined
        ? { placementType: dto.placementType }
        : {}),
      ...(dto.cedantId !== undefined
        ? {
            cedant: {
              connect: {
                id_tenantId: { id: dto.cedantId, tenantId: user.tenantId },
              },
            },
          }
        : {}),
      ...(riskTypePatch ?? {}),
      ...(dto.classOfBusiness !== undefined && riskTypePatch === undefined
        ? { classOfBusiness: this.cleanOptional(dto.classOfBusiness) }
        : {}),
      ...(dto.businessDetails !== undefined
        ? {
            businessDetails:
              this.normalizeJsonObject(
                dto.businessDetails,
                'businessDetails',
              ) ?? Prisma.JsonNull,
          }
        : {}),
      ...(dto.offerDetails !== undefined
        ? {
            offerDetails:
              this.normalizeJsonObject(dto.offerDetails, 'offerDetails') ??
              Prisma.JsonNull,
          }
        : {}),
      ...(dto.description !== undefined
        ? { description: this.cleanOptional(dto.description) }
        : {}),
      ...(dto.inceptionDate !== undefined
        ? { inceptionDate: this.toDate(dto.inceptionDate) }
        : {}),
      ...(dto.expiryDate !== undefined
        ? { expiryDate: this.toDate(dto.expiryDate) }
        : {}),
      ...(currencyPatch ?? {}),
      ...(dto.sumInsured !== undefined ? { sumInsured: dto.sumInsured } : {}),
      ...(dto.rate !== undefined ? { rate: dto.rate } : {}),
      ...(dto.premium !== undefined ? { premium: dto.premium } : {}),
      ...(dto.commission !== undefined ? { commission: dto.commission } : {}),
      ...(dto.facultativeOffer !== undefined
        ? { facultativeOffer: dto.facultativeOffer }
        : {}),
      ...(dto.preliminaryBrokerage !== undefined
        ? { preliminaryBrokerage: dto.preliminaryBrokerage }
        : {}),
      updatedByUserId: user.id,
      ...(dto.participants !== undefined
        ? {
            participants: {
              deleteMany: {},
              ...this.participantsCreateInput(dto.participants),
            },
          }
        : {}),
    };

    try {
      const placement = await this.prisma.placement.update({
        where: {
          id_tenantId: { id, tenantId: user.tenantId },
          archivedAt: null,
        },
        data,
        include: placementInclude,
      });
      const finalPlacement =
        dto.participants !== undefined
          ? await this.syncParticipantDrivenStatus(
              user,
              existing,
              this.withAggregates(placement),
            )
          : this.withAggregates(placement);
      this.publish('updated', finalPlacement, user, {
        before: this.auditSnapshot(existing),
        after: this.auditSnapshot(finalPlacement),
      });
      return finalPlacement;
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }
  }

  async changeStatus(
    user: RequestUser,
    id: string,
    dto: UpdatePlacementStatusDto,
  ): Promise<PlacementWithAggregates> {
    const existing = await this.findOne(user.tenantId, id);
    if (existing.status === dto.status) {
      return this.withAggregates(existing);
    }
    await this.assertStatusChangeAllowed(existing);
    this.assertStatusTransition(existing.status, dto.status);

    const placement = await this.prisma.$transaction(async (tx) => {
      await tx.placementStatusHistory.create({
        data: {
          tenantId: user.tenantId,
          placementId: id,
          fromStatus: existing.status,
          toStatus: dto.status,
          changedByUserId: user.id,
          note: this.cleanOptional(dto.note),
        },
      });

      return tx.placement.update({
        where: {
          id_tenantId: { id, tenantId: user.tenantId },
          archivedAt: null,
        },
        data: {
          status: dto.status,
          updatedByUserId: user.id,
        },
        include: placementInclude,
      });
    });

    this.publish(
      'statusChanged',
      placement,
      user,
      {
        before: this.auditSnapshot(existing),
        after: this.auditSnapshot(placement),
      },
      existing.status,
      dto.status,
      dto.note,
    );
    return this.withAggregates(placement);
  }

  async archive(
    user: RequestUser,
    id: string,
  ): Promise<PlacementWithAggregates> {
    const existing = await this.findOne(user.tenantId, id);
    await this.assertArchivable(existing);
    const placement = await this.prisma.placement.update({
      where: {
        id_tenantId: { id, tenantId: user.tenantId },
        archivedAt: null,
      },
      data: {
        archivedAt: new Date(),
        archivedByUserId: user.id,
        updatedByUserId: user.id,
      },
      include: placementInclude,
    });

    this.publish('deleted', placement, user, {
      before: this.auditSnapshot(existing),
      after: this.auditSnapshot(placement),
    });
    return this.withAggregates(placement);
  }

  async addParticipant(
    user: RequestUser,
    placementId: string,
    dto: CreatePlacementParticipantDto,
  ): Promise<PlacementWithAggregates> {
    const existing = await this.findOne(user.tenantId, placementId);
    await this.assertEditable(existing);
    await this.assertParticipants(user.tenantId, [dto]);
    this.assertParticipantCollection(
      [...existing.participants, this.toCapacityInput(dto)],
      existing.facultativeOffer,
    );

    try {
      await this.prisma.placementParticipant.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          counterpartyId: dto.counterpartyId,
          role: dto.role,
          status: dto.status ?? PlacementParticipantStatus.INVITED,
          sharePercent: dto.sharePercent,
          signedLinePercent: dto.signedLinePercent,
          brokerageFee: dto.brokerageFee,
          notes: this.cleanOptional(dto.notes),
        },
      });
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }

    const placement = await this.syncParticipantDrivenStatus(
      user,
      existing,
      await this.findOne(user.tenantId, placementId),
    );
    this.publish('updated', placement, user, {
      before: this.auditSnapshot(existing),
      after: this.auditSnapshot(placement),
    });
    return placement;
  }

  async updateParticipant(
    user: RequestUser,
    placementId: string,
    participantId: string,
    dto: UpdatePlacementParticipantDto,
  ): Promise<PlacementWithAggregates> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const existing = await this.findOne(user.tenantId, placementId);
    await this.assertEditable(existing);
    const participant = this.assertPlacementParticipant(
      existing,
      participantId,
    );

    const nextParticipant = this.mergeParticipant(participant, dto);
    await this.assertParticipants(user.tenantId, [nextParticipant]);
    this.assertParticipantCollection(
      existing.participants.map((item) =>
        item.id === participantId ? nextParticipant : item,
      ),
      existing.facultativeOffer,
    );

    try {
      await this.prisma.placementParticipant.update({
        where: { id: participant.id },
        data: {
          ...(dto.counterpartyId !== undefined
            ? { counterpartyId: dto.counterpartyId }
            : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.sharePercent !== undefined
            ? { sharePercent: dto.sharePercent }
            : {}),
          ...(dto.signedLinePercent !== undefined
            ? { signedLinePercent: dto.signedLinePercent }
            : {}),
          ...(dto.brokerageFee !== undefined
            ? { brokerageFee: dto.brokerageFee }
            : {}),
          ...(dto.notes !== undefined
            ? { notes: this.cleanOptional(dto.notes) }
            : {}),
        },
      });
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }

    const placement = await this.syncParticipantDrivenStatus(
      user,
      existing,
      await this.findOne(user.tenantId, placementId),
    );
    this.publish('updated', placement, user, {
      before: this.auditSnapshot(existing),
      after: this.auditSnapshot(placement),
    });
    return placement;
  }

  async deleteParticipant(
    user: RequestUser,
    placementId: string,
    participantId: string,
  ): Promise<PlacementWithAggregates> {
    const existing = await this.findOne(user.tenantId, placementId);
    await this.assertEditable(existing);
    const participant = this.assertPlacementParticipant(
      existing,
      participantId,
    );

    await this.prisma.placementParticipant.delete({
      where: { id: participant.id },
    });

    const placement = await this.syncParticipantDrivenStatus(
      user,
      existing,
      await this.findOne(user.tenantId, placementId),
    );
    this.publish('updated', placement, user, {
      before: this.auditSnapshot(existing),
      after: this.auditSnapshot(placement),
    });
    return placement;
  }

  async changeParticipantStatus(
    user: RequestUser,
    placementId: string,
    participantId: string,
    dto: UpdatePlacementParticipantStatusDto,
  ): Promise<PlacementWithAggregates> {
    const existing = await this.findOne(user.tenantId, placementId);
    await this.assertEditable(existing);
    const participant = this.assertPlacementParticipant(
      existing,
      participantId,
    );
    this.assertParticipantStatusTransition(participant.status, dto.status);

    const nextParticipant = this.mergeParticipant(participant, {
      status: dto.status,
      notes: dto.note ?? participant.notes ?? undefined,
    });
    this.assertParticipantCollection(
      existing.participants.map((item) =>
        item.id === participantId ? nextParticipant : item,
      ),
      existing.facultativeOffer,
    );

    await this.prisma.placementParticipant.update({
      where: { id: participant.id },
      data: {
        status: dto.status,
        ...(dto.note !== undefined
          ? { notes: this.cleanOptional(dto.note) }
          : {}),
      },
    });

    const placement = await this.syncParticipantDrivenStatus(
      user,
      existing,
      await this.findOne(user.tenantId, placementId),
    );
    this.publish('updated', placement, user, {
      before: this.auditSnapshot(existing),
      after: this.auditSnapshot(placement),
    });
    return placement;
  }

  async acceptParticipantAndConfirm(
    user: RequestUser,
    placementId: string,
    participantId: string,
  ): Promise<PlacementParticipantAcceptanceResult> {
    const existing = await this.findOne(user.tenantId, placementId);
    await this.assertEditable(existing);
    this.assertPlacementParticipant(existing, participantId);

    let result: PlacementParticipantAcceptanceResult | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        result = await this.prisma.$transaction(
          async (tx) =>
            this.acceptParticipantAndConfirmInTransaction(
              tx,
              user,
              placementId,
              participantId,
            ),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (error) {
        if (attempt === 0 && this.isSerializableTransactionConflict(error)) {
          continue;
        }
        throw error;
      }
    }

    if (!result) {
      throw new ConflictException(
        'Could not complete participant acceptance workflow',
      );
    }

    const placement = await this.findOne(user.tenantId, placementId);
    this.publish('updated', placement, user, {
      before: this.auditSnapshot(existing),
      after: this.auditSnapshot(placement),
    });

    return result;
  }

  private async findSlipPreviewPlacement(
    tenantId: string,
    id: string,
  ): Promise<SlipPreviewPlacementRecord> {
    const placement = await this.prisma.placement.findFirst({
      where: { id, tenantId, archivedAt: null },
      include: slipPreviewInclude,
    });

    if (!placement) {
      throw new NotFoundException('Placement not found');
    }

    return placement;
  }

  private slipPlacementSummary(placement: SlipPreviewPlacementRecord) {
    return {
      id: placement.id,
      reference: placement.reference,
      title: placement.title,
      placementType: placement.placementType,
      status: placement.status,
      riskTypeId: placement.riskTypeId,
      classOfBusiness: placement.classOfBusiness,
      currency: placement.currency,
      inceptionDate: placement.inceptionDate,
      expiryDate: placement.expiryDate,
      sumInsured: this.nullableDecimalToNumber(placement.sumInsured),
      rate: this.nullableDecimalToNumber(placement.rate),
      premium: this.nullableDecimalToNumber(placement.premium),
      commission: this.nullableDecimalToNumber(placement.commission),
      facultativeOffer: this.nullableDecimalToNumber(
        placement.facultativeOffer,
      ),
      preliminaryBrokerage: this.nullableDecimalToNumber(
        placement.preliminaryBrokerage,
      ),
    };
  }

  private slipCounterparty(
    counterparty:
      | SlipPreviewPlacementRecord['cedant']
      | SlipPreviewPlacementRecord['participants'][number]['counterparty'],
  ) {
    return {
      id: counterparty.id,
      type: counterparty.type,
      name: counterparty.name,
      registrationNumber: counterparty.registrationNumber,
      email: counterparty.email,
      phone: counterparty.phone,
      country: counterparty.country,
      contacts: counterparty.contacts.map((contact) => ({
        id: contact.id,
        fullName: contact.fullName,
        jobTitle: contact.jobTitle,
        email: contact.email,
        phone: contact.phone,
        isPrimary: contact.isPrimary,
      })),
      addresses: counterparty.addresses.map((address) => ({
        id: address.id,
        label: address.label,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        isPrimary: address.isPrimary,
      })),
    };
  }

  private slipParticipant(
    participant: SlipPreviewPlacementRecord['participants'][number],
  ) {
    return {
      id: participant.id,
      counterpartyId: participant.counterpartyId,
      role: participant.role,
      status: participant.status,
      sharePercent: this.nullableDecimalToNumber(participant.sharePercent),
      signedLinePercent: this.nullableDecimalToNumber(
        participant.signedLinePercent,
      ),
      brokerageFee: this.nullableDecimalToNumber(participant.brokerageFee),
      notes: participant.notes,
      counterparty: this.slipCounterparty(participant.counterparty),
    };
  }

  private detailEntries(value: Prisma.JsonValue | null) {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return [];
    }

    return Object.entries(value as Record<string, unknown>).map(
      ([key, entryValue]) => ({
        key,
        label: this.toFrontendLabel(key),
        value: entryValue,
      }),
    );
  }

  private toFrontendLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  private calculateSlipFinancials(
    placement: SlipPreviewPlacementRecord,
    brokerageFee: number,
  ) {
    const facOffer = this.decimalToNumber(placement.facultativeOffer);
    const sumInsured = this.nullableDecimalToNumber(placement.sumInsured);
    const premium = this.nullableDecimalToNumber(placement.premium);
    const commission = this.decimalToNumber(placement.commission);
    const facSumInsured =
      sumInsured !== null ? (facOffer / 100) * sumInsured : null;
    const reinsurancePremium =
      premium !== null ? (facOffer / 100) * premium : null;
    const commissions =
      reinsurancePremium !== null
        ? ((commission + brokerageFee) / 100) * reinsurancePremium
        : null;
    const netPremium =
      reinsurancePremium !== null && commissions !== null
        ? reinsurancePremium - commissions
        : null;

    return {
      brokerageFee,
      facOffer,
      facSumInsured,
      reinsurancePremium,
      commissions,
      netPremium,
    };
  }

  private calculateDebitGuaranteeFinancials(
    placement: SlipPreviewPlacementRecord,
  ) {
    const facOffer = this.decimalToNumber(placement.facultativeOffer);
    const sumInsured = this.nullableDecimalToNumber(placement.sumInsured);
    const premium = this.nullableDecimalToNumber(placement.premium);
    const commission = this.decimalToNumber(placement.commission);
    const facSumInsured =
      sumInsured !== null ? (facOffer / 100) * sumInsured : null;
    const facPremium = premium !== null ? (facOffer / 100) * premium : null;
    const commissionAmount =
      facPremium !== null ? (commission / 100) * facPremium : null;
    const netPremium =
      facPremium !== null && commissionAmount !== null
        ? facPremium - commissionAmount
        : null;

    return {
      facSumInsured,
      facPremium,
      commissionAmount,
      netPremium,
    };
  }

  private calculateDistributionFinancials(
    placement: SlipPreviewPlacementRecord,
    participant: SlipPreviewPlacementRecord['participants'][number],
  ) {
    const facOffer = this.decimalToNumber(placement.facultativeOffer);
    const premium = this.decimalToNumber(placement.premium);
    const shareLine = this.decimalToNumber(participant.sharePercent);
    const brokerageFee = this.decimalToNumber(participant.brokerageFee);
    const facPremium = premium * (facOffer / 100);
    const premiumShare = (shareLine / 100) * facPremium;
    const brokerageAmount = (brokerageFee / 100) * premiumShare;

    return {
      shareLine,
      brokerageFee,
      facPremium,
      premiumShare,
      brokerageAmount,
    };
  }

  private calculateClosingRow(
    placement: SlipPreviewPlacementRecord,
    participant: SlipPreviewPlacementRecord['participants'][number],
  ) {
    const signedShare =
      this.decimalToNumber(participant.signedLinePercent) ||
      this.decimalToNumber(participant.sharePercent);
    const premium = this.decimalToNumber(placement.premium);

    return {
      signedShare,
      signedGrossPremium: (signedShare / 100) * premium,
      brokerageFee: this.decimalToNumber(participant.brokerageFee),
    };
  }

  private calculateCreditNoteFinancials(
    placement: SlipPreviewPlacementRecord,
    participant: SlipPreviewPlacementRecord['participants'][number],
  ) {
    const sharePercent =
      this.decimalToNumber(participant.signedLinePercent) ||
      this.decimalToNumber(participant.sharePercent);
    const brokerageFee = this.decimalToNumber(participant.brokerageFee);
    const sumInsured = this.nullableDecimalToNumber(placement.sumInsured);
    const premium = this.nullableDecimalToNumber(placement.premium);
    const commission = this.decimalToNumber(placement.commission);
    const yourSumInsured =
      sumInsured !== null ? (sharePercent / 100) * sumInsured : null;
    const yourPremium =
      premium !== null ? (sharePercent / 100) * premium : null;
    const totalCommissionPct = commission + brokerageFee;
    const commissionAmount =
      yourPremium !== null ? (totalCommissionPct / 100) * yourPremium : null;
    const nicLevyPct = 0;
    const withholdingTaxPct = 0;
    const nicLevyAmount =
      yourPremium !== null ? (nicLevyPct / 100) * yourPremium : 0;
    const withholdingTaxAmount =
      yourPremium !== null ? (withholdingTaxPct / 100) * yourPremium : 0;
    const netPremium =
      yourPremium !== null && commissionAmount !== null
        ? yourPremium - commissionAmount - nicLevyAmount - withholdingTaxAmount
        : null;

    return {
      sharePercent,
      brokerageFee,
      yourSumInsured,
      yourPremium,
      totalCommissionPct,
      commissionAmount,
      nicLevyPct,
      nicLevyAmount,
      withholdingTaxPct,
      withholdingTaxAmount,
      netPremium,
    };
  }

  private isReinsurerParticipant(role: PlacementParticipantRole): boolean {
    return (
      role === PlacementParticipantRole.REINSURER ||
      role === PlacementParticipantRole.LEAD_REINSURER ||
      role === PlacementParticipantRole.CO_REINSURER
    );
  }

  private async assertCedant(
    tenantId: string,
    cedantId: string,
  ): Promise<void> {
    const cedant = await this.prisma.counterparty.findFirst({
      where: {
        id: cedantId,
        tenantId,
        type: CounterpartyType.CEDANT,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!cedant) {
      throw new BadRequestException('Cedant counterparty not found');
    }
  }

  private async assertParticipants(
    tenantId: string,
    participants: ParticipantCapacityInput[],
  ): Promise<void> {
    this.assertCapacity(participants);
    const keys = new Set<string>();
    const ids = [...new Set(participants.map((item) => item.counterpartyId))];
    const counterparties = await this.prisma.counterparty.findMany({
      where: { tenantId, id: { in: ids }, archivedAt: null },
      select: { id: true, type: true, name: true },
    });
    const byId = new Map<string, CounterpartySummary>(
      counterparties.map((item) => [item.id, item]),
    );

    for (const participant of participants) {
      const duplicateKey = `${participant.counterpartyId}:${participant.role}`;
      if (keys.has(duplicateKey)) {
        throw new BadRequestException(
          'Duplicate placement participant role for counterparty',
        );
      }
      keys.add(duplicateKey);

      const counterparty = byId.get(participant.counterpartyId);
      if (!counterparty) {
        throw new BadRequestException('Participant counterparty not found');
      }

      this.assertParticipantRoleMatchesType(participant.role, counterparty);
    }
  }

  private assertPlacementParticipant(
    placement: PlacementRecord,
    participantId: string,
  ): PlacementParticipantRecord {
    const participant = placement.participants.find(
      (item) => item.id === participantId,
    );

    if (!participant) {
      throw new NotFoundException('Placement participant not found');
    }

    return participant;
  }

  private async acceptParticipantAndConfirmInTransaction(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    placementId: string,
    participantId: string,
  ): Promise<PlacementParticipantAcceptanceResult> {
    const placement = await tx.placement.findFirst({
      where: { id: placementId, tenantId: user.tenantId, archivedAt: null },
      include: placementInclude,
    });
    if (!placement) {
      throw new NotFoundException('Placement not found');
    }

    const participant = this.assertPlacementParticipant(
      placement,
      participantId,
    );
    if (participant.status !== PlacementParticipantStatus.ACCEPTED) {
      this.assertParticipantStatusTransition(
        participant.status,
        PlacementParticipantStatus.ACCEPTED,
      );
    }

    const nextParticipantInput = {
      ...this.mergeParticipant(participant, {
        status: PlacementParticipantStatus.ACCEPTED,
      }),
      status: PlacementParticipantStatus.ACCEPTED,
    };
    this.assertParticipantCollection(
      placement.participants.map((item) =>
        item.id === participantId ? nextParticipantInput : item,
      ),
      placement.facultativeOffer,
    );

    const signedLinePercent = this.decimalToNumber(
      nextParticipantInput.signedLinePercent,
    );
    if (signedLinePercent <= 0) {
      throw new BadRequestException(
        'Participant must have a signed line percentage greater than zero',
      );
    }
    if (placement.premium === null) {
      throw new BadRequestException(
        'Placement premium is required before creating a closing',
      );
    }

    const acceptedParticipant =
      participant.status === PlacementParticipantStatus.ACCEPTED
        ? await tx.placementParticipant.findFirst({
            where: {
              id: participantId,
              tenantId: user.tenantId,
              placementId,
            },
            include: participantAcceptanceInclude,
          })
        : await tx.placementParticipant.update({
            where: { id: participant.id },
            data: { status: PlacementParticipantStatus.ACCEPTED },
            include: participantAcceptanceInclude,
          });
    if (!acceptedParticipant) {
      throw new NotFoundException('Placement participant not found');
    }

    await this.syncParticipantDrivenStatusInTransaction(
      tx,
      user,
      placement,
      participantId,
      nextParticipantInput,
    );

    const closing = await this.createOrConfirmPlacementClosingInTransaction(
      tx,
      user,
      placement,
      participant,
      signedLinePercent,
    );
    await this.syncPlacementClosedIfFullyConfirmedInTransaction(
      tx,
      user,
      placement,
    );

    return {
      participant: acceptedParticipant,
      closing,
    };
  }

  private async syncParticipantDrivenStatusInTransaction(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    placement: PlacementRecord,
    participantId: string,
    nextParticipant: ParticipantCapacityInput & {
      status: PlacementParticipantStatus;
    },
  ): Promise<void> {
    const aggregate = this.calculateAggregates({
      facultativeOffer: placement.facultativeOffer,
      participants: placement.participants.map((item) =>
        item.id === participantId ? nextParticipant : item,
      ),
    });
    const nextStatus = this.deriveParticipantDrivenStatus({
      ...placement,
      ...aggregate,
    });
    if (!nextStatus || nextStatus === placement.status) return;

    await tx.placementStatusHistory.create({
      data: {
        tenantId: user.tenantId,
        placementId: placement.id,
        fromStatus: placement.status,
        toStatus: nextStatus,
        changedByUserId: user.id,
        note: 'Participant capacity recalculated placement status',
      },
    });

    await tx.placement.update({
      where: { id: placement.id },
      data: { status: nextStatus, updatedByUserId: user.id },
    });
  }

  private async createOrConfirmPlacementClosingInTransaction(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    placement: PlacementRecord,
    participant: PlacementParticipantRecord,
    signedLinePercent: number,
  ): Promise<PlacementParticipantAcceptanceClosingRecord> {
    const activeClosing = await tx.placementClosing.findFirst({
      where: {
        tenantId: user.tenantId,
        placementId: placement.id,
        participantId: participant.id,
        status: { not: PlacementClosingStatus.VOID },
      },
      include: participantAcceptanceClosingInclude,
      orderBy: { createdAt: 'desc' },
    });

    if (activeClosing) {
      return this.confirmExistingPlacementClosingInTransaction(
        tx,
        activeClosing,
      );
    }

    const count = await tx.placementClosing.count({
      where: { tenantId: user.tenantId, placementId: placement.id },
    });
    const closingNumber = `CLO-${String(count + 1).padStart(3, '0')}`;
    const snapshot = this.computePlacementClosingSnapshot(
      placement,
      participant,
      signedLinePercent,
    );

    const draftClosing = await tx.placementClosing.create({
      data: {
        tenantId: user.tenantId,
        placementId: placement.id,
        participantId: participant.id,
        closingNumber,
        status: PlacementClosingStatus.DRAFT,
        createdByUserId: user.id,
        ...snapshot,
      },
      include: participantAcceptanceClosingInclude,
    });

    return this.confirmExistingPlacementClosingInTransaction(tx, draftClosing);
  }

  private async confirmExistingPlacementClosingInTransaction(
    tx: Prisma.TransactionClient,
    closing: PlacementParticipantAcceptanceClosingRecord,
  ): Promise<PlacementParticipantAcceptanceClosingRecord> {
    if (closing.status === PlacementClosingStatus.CONFIRMED) {
      return closing;
    }

    let nextClosing = closing;
    if (nextClosing.status === PlacementClosingStatus.DRAFT) {
      nextClosing = await tx.placementClosing.update({
        where: { id: nextClosing.id },
        data: { status: PlacementClosingStatus.ISSUED, issuedAt: new Date() },
        include: participantAcceptanceClosingInclude,
      });
    }

    if (nextClosing.status === PlacementClosingStatus.ISSUED) {
      return tx.placementClosing.update({
        where: { id: nextClosing.id },
        data: {
          status: PlacementClosingStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
        include: participantAcceptanceClosingInclude,
      });
    }

    throw new BadRequestException(
      `Cannot move closing from ${nextClosing.status} to ${PlacementClosingStatus.CONFIRMED}`,
    );
  }

  private async syncPlacementClosedIfFullyConfirmedInTransaction(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    placement: Pick<PlacementRecord, 'id' | 'status' | 'facultativeOffer'>,
  ): Promise<void> {
    if (placement.status !== PlacementStatus.CLOSING) return;

    const targetPercent = this.nullableDecimalToNumber(
      placement.facultativeOffer,
    );
    if (targetPercent === null || targetPercent <= 0) return;

    const confirmedClosings = await tx.placementClosing.findMany({
      where: {
        tenantId: user.tenantId,
        placementId: placement.id,
        status: PlacementClosingStatus.CONFIRMED,
      },
      select: { signedLinePercent: true },
    });
    const confirmedPlacedPercent = this.roundPercent(
      confirmedClosings.reduce(
        (total, item) => total + this.decimalToNumber(item.signedLinePercent),
        0,
      ),
    );

    if (confirmedPlacedPercent + 0.0001 < targetPercent) return;

    await tx.placementStatusHistory.create({
      data: {
        tenantId: user.tenantId,
        placementId: placement.id,
        fromStatus: PlacementStatus.CLOSING,
        toStatus: PlacementStatus.CLOSED,
        changedByUserId: user.id,
        note: 'Confirmed placement closings reached facultative offer',
      },
    });

    await tx.placement.update({
      where: {
        id_tenantId: { id: placement.id, tenantId: user.tenantId },
      },
      data: { status: PlacementStatus.CLOSED, updatedByUserId: user.id },
    });
  }

  private computePlacementClosingSnapshot(
    placement: {
      premium: Prisma.Decimal | number | string | null;
      commission: Prisma.Decimal | number | string | null;
      currency: string | null;
    },
    participant: {
      sharePercent: Prisma.Decimal | number | string | null;
      brokerageFee: Prisma.Decimal | number | string | null;
    },
    signedLinePercent: number,
  ) {
    const sharePercent = this.nullableDecimalToNumber(participant.sharePercent);
    const premium = this.decimalToNumber(placement.premium);
    const commissionPct = this.decimalToNumber(placement.commission);
    const brokeragePct = this.decimalToNumber(participant.brokerageFee);

    const grossPremium = (signedLinePercent / 100) * premium;
    const commissionAmount = (commissionPct / 100) * grossPremium;
    const brokerageAmount = (brokeragePct / 100) * grossPremium;
    const netPremium = grossPremium - commissionAmount - brokerageAmount;

    return {
      signedLinePercent,
      sharePercent,
      grossPremium,
      commissionPercent: commissionPct,
      commissionAmount,
      brokeragePercent: brokeragePct,
      brokerageAmount,
      netPremium,
      currency: placement.currency,
    };
  }

  private assertParticipantCollection(
    participants: ParticipantCapacityInput[],
    facultativeOffer?: number | Prisma.Decimal | null,
  ): void {
    const keys = new Set<string>();
    for (const participant of participants) {
      const duplicateKey = `${participant.counterpartyId}:${participant.role}`;
      if (keys.has(duplicateKey)) {
        throw new BadRequestException(
          'Duplicate placement participant role for counterparty',
        );
      }
      keys.add(duplicateKey);
    }
    this.assertCapacity(participants);
    this.assertAcceptedCap(participants, facultativeOffer);
  }

  private assertParticipantRoleMatchesType(
    role: PlacementParticipantRole,
    counterparty: CounterpartySummary,
  ): void {
    const expectedTypeByRole: Record<
      PlacementParticipantRole,
      CounterpartyType
    > = {
      [PlacementParticipantRole.BROKER]: CounterpartyType.BROKER,
      [PlacementParticipantRole.REINSURER]: CounterpartyType.REINSURER,
      [PlacementParticipantRole.LEAD_REINSURER]: CounterpartyType.REINSURER,
      [PlacementParticipantRole.CO_REINSURER]: CounterpartyType.REINSURER,
    };

    const expected = expectedTypeByRole[role];
    if (counterparty.type !== expected) {
      throw new BadRequestException(
        `${counterparty.name} must be a ${expected} counterparty for role ${role}`,
      );
    }
  }

  private assertCapacity(participants: ParticipantCapacityInput[]): void {
    for (const participant of participants) {
      if (
        participant.status === PlacementParticipantStatus.ACCEPTED &&
        this.decimalToNumber(participant.signedLinePercent) <= 0
      ) {
        throw new BadRequestException(
          'Accepted participants require a signed line percentage',
        );
      }

      if (
        participant.sharePercent !== undefined &&
        participant.sharePercent !== null &&
        participant.signedLinePercent !== undefined &&
        participant.signedLinePercent !== null &&
        this.decimalToNumber(participant.signedLinePercent) >
          this.decimalToNumber(participant.sharePercent)
      ) {
        throw new BadRequestException(
          'Signed line cannot exceed offered participant share',
        );
      }
    }
  }

  private assertAcceptedCap(
    participants: ParticipantCapacityInput[],
    facultativeOffer: number | Prisma.Decimal | null | undefined,
  ): void {
    const cap = this.decimalToNumber(facultativeOffer) || 100;
    const totalAccepted = this.roundPercent(
      participants
        .filter((p) => p.status === PlacementParticipantStatus.ACCEPTED)
        .reduce((sum, p) => sum + this.decimalToNumber(p.signedLinePercent), 0),
    );
    if (totalAccepted > cap) {
      throw new BadRequestException(
        `Total accepted signed line (${totalAccepted}%) cannot exceed the facultative offer cap (${cap}%)`,
      );
    }
  }

  private assertParticipantStatusTransition(
    from: PlacementParticipantStatus,
    to: PlacementParticipantStatus,
  ): void {
    const allowed: Record<
      PlacementParticipantStatus,
      PlacementParticipantStatus[]
    > = {
      [PlacementParticipantStatus.INVITED]: [
        PlacementParticipantStatus.OFFER_SENT,
        PlacementParticipantStatus.DECLINED,
      ],
      [PlacementParticipantStatus.OFFER_SENT]: [
        PlacementParticipantStatus.QUOTED,
        PlacementParticipantStatus.ACCEPTED,
        PlacementParticipantStatus.DECLINED,
      ],
      [PlacementParticipantStatus.QUOTED]: [
        PlacementParticipantStatus.OFFER_SENT,
        PlacementParticipantStatus.ACCEPTED,
        PlacementParticipantStatus.DECLINED,
      ],
      [PlacementParticipantStatus.ACCEPTED]: [
        PlacementParticipantStatus.QUOTED,
        PlacementParticipantStatus.DECLINED,
        PlacementParticipantStatus.CLOSED,
      ],
      [PlacementParticipantStatus.DECLINED]: [
        PlacementParticipantStatus.OFFER_SENT,
      ],
      [PlacementParticipantStatus.CLOSED]: [],
    };

    if (from === to) return;
    if (!allowed[from].includes(to)) {
      throw new BadRequestException(
        `Cannot move placement participant from ${from} to ${to}`,
      );
    }
  }

  private async assertEditable(placement: PlacementRecord): Promise<void> {
    await this.financialLockPolicy.assertEditable(placement);
  }

  private async assertArchivable(placement: PlacementRecord): Promise<void> {
    await this.financialLockPolicy.assertArchivable(placement);
  }

  private async assertStatusChangeAllowed(
    placement: PlacementRecord,
  ): Promise<void> {
    const lockStatus = await this.financialLockPolicy.evaluate(placement);
    if (lockStatus.locked) {
      throw new ConflictException(lockStatus.reason);
    }
  }

  private assertStatusTransition(
    from: PlacementStatus,
    to: PlacementStatus,
  ): void {
    const allowed: Record<PlacementStatus, PlacementStatus[]> = {
      [PlacementStatus.DRAFT]: [
        PlacementStatus.MARKETING,
        PlacementStatus.CANCELLED,
      ],
      [PlacementStatus.MARKETING]: [
        PlacementStatus.PARTIALLY_PLACED,
        PlacementStatus.PLACED,
        PlacementStatus.DECLINED,
        PlacementStatus.CANCELLED,
      ],
      [PlacementStatus.PARTIALLY_PLACED]: [
        PlacementStatus.MARKETING,
        PlacementStatus.PLACED,
        PlacementStatus.DECLINED,
        PlacementStatus.CANCELLED,
      ],
      [PlacementStatus.PLACED]: [
        PlacementStatus.PARTIALLY_PLACED,
        PlacementStatus.CLOSING,
        PlacementStatus.CANCELLED,
      ],
      [PlacementStatus.CLOSING]: [
        PlacementStatus.PLACED,
        PlacementStatus.CLOSED,
        PlacementStatus.CANCELLED,
      ],
      [PlacementStatus.CLOSED]: [PlacementStatus.CLOSING],
      [PlacementStatus.DECLINED]: [PlacementStatus.MARKETING],
      [PlacementStatus.CANCELLED]: [],
    };

    if (!allowed[from].includes(to)) {
      throw new BadRequestException(
        `Cannot move placement from ${from} to ${to}`,
      );
    }
  }

  private async syncParticipantDrivenStatus(
    user: RequestUser,
    previous: PlacementWithAggregates,
    placement: PlacementWithAggregates,
  ): Promise<PlacementWithAggregates> {
    const nextStatus = this.deriveParticipantDrivenStatus(placement);
    if (!nextStatus || nextStatus === placement.status) {
      return placement;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.placementStatusHistory.create({
        data: {
          tenantId: user.tenantId,
          placementId: placement.id,
          fromStatus: placement.status,
          toStatus: nextStatus,
          changedByUserId: user.id,
          note: 'Participant capacity recalculated placement status',
        },
      });

      return tx.placement.update({
        where: {
          id_tenantId: { id: placement.id, tenantId: user.tenantId },
          archivedAt: null,
        },
        data: {
          status: nextStatus,
          updatedByUserId: user.id,
        },
        include: placementInclude,
      });
    });
    const synced = this.withAggregates(updated);

    this.publish(
      'statusChanged',
      synced,
      user,
      {
        before: this.auditSnapshot(previous),
        after: this.auditSnapshot(synced),
      },
      placement.status,
      nextStatus,
      'Participant capacity recalculated placement status',
    );

    return synced;
  }

  private deriveParticipantDrivenStatus(
    placement: PlacementWithAggregates,
  ): PlacementStatus | null {
    const participantDrivenStatuses: PlacementStatus[] = [
      PlacementStatus.MARKETING,
      PlacementStatus.PARTIALLY_PLACED,
      PlacementStatus.PLACED,
    ];
    if (!participantDrivenStatuses.includes(placement.status)) {
      return null;
    }

    const targetPercent = this.nullableDecimalToNumber(
      placement.facultativeOffer,
    );
    if (placement.totalAcceptedPercent <= 0) {
      return PlacementStatus.MARKETING;
    }
    if (targetPercent === null || targetPercent <= 0) {
      return PlacementStatus.PARTIALLY_PLACED;
    }
    if (placement.totalAcceptedPercent >= targetPercent) {
      return PlacementStatus.PLACED;
    }
    return PlacementStatus.PARTIALLY_PLACED;
  }

  private participantsCreateInput(
    participants?: CreatePlacementParticipantDto[],
  ): Pick<
    Prisma.PlacementParticipantUpdateManyWithoutPlacementNestedInput,
    'create'
  > {
    return {
      create: (participants ?? []).map((participant) => ({
        counterpartyId: participant.counterpartyId,
        role: participant.role,
        status: participant.status ?? PlacementParticipantStatus.INVITED,
        sharePercent: participant.sharePercent,
        signedLinePercent: participant.signedLinePercent,
        brokerageFee: participant.brokerageFee,
        notes: this.cleanOptional(participant.notes),
      })),
    };
  }

  private mergeParticipant(
    participant: PlacementParticipantRecord,
    dto: UpdatePlacementParticipantDto,
  ): ParticipantCapacityInput {
    return {
      counterpartyId: dto.counterpartyId ?? participant.counterpartyId,
      role: dto.role ?? participant.role,
      status: dto.status ?? participant.status,
      sharePercent:
        dto.sharePercent !== undefined
          ? dto.sharePercent
          : participant.sharePercent,
      signedLinePercent:
        dto.signedLinePercent !== undefined
          ? dto.signedLinePercent
          : participant.signedLinePercent,
      brokerageFee:
        dto.brokerageFee !== undefined
          ? dto.brokerageFee
          : participant.brokerageFee,
      notes: dto.notes !== undefined ? dto.notes : participant.notes,
    };
  }

  private toCapacityInput(
    participant: CreatePlacementParticipantDto,
  ): ParticipantCapacityInput {
    return {
      counterpartyId: participant.counterpartyId,
      role: participant.role,
      status: participant.status ?? PlacementParticipantStatus.INVITED,
      sharePercent: participant.sharePercent,
      signedLinePercent: participant.signedLinePercent,
      brokerageFee: participant.brokerageFee,
      notes: participant.notes,
    };
  }

  private withAggregates(placement: PlacementRecord): PlacementWithAggregates {
    const aggregates = this.calculateAggregates(placement);

    return {
      ...placement,
      ...aggregates,
    };
  }

  private withLockStatus(
    placement: PlacementWithAggregates,
    lockStatus: PlacementLockStatusDto,
  ): PlacementWithAggregates {
    return {
      ...placement,
      lockStatus,
    };
  }

  private calculateAggregates(placement: {
    facultativeOffer?: number | Prisma.Decimal | string | null;
    participants: Array<{
      status: PlacementParticipantStatus;
      sharePercent?: number | Prisma.Decimal | string | null;
      signedLinePercent?: number | Prisma.Decimal | string | null;
    }>;
  }) {
    const totalOfferedPercent = this.roundPercent(
      placement.participants.reduce(
        (sum, item) => sum + this.decimalToNumber(item.sharePercent),
        0,
      ),
    );
    const totalAcceptedPercent = this.roundPercent(
      placement.participants.reduce((sum, item) => {
        if (item.status !== PlacementParticipantStatus.ACCEPTED) return sum;
        return sum + this.decimalToNumber(item.signedLinePercent);
      }, 0),
    );
    const targetPercent =
      this.nullableDecimalToNumber(placement.facultativeOffer) ?? 0;

    return {
      totalOfferedPercent,
      totalAcceptedPercent,
      remainingPercent: this.roundPercent(
        Math.max(0, targetPercent - totalAcceptedPercent),
      ),
    };
  }

  private decimalToNumber(
    value: number | Prisma.Decimal | string | null | undefined,
  ): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private nullableDecimalToNumber(
    value: number | Prisma.Decimal | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined) return null;
    return this.decimalToNumber(value);
  }

  private roundPercent(value: number): number {
    return Math.round(value * 10000) / 10000;
  }

  private validateDates(start?: string, end?: string): void {
    if (!start || !end) return;
    if (new Date(start) > new Date(end)) {
      throw new BadRequestException('expiryDate must be after inceptionDate');
    }
  }

  private toDate(value?: string): Date | undefined {
    return value ? new Date(value) : undefined;
  }

  private cleanRequired(value: string): string {
    return value.trim();
  }

  private cleanOptional(value?: string): string | null | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeReference(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeJsonObject(
    value: Record<string, unknown> | undefined,
    fieldName: string,
  ): Prisma.InputJsonObject | undefined {
    if (value === undefined) return undefined;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(`${fieldName} must be an object`);
    }

    return this.trimJsonObject(value, fieldName);
  }

  private trimJsonObject(
    value: Record<string, unknown>,
    fieldName: string,
  ): Prisma.InputJsonObject {
    const result: Record<string, Prisma.InputJsonValue> = {};

    for (const [key, entry] of Object.entries(value)) {
      result[key] = this.trimJsonValue(entry, fieldName);
    }

    return result;
  }

  private trimJsonValue(
    value: unknown,
    fieldName: string,
  ): Prisma.InputJsonValue {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        throw new BadRequestException(`${fieldName} must not include arrays`);
      }

      const nested: Record<string, Prisma.InputJsonValue> = {};
      for (const [key, entry] of Object.entries(
        value as Record<string, unknown>,
      )) {
        nested[key] = this.trimJsonValue(entry, fieldName);
      }
      return nested;
    }

    return value as Prisma.InputJsonValue;
  }

  private auditSnapshot(placement: PlacementRecord): Record<string, unknown> {
    return {
      id: placement.id,
      reference: placement.reference,
      title: placement.title,
      status: placement.status,
      cedantId: placement.cedantId,
      placementType: placement.placementType,
      archivedAt: placement.archivedAt?.toISOString() ?? null,
    };
  }

  private publish(
    method: 'created' | 'updated' | 'deleted',
    placement: PlacementRecord,
    user: RequestUser,
    changes: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    },
  ): void;
  private publish(
    method: 'statusChanged',
    placement: PlacementRecord,
    user: RequestUser,
    changes: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    },
    previousStatus: PlacementStatus,
    nextStatus: PlacementStatus,
    note?: string,
  ): void;
  private publish(
    method: 'created' | 'updated' | 'deleted' | 'statusChanged',
    placement: PlacementRecord,
    user: RequestUser,
    changes: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    },
    previousStatus?: PlacementStatus,
    nextStatus?: PlacementStatus,
    note?: string,
  ): void {
    try {
      const base = {
        tenantId: user.tenantId,
        placementId: placement.id,
        reference: placement.reference,
        title: placement.title,
        status: placement.status,
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        changes,
      };
      const result =
        method === 'statusChanged'
          ? this.publisher.statusChanged({
              ...base,
              previousStatus: previousStatus as PlacementStatus,
              nextStatus: nextStatus as PlacementStatus,
              note,
            })
          : this.publisher[method](base);

      result.catch((error: unknown) => {
        this.logger.warn(
          `Placement audit event failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    } catch (error) {
      this.logger.warn(
        `Placement audit event failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async validateDynamicFields(
    tenantId: string,
    riskTypeId: string | null | undefined,
    businessDetails: Record<string, unknown> | undefined,
    offerDetails: Record<string, unknown> | undefined,
  ): Promise<void> {
    if (!riskTypeId) return;

    const rt = await this.prisma.riskType.findFirst({
      where: { tenantId, id: riskTypeId, archivedAt: null, isActive: true },
      select: {
        fields: {
          where: { isActive: true },
          select: {
            section: true,
            fieldKey: true,
            fieldType: true,
            required: true,
            options: true,
          },
        },
      },
    });

    if (!rt || !rt.fields.length) return;

    const bdFields = rt.fields.filter(
      (f) => f.section === RiskTypeFieldSection.BUSINESS_DETAILS,
    );
    const odFields = rt.fields.filter(
      (f) => f.section === RiskTypeFieldSection.OFFER_DETAILS,
    );

    if (bdFields.length > 0) {
      this.validateSection(bdFields, businessDetails, 'businessDetails');
    }
    if (odFields.length > 0) {
      this.validateSection(odFields, offerDetails, 'offerDetails');
    }
  }

  private validateSection(
    fields: Array<{
      fieldKey: string;
      fieldType: RiskTypeFieldType;
      required: boolean;
      options: Prisma.JsonValue;
    }>,
    data: Record<string, unknown> | undefined,
    sectionName: string,
  ): void {
    const provided = data ?? {};
    const definedKeys = new Set(fields.map((f) => f.fieldKey));

    for (const key of Object.keys(provided)) {
      if (!definedKeys.has(key)) {
        throw new BadRequestException(
          `Unknown field key '${key}' in ${sectionName}`,
        );
      }
    }

    for (const field of fields) {
      const value = provided[field.fieldKey];

      if (field.required && !(field.fieldKey in provided)) {
        throw new BadRequestException(
          `Required field '${field.fieldKey}' is missing from ${sectionName}`,
        );
      }

      if (value === undefined || value === null) continue;

      switch (field.fieldType) {
        case RiskTypeFieldType.NUMBER:
          if (typeof value !== 'number') {
            throw new BadRequestException(
              `Field '${field.fieldKey}' must be a number`,
            );
          }
          break;
        case RiskTypeFieldType.CHECKBOX:
          if (typeof value !== 'boolean') {
            throw new BadRequestException(
              `Field '${field.fieldKey}' must be a boolean`,
            );
          }
          break;
        case RiskTypeFieldType.TEXT:
        case RiskTypeFieldType.TEXTAREA:
          if (typeof value !== 'string') {
            throw new BadRequestException(
              `Field '${field.fieldKey}' must be a string`,
            );
          }
          break;
        case RiskTypeFieldType.DATE:
          if (typeof value !== 'string' || isNaN(Date.parse(value))) {
            throw new BadRequestException(
              `Field '${field.fieldKey}' must be a valid ISO date string`,
            );
          }
          break;
        case RiskTypeFieldType.SELECT: {
          if (typeof value !== 'string') {
            throw new BadRequestException(
              `Field '${field.fieldKey}' must be a string`,
            );
          }
          const opts = field.options as string[] | null;
          if (opts && !opts.includes(value)) {
            throw new BadRequestException(
              `Value '${String(value)}' is not a valid option for field '${field.fieldKey}'`,
            );
          }
          break;
        }
      }
    }
  }

  private async resolveExchangeRate(
    tenantId: string,
    isoCode: string | null,
  ): Promise<Prisma.Decimal | null> {
    if (!isoCode) return null;
    const record = await this.prisma.currency.findFirst({
      where: { tenantId, isoCode, archivedAt: null },
      select: { exchangeRateToBase: true },
    });
    return record?.exchangeRateToBase ?? null;
  }

  private rethrowWriteError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Placement reference already exists for this tenant',
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException('Placement not found');
    }
  }

  private isSerializableTransactionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }
}
