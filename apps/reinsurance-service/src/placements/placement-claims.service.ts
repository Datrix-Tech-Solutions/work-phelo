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
import {
  ClosingSnapshot,
  ClosingSnapshotReader,
} from './closing-snapshot.reader';
import { CreatePlacementClaimDto } from './dto/create-placement-claim.dto';
import { UpdatePlacementClaimStatusDto } from './dto/update-placement-claim-status.dto';
import { UpdatePlacementClaimDto } from './dto/update-placement-claim.dto';
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
    private readonly closingSnapshotReader: ClosingSnapshotReader,
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
    this.assertClaimCurrency(placement.currency, currency);

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
          occurrenceDate: new Date(dto.occurrenceDate),
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
      dto.currency === undefined ? undefined : this.cleanCurrency(dto.currency);
    if (currency !== undefined) {
      this.assertClaimCurrency(placement.currency, currency);
    }

    const finalLossAmount =
      dto.finalLossAmount === undefined ? undefined : dto.finalLossAmount;
    const now = new Date();

    return this.prisma.placementClaim.update({
      where: { id: claimId },
      data: {
        ...(dto.occurrenceDate === undefined
          ? {}
          : { occurrenceDate: new Date(dto.occurrenceDate) }),
        ...(dto.reportedDate === undefined
          ? {}
          : { reportedDate: new Date(dto.reportedDate) }),
        ...(dto.claimCause === undefined
          ? {}
          : { claimCause: this.cleanRequired(dto.claimCause) }),
        ...(dto.occurrenceDetails === undefined
          ? {}
          : { occurrenceDetails: this.cleanOptional(dto.occurrenceDetails) }),
        ...(currency === undefined ? {} : { currency }),
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

      const snapshots = await this.closingSnapshotReader.findConfirmedSnapshots(
        tx,
        user.tenantId,
        placementId,
      );

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
    placementCurrency: string | null,
    claimCurrency: string,
  ): void {
    if (placementCurrency && claimCurrency !== placementCurrency) {
      throw new BadRequestException(
        'Claim currency must match placement currency',
      );
    }
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
