import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementClaimAllocationStatus,
  PlacementClaimStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimAllocationCalculator } from './claim-allocation.calculator';
import { ClosingSnapshot } from './closing-snapshot.reader';
import { CreatePlacementClaimDto } from './dto/create-placement-claim.dto';
import { UpdatePlacementClaimStatusDto } from './dto/update-placement-claim-status.dto';
import { UpdatePlacementClaimDto } from './dto/update-placement-claim.dto';
import { PlacementEffectivePositionService } from './placement-effective-position.service';
import { PlacementEffectiveViewService } from './placement-effective-view.service';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';

const claimAllocationInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
  placementClosing: {
    select: {
      id: true,
      closingNumber: true,
    },
  },
  endorsementClosing: {
    select: {
      id: true,
      closingNumber: true,
    },
  },
} satisfies Prisma.PlacementClaimAllocationInclude;

type PlacementClaimRecord = Prisma.PlacementClaimGetPayload<object>;

type PlacementClaimAllocationRecord =
  Prisma.PlacementClaimAllocationGetPayload<{
    include: typeof claimAllocationInclude;
  }>;

@Injectable()
export class PlacementClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectivePositionService: PlacementEffectivePositionService,
    private readonly effectiveViewService: PlacementEffectiveViewService,
    private readonly claimAllocationCalculator: ClaimAllocationCalculator,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async findAll(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementClaimRecord[]> {
    await this.assertPlacement(tenantId, placementId);
    return this.prisma.placementClaim.findMany({
      where: { tenantId, placementId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<PlacementClaimRecord> {
    await this.assertPlacement(tenantId, placementId);
    const claim = await this.prisma.placementClaim.findFirst({
      where: { id: claimId, tenantId, placementId },
    });
    if (!claim) throw new NotFoundException('Placement claim not found');
    return claim;
  }

  async create(
    user: RequestUser,
    placementId: string,
    dto: CreatePlacementClaimDto,
  ): Promise<PlacementClaimRecord> {
    const placement = await this.findPlacement(user.tenantId, placementId);
    const currency = this.cleanCurrency(dto.currency);
    const occurrenceDate = new Date(dto.occurrenceDate);
    await this.validateClaimAgainstEffectiveTerms({
      tenantId: user.tenantId,
      placementId,
      placementCurrency: placement.currency,
      occurrenceDate,
      currency,
      estimatedLossAmount: dto.estimatedLossAmount,
      finalLossAmount:
        dto.finalLossAmount === undefined ? null : dto.finalLossAmount,
    });

    return this.prisma.$transaction(async (tx) => {
      const claimNumber = await this.nextClaimNumber(
        tx,
        user.tenantId,
        placementId,
      );
      const finalLossAmount =
        dto.finalLossAmount === undefined ? null : dto.finalLossAmount;
      const now = new Date();

      return tx.placementClaim.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          claimNumber,
          status: PlacementClaimStatus.DRAFT,
          occurrenceDate,
          reportedDate: new Date(dto.reportedDate),
          claimCause: this.cleanRequired(dto.claimCause),
          occurrenceDetails: this.cleanOptional(dto.occurrenceDetails),
          currency,
          estimatedLossAmount: dto.estimatedLossAmount,
          finalLossAmount,
          finalizedAt: finalLossAmount === null ? null : now,
          finalizedByUserId: finalLossAmount === null ? null : user.id,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    });
  }

  async update(
    user: RequestUser,
    placementId: string,
    claimId: string,
    dto: UpdatePlacementClaimDto,
  ): Promise<PlacementClaimRecord> {
    const claim = await this.findOne(user.tenantId, placementId, claimId);
    this.assertEditable(claim.status);
    const placement = await this.findPlacement(user.tenantId, placementId);

    const currency =
      dto.currency === undefined
        ? claim.currency
        : this.cleanCurrency(dto.currency);
    const occurrenceDate =
      dto.occurrenceDate === undefined
        ? claim.occurrenceDate
        : new Date(dto.occurrenceDate);
    const estimatedLossAmount =
      dto.estimatedLossAmount === undefined
        ? this.money.toNumber(claim.estimatedLossAmount)
        : dto.estimatedLossAmount;

    const finalLossAmount =
      dto.finalLossAmount === undefined ? undefined : dto.finalLossAmount;
    const effectiveFinalLossAmount =
      finalLossAmount === undefined
        ? this.money.toOptionalNumber(claim.finalLossAmount)
        : finalLossAmount;

    await this.assertNoAllocationSensitiveChanges(
      user.tenantId,
      placementId,
      claimId,
      dto,
    );
    await this.validateClaimAgainstEffectiveTerms({
      tenantId: user.tenantId,
      placementId,
      placementCurrency: placement.currency,
      occurrenceDate,
      currency,
      estimatedLossAmount,
      finalLossAmount: effectiveFinalLossAmount,
    });
    const now = new Date();

    return this.prisma.placementClaim.update({
      where: { id: claimId },
      data: {
        ...(dto.occurrenceDate === undefined ? {} : { occurrenceDate }),
        ...(dto.reportedDate === undefined
          ? {}
          : { reportedDate: new Date(dto.reportedDate) }),
        ...(dto.claimCause === undefined
          ? {}
          : { claimCause: this.cleanRequired(dto.claimCause) }),
        ...(dto.occurrenceDetails === undefined
          ? {}
          : { occurrenceDetails: this.cleanOptional(dto.occurrenceDetails) }),
        ...(dto.currency === undefined ? {} : { currency }),
        ...(dto.estimatedLossAmount === undefined
          ? {}
          : { estimatedLossAmount: dto.estimatedLossAmount }),
        ...(finalLossAmount === undefined
          ? {}
          : {
              finalLossAmount,
              finalizedAt: now,
              finalizedByUserId: user.id,
            }),
        updatedByUserId: user.id,
      },
    });
  }

  async changeStatus(
    user: RequestUser,
    placementId: string,
    claimId: string,
    dto: UpdatePlacementClaimStatusDto,
  ): Promise<PlacementClaimRecord> {
    const claim = await this.findOne(user.tenantId, placementId, claimId);
    if (claim.status === dto.status) return claim;
    this.assertStatusTransition(claim.status, dto.status);

    const now = new Date();
    return this.prisma.placementClaim.update({
      where: { id: claimId },
      data: {
        status: dto.status,
        updatedByUserId: user.id,
        ...(dto.status === PlacementClaimStatus.CLOSED
          ? { closedAt: now }
          : {}),
        ...(dto.status === PlacementClaimStatus.VOID ? { voidedAt: now } : {}),
      },
    });
  }

  async findAllocations(
    tenantId: string,
    placementId: string,
    claimId: string,
  ): Promise<PlacementClaimAllocationRecord[]> {
    await this.findOne(tenantId, placementId, claimId);
    return this.prisma.placementClaimAllocation.findMany({
      where: { tenantId, placementId, claimId },
      include: claimAllocationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateAllocations(
    user: RequestUser,
    placementId: string,
    claimId: string,
  ): Promise<PlacementClaimAllocationRecord[]> {
    const claim = await this.findOne(user.tenantId, placementId, claimId);
    if (
      claim.status === PlacementClaimStatus.CLOSED ||
      claim.status === PlacementClaimStatus.VOID
    ) {
      throw new BadRequestException(
        'Cannot generate allocations for terminal claims',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.placementClaimAllocation.findFirst({
        where: { tenantId: user.tenantId, placementId, claimId },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          'Claim allocations have already been generated',
        );
      }

      const effectivePosition =
        await this.effectivePositionService.getEffectivePositionAtDate(
          tx,
          user.tenantId,
          placementId,
          claim.occurrenceDate,
        );
      const snapshots = effectivePosition.snapshots;

      const estimatedLossAmount = this.money.toNumber(
        claim.estimatedLossAmount,
      );
      const finalLossAmount = this.money.toOptionalNumber(
        claim.finalLossAmount,
      );

      const data: Prisma.PlacementClaimAllocationCreateManyInput[] =
        snapshots.map((snapshot) =>
          this.buildAllocation({
            tenantId: user.tenantId,
            placementId,
            claimId,
            snapshot,
            estimatedLossAmount,
            finalLossAmount,
          }),
        );

      if (data.length === 0) {
        throw new BadRequestException(
          'At least one confirmed closing is required before generating claim allocations',
        );
      }

      await tx.placementClaimAllocation.createMany({ data });
      return tx.placementClaimAllocation.findMany({
        where: { tenantId: user.tenantId, placementId, claimId },
        include: claimAllocationInclude,
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  private async findPlacement(tenantId: string, placementId: string) {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: {
        id: true,
        currency: true,
      },
    });
    if (!placement) throw new NotFoundException('Placement not found');
    return placement;
  }

  private async assertPlacement(
    tenantId: string,
    placementId: string,
  ): Promise<void> {
    await this.findPlacement(tenantId, placementId);
  }

  private async nextClaimNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ): Promise<string> {
    const count = await tx.placementClaim.count({
      where: {
        tenantId,
        placementId,
        claimNumber: { startsWith: 'CLM-' },
      },
    });
    return `CLM-${String(count + 1).padStart(3, '0')}`;
  }

  private assertStatusTransition(
    from: PlacementClaimStatus,
    to: PlacementClaimStatus,
  ): void {
    const allowed: Record<PlacementClaimStatus, PlacementClaimStatus[]> = {
      [PlacementClaimStatus.DRAFT]: [
        PlacementClaimStatus.NOTIFIED,
        PlacementClaimStatus.DECLINED,
        PlacementClaimStatus.VOID,
      ],
      [PlacementClaimStatus.NOTIFIED]: [
        PlacementClaimStatus.RESERVED,
        PlacementClaimStatus.DECLINED,
        PlacementClaimStatus.VOID,
      ],
      [PlacementClaimStatus.RESERVED]: [
        PlacementClaimStatus.PARTIALLY_SETTLED,
        PlacementClaimStatus.DECLINED,
      ],
      [PlacementClaimStatus.PARTIALLY_SETTLED]: [PlacementClaimStatus.SETTLED],
      [PlacementClaimStatus.SETTLED]: [PlacementClaimStatus.CLOSED],
      [PlacementClaimStatus.DECLINED]: [],
      [PlacementClaimStatus.CLOSED]: [],
      [PlacementClaimStatus.VOID]: [],
    };

    if (!allowed[from].includes(to)) {
      throw new BadRequestException(`Cannot move claim from ${from} to ${to}`);
    }
  }

  private assertEditable(status: PlacementClaimStatus): void {
    const editableStatuses: PlacementClaimStatus[] = [
      PlacementClaimStatus.DRAFT,
      PlacementClaimStatus.NOTIFIED,
      PlacementClaimStatus.RESERVED,
    ];
    if (!editableStatuses.includes(status)) {
      throw new BadRequestException(`Cannot edit claim while it is ${status}`);
    }
  }

  private buildAllocation(input: {
    tenantId: string;
    placementId: string;
    claimId: string;
    snapshot: ClosingSnapshot;
    estimatedLossAmount: number;
    finalLossAmount: number | null;
  }): Prisma.PlacementClaimAllocationCreateManyInput {
    const calculation = this.claimAllocationCalculator.calculateFromSnapshot({
      estimatedLossAmount: input.estimatedLossAmount,
      finalLossAmount: input.finalLossAmount,
      signedLinePercent: input.snapshot.signedLinePercent,
    });

    return {
      tenantId: input.tenantId,
      placementId: input.placementId,
      claimId: input.claimId,
      ...(input.snapshot.sourceType === 'PLACEMENT_CLOSING'
        ? {
            placementClosingId: input.snapshot.closingId,
            participantId: input.snapshot.participantId,
          }
        : {
            endorsementClosingId: input.snapshot.closingId,
            endorsementParticipantId: input.snapshot.endorsementParticipantId,
          }),
      counterpartyId: input.snapshot.counterpartyId,
      signedLinePercent: input.snapshot.signedLinePercent,
      ...calculation,
      cashCallAmount: null,
      paidAmount: null,
      status: PlacementClaimAllocationStatus.DRAFT,
    };
  }

  private assertClaimCurrency(
    effectiveCurrency: string | null,
    placementCurrency: string | null,
    claimCurrency: string,
  ): void {
    const expectedCurrency = effectiveCurrency ?? placementCurrency;
    if (expectedCurrency && claimCurrency !== expectedCurrency) {
      throw new BadRequestException(
        'Claim currency must match the effective placement currency on the loss date',
      );
    }
  }

  private async assertNoAllocationSensitiveChanges(
    tenantId: string,
    placementId: string,
    claimId: string,
    dto: UpdatePlacementClaimDto,
  ): Promise<void> {
    const allocationSensitiveFields: Array<keyof UpdatePlacementClaimDto> = [
      'occurrenceDate',
      'currency',
      'estimatedLossAmount',
      'finalLossAmount',
    ];
    if (
      !allocationSensitiveFields.some((field) =>
        Object.prototype.hasOwnProperty.call(dto, field),
      )
    ) {
      return;
    }

    const existingAllocation =
      await this.prisma.placementClaimAllocation.findFirst({
        where: { tenantId, placementId, claimId },
        select: { id: true },
      });
    if (existingAllocation) {
      throw new ConflictException(
        'Claim occurrence date, currency and loss amounts cannot be changed after allocations have been generated. Void/reallocate through an explicit claims review workflow.',
      );
    }
  }

  private async validateClaimAgainstEffectiveTerms(input: {
    tenantId: string;
    placementId: string;
    placementCurrency: string | null;
    occurrenceDate: Date;
    currency: string;
    estimatedLossAmount: number;
    finalLossAmount: number | null;
  }): Promise<void> {
    const effectiveView = await this.effectiveViewService.getEffectiveView(
      input.tenantId,
      input.placementId,
      input.occurrenceDate,
    );
    const terms = effectiveView.effectiveTerms;
    this.assertClaimCurrency(
      terms.currency,
      input.placementCurrency,
      input.currency,
    );

    const occurrenceDay = this.toUtcDateKey(input.occurrenceDate);
    if (terms.inceptionDate) {
      const inceptionDay = this.toUtcDateKey(new Date(terms.inceptionDate));
      if (occurrenceDay < inceptionDay) {
        throw new BadRequestException(
          'Claim occurrence date cannot be before the effective coverage inception date',
        );
      }
    }
    if (terms.expiryDate) {
      const expiryDay = this.toUtcDateKey(new Date(terms.expiryDate));
      if (occurrenceDay > expiryDay) {
        throw new BadRequestException(
          'Claim occurrence date cannot be after the effective coverage expiry date',
        );
      }
    }

    if (terms.sumInsured != null) {
      this.assertLossAmountWithinEffectiveLimit(
        input.estimatedLossAmount,
        terms.sumInsured,
        'Estimated loss amount',
      );
      if (input.finalLossAmount != null) {
        this.assertLossAmountWithinEffectiveLimit(
          input.finalLossAmount,
          terms.sumInsured,
          'Final loss amount',
        );
      }
    }
  }

  private assertLossAmountWithinEffectiveLimit(
    amount: number,
    effectiveSumInsured: number,
    label: string,
  ): void {
    if (amount > effectiveSumInsured) {
      throw new BadRequestException(
        `${label} cannot exceed the effective sum insured on the loss date`,
      );
    }
  }

  private toUtcDateKey(date: Date): number {
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    );
  }

  private cleanCurrency(value: string): string {
    return this.cleanRequired(value).toUpperCase();
  }

  private cleanRequired(value: string): string {
    const cleaned = value.trim();
    if (!cleaned) throw new BadRequestException('Required text is missing');
    return cleaned;
  }

  private cleanOptional(value: string | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }
}
