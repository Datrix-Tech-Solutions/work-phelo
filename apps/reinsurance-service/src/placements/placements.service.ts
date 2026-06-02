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
import { QueryPlacementsDto } from './dto/query-placements.dto';
import { UpdatePlacementParticipantStatusDto } from './dto/update-placement-participant-status.dto';
import { UpdatePlacementParticipantDto } from './dto/update-placement-participant.dto';
import { UpdatePlacementStatusDto } from './dto/update-placement-status.dto';
import { UpdatePlacementDto } from './dto/update-placement.dto';

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

type PlacementRecord = Prisma.PlacementGetPayload<{
  include: typeof placementInclude;
}>;

type PlacementWithAggregates = PlacementRecord & {
  totalOfferedPercent: number;
  totalAcceptedPercent: number;
  remainingPercent: number;
};

type PlacementParticipantRecord = PlacementRecord['participants'][number];

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

    return this.withAggregates(placement);
  }

  async create(
    user: RequestUser,
    dto: CreatePlacementDto,
  ): Promise<PlacementWithAggregates> {
    this.validateDates(dto.inceptionDate, dto.expiryDate);
    await this.assertCedant(user.tenantId, dto.cedantId);
    await this.assertParticipants(user.tenantId, dto.participants ?? []);

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
    }
    this.assertEditable(existing);

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
    this.assertArchivable(existing);
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
    this.assertEditable(existing);
    await this.assertParticipants(user.tenantId, [dto]);
    this.assertParticipantCollection([
      ...existing.participants,
      this.toCapacityInput(dto),
    ]);

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
    this.assertEditable(existing);
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
    this.assertEditable(existing);
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
    this.assertEditable(existing);
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

  private assertParticipantCollection(
    participants: ParticipantCapacityInput[],
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
    const totalOffered = participants.reduce(
      (sum, item) => sum + this.decimalToNumber(item.sharePercent),
      0,
    );
    const totalSigned = participants.reduce(
      (sum, item) => sum + this.decimalToNumber(item.signedLinePercent),
      0,
    );

    if (totalOffered > 100) {
      throw new BadRequestException(
        'Total offered participant share cannot exceed 100%',
      );
    }
    if (totalSigned > 100) {
      throw new BadRequestException(
        'Total signed participant line cannot exceed 100%',
      );
    }

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
        participant.signedLinePercent !== undefined &&
        this.decimalToNumber(participant.signedLinePercent) >
          this.decimalToNumber(participant.sharePercent)
      ) {
        throw new BadRequestException(
          'Signed line cannot exceed offered participant share',
        );
      }
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

  private assertEditable(placement: PlacementRecord): void {
    if (
      placement.status === PlacementStatus.CLOSED ||
      placement.status === PlacementStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot edit a ${placement.status} placement`,
      );
    }
  }

  private assertArchivable(placement: PlacementRecord): void {
    if (placement.status === PlacementStatus.CLOSED) {
      throw new BadRequestException('Cannot archive a closed placement');
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
      [PlacementStatus.CLOSED]: [],
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

    const targetPercent =
      this.decimalToNumber(placement.facultativeOffer) || 100;
    if (placement.totalAcceptedPercent <= 0) {
      return PlacementStatus.MARKETING;
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
      this.decimalToNumber(placement.facultativeOffer) || 100;

    return {
      ...placement,
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
}
