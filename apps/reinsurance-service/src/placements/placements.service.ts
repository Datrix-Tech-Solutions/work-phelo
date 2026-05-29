import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  BusinessClassFieldSection,
  BusinessClassFieldType,
  CounterpartyType,
  PlacementParticipantRole,
  PlacementStatus,
  PlacementType,
  Prisma,
} from '../../prisma/generated/client';
import { PlacementEventPublisher } from '../messaging/placement-event.publisher';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlacementParticipantDto } from './dto/create-placement-participant.dto';
import { CreatePlacementDto } from './dto/create-placement.dto';
import { QueryPlacementsDto } from './dto/query-placements.dto';
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
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(tenantId: string, id: string): Promise<PlacementRecord> {
    const placement = await this.prisma.placement.findFirst({
      where: { id, tenantId, archivedAt: null },
      include: placementInclude,
    });

    if (!placement) {
      throw new NotFoundException('Placement not found');
    }

    return placement;
  }

  async create(
    user: RequestUser,
    dto: CreatePlacementDto,
  ): Promise<PlacementRecord> {
    this.validateDates(dto.inceptionDate, dto.expiryDate);
    await this.assertCedant(user.tenantId, dto.cedantId);
    await this.assertParticipants(user.tenantId, dto.participants ?? []);

    const classOfBusiness = this.cleanOptional(dto.classOfBusiness);
    await this.validateDynamicFields(
      user.tenantId,
      classOfBusiness,
      dto.businessDetails,
      dto.offerDetails,
    );

    const data: Prisma.PlacementUncheckedCreateInput = {
      tenantId: user.tenantId,
      reference: this.cleanRequired(dto.reference),
      normalizedReference: this.normalizeReference(dto.reference),
      title: this.cleanRequired(dto.title),
      placementType: dto.placementType ?? PlacementType.FACULTATIVE,
      status: PlacementStatus.DRAFT,
      cedantId: dto.cedantId,
      classOfBusiness,
      businessDetails: dto.businessDetails
        ? (dto.businessDetails as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      offerDetails: dto.offerDetails
        ? (dto.offerDetails as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      description: this.cleanOptional(dto.description),
      inceptionDate: this.toDate(dto.inceptionDate),
      expiryDate: this.toDate(dto.expiryDate),
      currency: this.cleanOptional(dto.currency)?.toUpperCase(),
      sumInsured: dto.sumInsured,
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
      return placement;
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdatePlacementDto,
  ): Promise<PlacementRecord> {
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

    if (
      dto.businessDetails !== undefined ||
      dto.offerDetails !== undefined ||
      dto.classOfBusiness !== undefined
    ) {
      const effectiveClass =
        dto.classOfBusiness !== undefined
          ? this.cleanOptional(dto.classOfBusiness)
          : existing.classOfBusiness;
      await this.validateDynamicFields(
        user.tenantId,
        effectiveClass,
        dto.businessDetails,
        dto.offerDetails,
      );
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
      ...(dto.classOfBusiness !== undefined
        ? { classOfBusiness: this.cleanOptional(dto.classOfBusiness) }
        : {}),
      ...(dto.businessDetails !== undefined
        ? {
            businessDetails: dto.businessDetails
              ? (dto.businessDetails as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          }
        : {}),
      ...(dto.offerDetails !== undefined
        ? {
            offerDetails: dto.offerDetails
              ? (dto.offerDetails as Prisma.InputJsonValue)
              : Prisma.JsonNull,
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
      ...(dto.currency !== undefined
        ? { currency: this.cleanOptional(dto.currency)?.toUpperCase() }
        : {}),
      ...(dto.sumInsured !== undefined ? { sumInsured: dto.sumInsured } : {}),
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
      this.publish('updated', placement, user, {
        before: this.auditSnapshot(existing),
        after: this.auditSnapshot(placement),
      });
      return placement;
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }
  }

  async changeStatus(
    user: RequestUser,
    id: string,
    dto: UpdatePlacementStatusDto,
  ): Promise<PlacementRecord> {
    const existing = await this.findOne(user.tenantId, id);
    if (existing.status === dto.status) {
      return existing;
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
    return placement;
  }

  async archive(user: RequestUser, id: string): Promise<PlacementRecord> {
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
    participants: CreatePlacementParticipantDto[],
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

  private assertCapacity(participants: CreatePlacementParticipantDto[]): void {
    const totalOffered = participants.reduce(
      (sum, item) => sum + (item.sharePercent ?? 0),
      0,
    );
    const totalSigned = participants.reduce(
      (sum, item) => sum + (item.signedLinePercent ?? 0),
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
        participant.sharePercent !== undefined &&
        participant.signedLinePercent !== undefined &&
        participant.signedLinePercent > participant.sharePercent
      ) {
        throw new BadRequestException(
          'Signed line cannot exceed offered participant share',
        );
      }
    }
  }

  private assertEditable(placement: PlacementRecord): void {
    if (
      placement.status === PlacementStatus.BOUND ||
      placement.status === PlacementStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot edit a ${placement.status} placement`,
      );
    }
  }

  private assertArchivable(placement: PlacementRecord): void {
    if (placement.status === PlacementStatus.BOUND) {
      throw new BadRequestException('Cannot archive a bound placement');
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
        PlacementStatus.QUOTED,
        PlacementStatus.BOUND,
        PlacementStatus.DECLINED,
        PlacementStatus.CANCELLED,
      ],
      [PlacementStatus.QUOTED]: [
        PlacementStatus.MARKETING,
        PlacementStatus.BOUND,
        PlacementStatus.DECLINED,
        PlacementStatus.CANCELLED,
      ],
      [PlacementStatus.BOUND]: [],
      [PlacementStatus.DECLINED]: [PlacementStatus.MARKETING],
      [PlacementStatus.CANCELLED]: [],
    };

    if (!allowed[from].includes(to)) {
      throw new BadRequestException(
        `Cannot move placement from ${from} to ${to}`,
      );
    }
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
        sharePercent: participant.sharePercent,
        signedLinePercent: participant.signedLinePercent,
        notes: this.cleanOptional(participant.notes),
      })),
    };
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
    classCode: string | undefined | null,
    businessDetails: Record<string, unknown> | undefined,
    offerDetails: Record<string, unknown> | undefined,
  ): Promise<void> {
    if (!classCode) return;

    const bc = await this.prisma.businessClass.findFirst({
      where: { tenantId, code: classCode, archivedAt: null, isActive: true },
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

    if (!bc || !bc.fields.length) return;

    const bdFields = bc.fields.filter(
      (f) => f.section === BusinessClassFieldSection.BUSINESS_DETAILS,
    );
    const odFields = bc.fields.filter(
      (f) => f.section === BusinessClassFieldSection.OFFER_DETAILS,
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
      fieldType: BusinessClassFieldType;
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
        case BusinessClassFieldType.NUMBER:
          if (typeof value !== 'number') {
            throw new BadRequestException(
              `Field '${field.fieldKey}' must be a number`,
            );
          }
          break;
        case BusinessClassFieldType.CHECKBOX:
          if (typeof value !== 'boolean') {
            throw new BadRequestException(
              `Field '${field.fieldKey}' must be a boolean`,
            );
          }
          break;
        case BusinessClassFieldType.TEXT:
        case BusinessClassFieldType.TEXTAREA:
          if (typeof value !== 'string') {
            throw new BadRequestException(
              `Field '${field.fieldKey}' must be a string`,
            );
          }
          break;
        case BusinessClassFieldType.DATE:
          if (typeof value !== 'string' || isNaN(Date.parse(value))) {
            throw new BadRequestException(
              `Field '${field.fieldKey}' must be a valid ISO date string`,
            );
          }
          break;
        case BusinessClassFieldType.SELECT: {
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
