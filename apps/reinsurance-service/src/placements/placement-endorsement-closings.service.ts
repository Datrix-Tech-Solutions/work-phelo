import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementClosingStatus,
  PlacementEndorsementImpactType,
  PlacementEndorsementParticipantStatus,
  PlacementEndorsementStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlacementEndorsementClosingStatusDto } from './dto/update-placement-endorsement-closing-status.dto';
import { PlacementEndorsementSummaryResponseDto } from './dto/placement-endorsement-summary-response.dto';
import { PlacementEndorsementsService } from './placement-endorsements.service';

const endorsementClosingInclude = {
  endorsementParticipant: {
    include: {
      counterparty: {
        select: {
          id: true,
          name: true,
          registrationNumber: true,
        },
      },
    },
  },
} satisfies Prisma.PlacementEndorsementClosingInclude;

type EndorsementClosingRecord = Prisma.PlacementEndorsementClosingGetPayload<{
  include: typeof endorsementClosingInclude;
}>;

const endorsementParticipantInclude = {
  counterparty: {
    select: {
      id: true,
      name: true,
      registrationNumber: true,
    },
  },
} satisfies Prisma.PlacementEndorsementParticipantInclude;

type EndorsementParticipantRecord =
  Prisma.PlacementEndorsementParticipantGetPayload<{
    include: typeof endorsementParticipantInclude;
  }>;

type EndorsementForClosing = {
  id: string;
  tenantId: string;
  placementId: string;
  impactType: PlacementEndorsementImpactType;
  status: PlacementEndorsementStatus;
  effectiveDate: Date;
  createdAt: Date;
  targetPercent: Prisma.Decimal | null;
  originalSnapshot: Prisma.JsonValue;
  proposedSnapshot: Prisma.JsonValue | null;
};

type EndorsementSnapshotSource = {
  impactType: PlacementEndorsementImpactType;
  premium: number;
  sumInsured: number | null;
  commission: number | null;
  brokeragePercent: number | null;
  currency: string | null;
  originalPremium: number | null;
  revisedPremium: number | null;
  originalSumInsured: number | null;
  revisedSumInsured: number | null;
  policyInceptionDate: Date | null;
  policyExpiryDate: Date | null;
  endorsementEffectiveDate: Date;
  flatNonRefundableDeductions: number;
  flatRefundableAmounts: number;
  originalParticipants: Array<Record<string, unknown>>;
};

type PriorEndorsementForSnapshotBasis = {
  id: string;
  impactType: PlacementEndorsementImpactType;
  status: PlacementEndorsementStatus;
  effectiveDate: Date;
  createdAt: Date;
  proposedSnapshot: Prisma.JsonValue | null;
  closings: Array<{
    status: PlacementClosingStatus;
    signedLinePercent: Prisma.Decimal;
    endorsementParticipant: {
      originalParticipantId: string | null;
      counterpartyId: string;
    };
  }>;
};

type EndorsementSnapshotBasis = {
  premium: number | null;
  sumInsured: number | null;
  commission: number | null;
  brokeragePercent: number | null;
  currency: string | null;
  participants: Array<Record<string, unknown>>;
};

type EndorsementFinancialImpactSnapshot = {
  impactType: PlacementEndorsementImpactType;
  calculationType: 'ADDITIONAL_PREMIUM' | 'RETURN_PREMIUM';
  dateBoundaryConvention: 'START_INCLUSIVE_EXPIRY_EXCLUSIVE';
  policyInceptionDate: string | null;
  policyExpiryDate: string | null;
  endorsementEffectiveDate: string;
  totalPolicyDays: number | null;
  earnedDays: number | null;
  unearnedDays: number | null;
  earnedFraction: number;
  unearnedFraction: number;
  originalPremium: number | null;
  revisedPremium: number | null;
  premiumReduction: number;
  refundableProRataAmount: number;
  flatNonRefundableDeductions: number;
  flatRefundableAmounts: number;
  grossReturnPremium: number;
  taxesAndLeviesAdjustment: number;
  netReturnPremium: number;
  originalLinePercent: number | null;
  revisedLinePercent: number;
  impactLinePercent: number;
  effectivePremiumSnapshot: number;
  effectiveCommissionAmount: number;
  effectiveBrokerageAmount: number;
  effectiveNetPremium: number;
  signedPremiumImpact: number;
  signedCommissionImpact: number;
  signedBrokerageImpact: number;
  signedNetPremiumImpact: number;
};

export type ValidateEndorsementParticipantResult = {
  participant: EndorsementParticipantRecord;
  closing: EndorsementClosingRecord;
  summary: PlacementEndorsementSummaryResponseDto;
  effectiveStatus: PlacementEndorsementStatus;
};

@Injectable()
export class PlacementEndorsementClosingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly endorsementsService: PlacementEndorsementsService,
  ) {}

  async findAll(
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<EndorsementClosingRecord[]> {
    await this.findEndorsement(tenantId, placementId, endorsementId);
    return this.prisma.placementEndorsementClosing.findMany({
      where: { tenantId, placementId, endorsementId },
      include: endorsementClosingInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    placementId: string,
    endorsementId: string,
    closingId: string,
  ): Promise<EndorsementClosingRecord> {
    await this.findEndorsement(tenantId, placementId, endorsementId);
    const closing = await this.prisma.placementEndorsementClosing.findFirst({
      where: { id: closingId, tenantId, placementId, endorsementId },
      include: endorsementClosingInclude,
    });
    if (!closing) {
      throw new NotFoundException('Placement endorsement closing not found');
    }
    return closing;
  }

  async create(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    participantId: string,
  ): Promise<EndorsementClosingRecord> {
    const endorsement = await this.findEndorsement(
      user.tenantId,
      placementId,
      endorsementId,
    );
    this.assertEndorsementCanClose(endorsement);

    const participant =
      await this.prisma.placementEndorsementParticipant.findFirst({
        where: {
          id: participantId,
          tenantId: user.tenantId,
          placementId,
          endorsementId,
        },
        include: {
          counterparty: {
            select: {
              id: true,
              name: true,
              registrationNumber: true,
            },
          },
        },
      });
    if (!participant) {
      throw new NotFoundException(
        'Placement endorsement participant not found',
      );
    }

    if (participant.status !== PlacementEndorsementParticipantStatus.ACCEPTED) {
      throw new BadRequestException(
        'Endorsement closing can only be created for accepted endorsement participants',
      );
    }

    const signedLinePercent = this.toNumber(participant.signedLinePercent);
    const sharePercent = this.toOptionalNumber(participant.sharePercent);
    if (signedLinePercent < 0 || signedLinePercent > 100) {
      throw new BadRequestException(
        'Endorsement participant signed line percentage must be at least zero and at most 100',
      );
    }
    if (
      signedLinePercent === 0 &&
      endorsement.impactType !==
        PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION
    ) {
      throw new BadRequestException(
        'Endorsement participant signed line percentage must be greater than zero',
      );
    }
    if (sharePercent !== null && signedLinePercent > sharePercent) {
      throw new BadRequestException(
        'Endorsement participant signed line percentage cannot exceed offered share percentage',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existingActive = await tx.placementEndorsementClosing.findFirst({
        where: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          endorsementParticipantId: participantId,
          status: { not: PlacementClosingStatus.VOID },
        },
      });
      if (existingActive) {
        throw new ConflictException(
          'An active endorsement closing already exists for this endorsement participant',
        );
      }

      const snapshotSource = await this.buildSnapshotSource(tx, endorsement);
      const snapshot = this.computeSnapshot(
        snapshotSource,
        participant,
        signedLinePercent,
      );
      const count = await tx.placementEndorsementClosing.count({
        where: { tenantId: user.tenantId, placementId },
      });
      const closingNumber = `ENC-${String(count + 1).padStart(3, '0')}`;

      return tx.placementEndorsementClosing.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          endorsementParticipantId: participantId,
          closingNumber,
          status: PlacementClosingStatus.DRAFT,
          createdByUserId: user.id,
          ...snapshot,
        },
        include: endorsementClosingInclude,
      });
    });
  }

  async validateAndConfirm(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    participantId: string,
  ): Promise<ValidateEndorsementParticipantResult> {
    let result:
      | {
          participant: EndorsementParticipantRecord;
          closing: EndorsementClosingRecord;
        }
      | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        result = await this.prisma.$transaction(
          async (tx) =>
            this.validateAndConfirmInTransaction(
              tx,
              user,
              placementId,
              endorsementId,
              participantId,
            ),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (error) {
        if (
          attempt === 0 &&
          (this.isSerializableTransactionConflict(error) ||
            this.isUniqueConstraintConflict(error))
        ) {
          continue;
        }
        this.rethrowControlledPrismaError(error);
        throw error;
      }
    }

    if (!result) {
      throw new ConflictException(
        'Could not complete endorsement participant validation workflow',
      );
    }

    const participant = await this.findValidatedParticipant(
      user.tenantId,
      placementId,
      endorsementId,
      result.participant.id,
    );
    const closing = await this.findOne(
      user.tenantId,
      placementId,
      endorsementId,
      result.closing.id,
    );
    const summary = await this.endorsementsService.getSummary(
      user.tenantId,
      placementId,
      endorsementId,
    );

    return {
      participant,
      closing,
      summary,
      effectiveStatus: this.deriveEffectiveStatus(summary),
    };
  }

  private async findValidatedParticipant(
    tenantId: string,
    placementId: string,
    endorsementId: string,
    participantId: string,
  ): Promise<EndorsementParticipantRecord> {
    const participant =
      await this.prisma.placementEndorsementParticipant.findFirst({
        where: {
          id: participantId,
          tenantId,
          placementId,
          endorsementId,
        },
        include: endorsementParticipantInclude,
      });
    if (!participant) {
      throw new NotFoundException(
        'Placement endorsement participant not found',
      );
    }
    return participant;
  }

  private async validateAndConfirmInTransaction(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    participantId: string,
  ): Promise<{
    participant: EndorsementParticipantRecord;
    closing: EndorsementClosingRecord;
  }> {
    const endorsement = await this.findEndorsementInTransaction(
      tx,
      user.tenantId,
      placementId,
      endorsementId,
    );
    this.assertEndorsementCanValidate(endorsement);

    const participant = await tx.placementEndorsementParticipant.findFirst({
      where: {
        id: participantId,
        tenantId: user.tenantId,
        placementId,
        endorsementId,
      },
      include: endorsementParticipantInclude,
    });
    if (!participant) {
      throw new NotFoundException(
        'Placement endorsement participant not found',
      );
    }

    const existingActive = await tx.placementEndorsementClosing.findFirst({
      where: {
        tenantId: user.tenantId,
        placementId,
        endorsementId,
        endorsementParticipantId: participantId,
        status: { not: PlacementClosingStatus.VOID },
      },
      include: endorsementClosingInclude,
      orderBy: { createdAt: 'desc' },
    });

    if (participant.status === PlacementEndorsementParticipantStatus.CLOSED) {
      if (existingActive?.status === PlacementClosingStatus.CONFIRMED) {
        return { participant, closing: existingActive };
      }
      throw new ConflictException(
        'Endorsement participant is already closed without a confirmed active endorsement closing',
      );
    }

    if (participant.status === PlacementEndorsementParticipantStatus.DECLINED) {
      throw new ConflictException(
        'Declined endorsement participants cannot be validated',
      );
    }

    if (participant.status !== PlacementEndorsementParticipantStatus.ACCEPTED) {
      throw new BadRequestException(
        'Endorsement participant must be ACCEPTED before validation',
      );
    }

    const signedLinePercent = this.toNumber(participant.signedLinePercent);
    const sharePercent = this.toOptionalNumber(participant.sharePercent);
    if (signedLinePercent < 0 || signedLinePercent > 100) {
      throw new BadRequestException(
        'Endorsement participant signed line percentage must be at least zero and at most 100',
      );
    }
    if (
      signedLinePercent === 0 &&
      endorsement.impactType !==
        PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION
    ) {
      throw new BadRequestException(
        'Endorsement participant signed line percentage must be greater than zero',
      );
    }
    if (sharePercent !== null && signedLinePercent > sharePercent) {
      throw new BadRequestException(
        'Endorsement participant signed line percentage cannot exceed offered share percentage',
      );
    }
    if (
      endorsement.impactType !==
      PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION
    ) {
      await this.assertAcceptedCapacityWithinTarget(
        tx,
        user.tenantId,
        endorsementId,
        endorsement.targetPercent,
        signedLinePercent,
        participantId,
      );
    }

    let closing = existingActive;
    if (!closing) {
      const snapshotSource = await this.buildSnapshotSource(tx, endorsement);
      const snapshot = this.computeSnapshot(
        snapshotSource,
        participant,
        signedLinePercent,
      );
      const count = await tx.placementEndorsementClosing.count({
        where: { tenantId: user.tenantId, placementId },
      });
      const closingNumber = `ENC-${String(count + 1).padStart(3, '0')}`;

      closing = await tx.placementEndorsementClosing.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          endorsementParticipantId: participantId,
          closingNumber,
          status: PlacementClosingStatus.DRAFT,
          createdByUserId: user.id,
          ...snapshot,
        },
        include: endorsementClosingInclude,
      });
    }

    closing = await this.issueAndConfirmClosing(tx, closing);

    const closedParticipant = await tx.placementEndorsementParticipant.update({
      where: { id: participantId },
      data: { status: PlacementEndorsementParticipantStatus.CLOSED },
      include: endorsementParticipantInclude,
    });

    return { participant: closedParticipant, closing };
  }

  async changeStatus(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    closingId: string,
    dto: UpdatePlacementEndorsementClosingStatusDto,
  ): Promise<EndorsementClosingRecord> {
    const closing = await this.findOne(
      user.tenantId,
      placementId,
      endorsementId,
      closingId,
    );
    if (closing.status === dto.status) return closing;
    this.assertStatusTransition(closing.status, dto.status);

    const now = new Date();
    return this.prisma.placementEndorsementClosing.update({
      where: { id: closingId },
      data: {
        status: dto.status,
        ...(dto.status === PlacementClosingStatus.ISSUED
          ? { issuedAt: now }
          : {}),
        ...(dto.status === PlacementClosingStatus.CONFIRMED
          ? { confirmedAt: now }
          : {}),
      },
      include: endorsementClosingInclude,
    });
  }

  private async findEndorsement(
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<EndorsementForClosing> {
    const endorsement = await this.prisma.placementEndorsement.findFirst({
      where: {
        id: endorsementId,
        tenantId,
        placementId,
        placement: { archivedAt: null },
      },
      select: {
        id: true,
        tenantId: true,
        placementId: true,
        impactType: true,
        status: true,
        effectiveDate: true,
        createdAt: true,
        targetPercent: true,
        originalSnapshot: true,
        proposedSnapshot: true,
      },
    });
    if (!endorsement) {
      throw new NotFoundException('Placement endorsement not found');
    }
    return endorsement;
  }

  private async findEndorsementInTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<EndorsementForClosing> {
    const placement = await tx.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: { id: true },
    });
    if (!placement) {
      throw new NotFoundException('Placement not found');
    }

    const endorsement = await tx.placementEndorsement.findFirst({
      where: {
        id: endorsementId,
        tenantId,
        placementId,
      },
      select: {
        id: true,
        tenantId: true,
        placementId: true,
        impactType: true,
        status: true,
        effectiveDate: true,
        createdAt: true,
        targetPercent: true,
        originalSnapshot: true,
        proposedSnapshot: true,
      },
    });
    if (!endorsement) {
      throw new NotFoundException('Placement endorsement not found');
    }
    return endorsement;
  }

  private assertEndorsementCanClose(endorsement: {
    status: PlacementEndorsementStatus;
  }): void {
    if (endorsement.status === PlacementEndorsementStatus.VOID) {
      throw new BadRequestException(
        'VOID endorsements cannot create endorsement closings',
      );
    }
  }

  private assertEndorsementCanValidate(endorsement: {
    status: PlacementEndorsementStatus;
  }): void {
    const terminalStatuses: PlacementEndorsementStatus[] = [
      PlacementEndorsementStatus.CLOSED,
      PlacementEndorsementStatus.DECLINED,
      PlacementEndorsementStatus.VOID,
    ];
    if (terminalStatuses.includes(endorsement.status)) {
      throw new ConflictException(
        'Terminal endorsements cannot validate endorsement participants',
      );
    }
    if (endorsement.status === PlacementEndorsementStatus.DRAFT) {
      throw new BadRequestException(
        'Endorsement must be sent to market before participant validation',
      );
    }
  }

  private async assertAcceptedCapacityWithinTarget(
    tx: Prisma.TransactionClient,
    tenantId: string,
    endorsementId: string,
    targetPercent: Prisma.Decimal | null,
    signedLinePercent: number,
    participantId: string,
  ): Promise<void> {
    if (!targetPercent) return;
    const acceptedParticipants =
      await tx.placementEndorsementParticipant.findMany({
        where: {
          tenantId,
          endorsementId,
          status: {
            in: [
              PlacementEndorsementParticipantStatus.ACCEPTED,
              PlacementEndorsementParticipantStatus.CLOSED,
            ],
          },
          id: { not: participantId },
        },
        select: { signedLinePercent: true },
      });
    const currentAccepted = acceptedParticipants.reduce(
      (sum, item) => sum + (this.toOptionalNumber(item.signedLinePercent) ?? 0),
      0,
    );
    if (currentAccepted + signedLinePercent > targetPercent.toNumber()) {
      throw new BadRequestException(
        'Accepted endorsement signed lines cannot exceed targetPercent',
      );
    }
  }

  private async issueAndConfirmClosing(
    tx: Prisma.TransactionClient,
    closing: EndorsementClosingRecord,
  ): Promise<EndorsementClosingRecord> {
    const now = new Date();
    if (closing.status === PlacementClosingStatus.CONFIRMED) {
      return closing;
    }
    if (closing.status === PlacementClosingStatus.VOID) {
      throw new ConflictException(
        'VOID endorsement closings cannot be validated',
      );
    }

    let current = closing;
    if (current.status === PlacementClosingStatus.DRAFT) {
      current = await tx.placementEndorsementClosing.update({
        where: { id: current.id },
        data: {
          status: PlacementClosingStatus.ISSUED,
          issuedAt: current.issuedAt ?? now,
        },
        include: endorsementClosingInclude,
      });
    }

    if (current.status === PlacementClosingStatus.ISSUED) {
      current = await tx.placementEndorsementClosing.update({
        where: { id: current.id },
        data: {
          status: PlacementClosingStatus.CONFIRMED,
          confirmedAt: current.confirmedAt ?? now,
        },
        include: endorsementClosingInclude,
      });
    }

    if (current.status !== PlacementClosingStatus.CONFIRMED) {
      throw new BadRequestException(
        `Cannot validate endorsement closing from ${current.status}`,
      );
    }
    return current;
  }

  private deriveEffectiveStatus(
    summary: PlacementEndorsementSummaryResponseDto,
  ): PlacementEndorsementStatus {
    if (summary.status === PlacementEndorsementStatus.CLOSED) {
      return PlacementEndorsementStatus.CLOSED;
    }
    if (summary.pendingActions.includes('CLOSE_ENDORSEMENT')) {
      return PlacementEndorsementStatus.CLOSING;
    }
    if (summary.closings.confirmed > 0) {
      return PlacementEndorsementStatus.CLOSING;
    }
    return summary.status;
  }

  private assertStatusTransition(
    from: PlacementClosingStatus,
    to: PlacementClosingStatus,
  ): void {
    const allowed: Record<PlacementClosingStatus, PlacementClosingStatus[]> = {
      [PlacementClosingStatus.DRAFT]: [
        PlacementClosingStatus.ISSUED,
        PlacementClosingStatus.VOID,
      ],
      [PlacementClosingStatus.ISSUED]: [
        PlacementClosingStatus.CONFIRMED,
        PlacementClosingStatus.VOID,
      ],
      [PlacementClosingStatus.CONFIRMED]: [],
      [PlacementClosingStatus.VOID]: [],
    };

    if (!allowed[from].includes(to)) {
      throw new BadRequestException(
        `Cannot move endorsement closing from ${from} to ${to}`,
      );
    }
  }

  private async buildSnapshotSource(
    tx: Prisma.TransactionClient,
    endorsement: EndorsementForClosing,
  ): Promise<EndorsementSnapshotSource> {
    const proposed = this.asRecord(endorsement.proposedSnapshot);
    const original = this.asRecord(endorsement.originalSnapshot);
    const originalPlacement = this.asRecord(original.placement);
    const proposedPlacement = this.asRecord(proposed.placement);
    const basis = await this.buildPreEndorsementSnapshotBasis(
      tx,
      endorsement,
      originalPlacement,
      original,
    );

    const premium = this.firstNumber(
      proposed.premium,
      proposedPlacement.premium,
      basis.premium,
    );
    if (premium === null) {
      throw new BadRequestException(
        'Endorsement premium snapshot is required before creating an endorsement closing',
      );
    }
    if (
      premium <= 0 &&
      endorsement.impactType !==
        PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION
    ) {
      throw new BadRequestException(
        'Endorsement premium snapshot must be greater than zero before creating an endorsement closing',
      );
    }

    const originalPremium = basis.premium;
    const revisedPremium = this.firstOptionalNumber(
      proposed.premium,
      proposedPlacement.premium,
      basis.premium,
    );

    return {
      impactType: endorsement.impactType,
      premium,
      originalPremium,
      revisedPremium,
      originalSumInsured: basis.sumInsured,
      revisedSumInsured: this.firstOptionalNumber(
        proposed.sumInsured,
        proposedPlacement.sumInsured,
        basis.sumInsured,
      ),
      sumInsured: this.firstOptionalNumber(
        proposed.sumInsured,
        proposedPlacement.sumInsured,
        basis.sumInsured,
      ),
      commission: this.firstOptionalNumber(
        proposed.commission,
        proposedPlacement.commission,
        basis.commission,
      ),
      brokeragePercent: this.firstOptionalNumber(
        proposed.brokeragePercent,
        proposed.preliminaryBrokerage,
        proposedPlacement.brokeragePercent,
        proposedPlacement.preliminaryBrokerage,
        basis.brokeragePercent,
      ),
      currency: this.firstString(
        proposed.currency,
        proposedPlacement.currency,
        basis.currency,
      ),
      policyInceptionDate: this.parseDate(originalPlacement.inceptionDate),
      policyExpiryDate: this.parseDate(originalPlacement.expiryDate),
      endorsementEffectiveDate: endorsement.effectiveDate,
      originalParticipants: basis.participants,
      ...this.extractFlatReturnAdjustments(proposed, proposedPlacement),
    };
  }

  private async buildPreEndorsementSnapshotBasis(
    tx: Prisma.TransactionClient,
    endorsement: EndorsementForClosing,
    originalPlacement: Record<string, unknown>,
    originalSnapshot: Record<string, unknown>,
  ): Promise<EndorsementSnapshotBasis> {
    const basis: EndorsementSnapshotBasis = {
      premium: this.firstOptionalNumber(originalPlacement.premium),
      sumInsured: this.firstOptionalNumber(originalPlacement.sumInsured),
      commission: this.firstOptionalNumber(originalPlacement.commission),
      brokeragePercent: this.firstOptionalNumber(
        originalPlacement.brokeragePercent,
        originalPlacement.preliminaryBrokerage,
      ),
      currency: this.firstString(originalPlacement.currency),
      participants: this.asRecordArray(originalSnapshot.participants),
    };

    const priorEndorsements = await tx.placementEndorsement.findMany({
      where: {
        tenantId: endorsement.tenantId,
        placementId: endorsement.placementId,
        id: { not: endorsement.id },
        status: {
          notIn: [
            PlacementEndorsementStatus.DECLINED,
            PlacementEndorsementStatus.VOID,
          ],
        },
      },
      select: {
        id: true,
        impactType: true,
        status: true,
        effectiveDate: true,
        createdAt: true,
        proposedSnapshot: true,
        closings: {
          where: { status: PlacementClosingStatus.CONFIRMED },
          select: {
            status: true,
            signedLinePercent: true,
            endorsementParticipant: {
              select: {
                originalParticipantId: true,
                counterpartyId: true,
              },
            },
          },
        },
      },
      orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }],
    });

    for (const prior of priorEndorsements) {
      if (!this.isPriorToCurrentEndorsement(prior, endorsement)) continue;
      if (!this.isFinanciallyAppliedPriorEndorsement(prior)) continue;
      this.applyPriorProposedSnapshotToBasis(basis, prior.proposedSnapshot);
      this.applyPriorClosingLinesToBasis(basis, prior.closings);
    }

    return basis;
  }

  private isPriorToCurrentEndorsement(
    prior: { id: string; effectiveDate: Date; createdAt: Date },
    current: EndorsementForClosing,
  ): boolean {
    const priorEffective = this.startOfUtcDay(prior.effectiveDate).getTime();
    const currentEffective = this.startOfUtcDay(
      current.effectiveDate,
    ).getTime();
    if (priorEffective !== currentEffective)
      return priorEffective < currentEffective;
    if (prior.createdAt.getTime() !== current.createdAt.getTime()) {
      return prior.createdAt.getTime() < current.createdAt.getTime();
    }
    return prior.id < current.id;
  }

  private isFinanciallyAppliedPriorEndorsement(
    endorsement: PriorEndorsementForSnapshotBasis,
  ): boolean {
    if (
      endorsement.status === PlacementEndorsementStatus.DECLINED ||
      endorsement.status === PlacementEndorsementStatus.VOID
    ) {
      return false;
    }
    if (
      endorsement.impactType === PlacementEndorsementImpactType.TERMS_ONLY ||
      endorsement.impactType === PlacementEndorsementImpactType.ADMINISTRATIVE
    ) {
      return endorsement.status === PlacementEndorsementStatus.CLOSED;
    }
    return endorsement.closings.length > 0;
  }

  private applyPriorProposedSnapshotToBasis(
    basis: EndorsementSnapshotBasis,
    proposedSnapshot: Prisma.JsonValue | null,
  ): void {
    const proposed = this.asRecord(proposedSnapshot);
    const proposedPlacement = this.asRecord(proposed.placement);

    basis.premium = this.firstOptionalNumber(
      proposed.premium,
      proposedPlacement.premium,
      basis.premium,
    );
    basis.sumInsured = this.firstOptionalNumber(
      proposed.sumInsured,
      proposedPlacement.sumInsured,
      basis.sumInsured,
    );
    basis.commission = this.firstOptionalNumber(
      proposed.commission,
      proposedPlacement.commission,
      basis.commission,
    );
    basis.brokeragePercent = this.firstOptionalNumber(
      proposed.brokeragePercent,
      proposed.preliminaryBrokerage,
      proposedPlacement.brokeragePercent,
      proposedPlacement.preliminaryBrokerage,
      basis.brokeragePercent,
    );
    basis.currency = this.firstString(
      proposed.currency,
      proposedPlacement.currency,
      basis.currency,
    );
  }

  private applyPriorClosingLinesToBasis(
    basis: EndorsementSnapshotBasis,
    closings: PriorEndorsementForSnapshotBasis['closings'],
  ): void {
    for (const closing of closings) {
      const participant = closing.endorsementParticipant;
      const revisedLinePercent = this.toNumber(closing.signedLinePercent);
      const originalParticipantId = participant.originalParticipantId;
      const counterpartyId = participant.counterpartyId;

      const existingIndex = basis.participants.findIndex((item) => {
        if (
          originalParticipantId &&
          typeof item.id === 'string' &&
          item.id === originalParticipantId
        ) {
          return true;
        }
        return (
          typeof item.counterpartyId === 'string' &&
          item.counterpartyId === counterpartyId
        );
      });

      const nextParticipant = {
        ...(existingIndex >= 0 ? basis.participants[existingIndex] : {}),
        id:
          existingIndex >= 0
            ? basis.participants[existingIndex].id
            : (originalParticipantId ?? counterpartyId),
        counterpartyId,
        signedLinePercent: revisedLinePercent,
        sharePercent: revisedLinePercent,
      };

      if (existingIndex >= 0) {
        basis.participants[existingIndex] = nextParticipant;
      } else {
        basis.participants.push(nextParticipant);
      }
    }
  }

  private computeSnapshot(
    source: {
      impactType: PlacementEndorsementImpactType;
      premium: number;
      sumInsured: number | null;
      commission: number | null;
      brokeragePercent: number | null;
      currency: string | null;
      originalPremium?: number | null;
      revisedPremium?: number | null;
      originalSumInsured?: number | null;
      revisedSumInsured?: number | null;
      policyInceptionDate?: Date | null;
      policyExpiryDate?: Date | null;
      endorsementEffectiveDate?: Date;
      flatNonRefundableDeductions?: number;
      flatRefundableAmounts?: number;
    },
    participant: {
      sharePercent: Prisma.Decimal | null;
      signedLinePercent: Prisma.Decimal | null;
      originalParticipantId?: string | null;
    },
    signedLinePercent: number,
  ) {
    if (
      source.impactType ===
      PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION
    ) {
      return this.computeReturnPremiumSnapshot(
        source as EndorsementSnapshotSource,
        participant,
        signedLinePercent,
      );
    }

    const sharePercent = this.toOptionalNumber(participant.sharePercent);
    const commissionPct = source.commission ?? 0;
    const brokeragePct = source.brokeragePercent ?? 0;

    const premiumSnapshot = (signedLinePercent / 100) * source.premium;
    const commissionAmount = (commissionPct / 100) * premiumSnapshot;
    const brokerageAmount = (brokeragePct / 100) * premiumSnapshot;
    const netPremium = premiumSnapshot - commissionAmount - brokerageAmount;

    return {
      signedLinePercent,
      sharePercent,
      sumInsuredSnapshot: source.sumInsured,
      premiumSnapshot,
      commissionPercent: commissionPct,
      commissionAmount,
      brokeragePercent: brokeragePct,
      brokerageAmount,
      netPremium,
      financialImpactSnapshot: {
        impactType: source.impactType,
        calculationType: 'ADDITIONAL_PREMIUM',
        signedPremiumImpact: premiumSnapshot,
        signedCommissionImpact: commissionAmount,
        signedBrokerageImpact: brokerageAmount,
        signedNetPremiumImpact: netPremium,
        effectivePremiumSnapshot: premiumSnapshot,
        effectiveCommissionAmount: commissionAmount,
        effectiveBrokerageAmount: brokerageAmount,
        effectiveNetPremium: netPremium,
      } satisfies Partial<EndorsementFinancialImpactSnapshot>,
      currency: source.currency,
    };
  }

  private computeReturnPremiumSnapshot(
    source: EndorsementSnapshotSource,
    participant: {
      sharePercent: Prisma.Decimal | null;
      signedLinePercent: Prisma.Decimal | null;
      originalParticipantId?: string | null;
    },
    revisedLinePercent: number,
  ) {
    const sharePercent = this.toOptionalNumber(participant.sharePercent);
    const commissionPct = source.commission ?? 0;
    const brokeragePct = source.brokeragePercent ?? 0;
    const originalLinePercent =
      this.findOriginalParticipantLinePercent(source, participant) ??
      sharePercent ??
      revisedLinePercent;
    const impactLinePercent = Math.max(
      0,
      this.roundNumber(originalLinePercent - revisedLinePercent, 4),
    );
    if (impactLinePercent <= 0 && source.revisedPremium !== 0) {
      throw new BadRequestException(
        'Decrease or cancellation endorsement requires a reduced signed line or cancellation impact',
      );
    }
    if (source.originalPremium === null || source.revisedPremium === null) {
      throw new BadRequestException(
        'Original and revised premium snapshots are required for decrease or cancellation endorsement closings',
      );
    }

    const dateBreakdown = this.calculatePolicyDayFractions(source);
    const premiumReduction = Math.max(
      0,
      this.roundMoney(source.originalPremium - source.revisedPremium),
    );
    const refundableProRataAmount = this.roundMoney(
      premiumReduction * dateBreakdown.unearnedFraction,
    );
    const grossReturnPremium = this.roundMoney(
      refundableProRataAmount + source.flatRefundableAmounts,
    );
    const taxesAndLeviesAdjustment = 0;
    const netReturnPremium = this.roundMoney(
      grossReturnPremium -
        source.flatNonRefundableDeductions +
        taxesAndLeviesAdjustment,
    );

    const signedPremiumImpact = -this.roundMoney(
      grossReturnPremium * (impactLinePercent / 100),
    );
    const signedCommissionImpact = this.roundMoney(
      (commissionPct / 100) * signedPremiumImpact,
    );
    const signedBrokerageImpact = this.roundMoney(
      (brokeragePct / 100) * signedPremiumImpact,
    );
    const signedFlatDeductionImpact = this.roundMoney(
      source.flatNonRefundableDeductions * (impactLinePercent / 100),
    );
    const signedNetPremiumImpact = this.roundMoney(
      signedPremiumImpact -
        signedCommissionImpact -
        signedBrokerageImpact +
        signedFlatDeductionImpact,
    );
    const effectivePremiumSnapshot = this.roundMoney(
      (revisedLinePercent / 100) * (source.revisedPremium ?? 0),
    );
    const effectiveCommissionAmount = this.roundMoney(
      (commissionPct / 100) * effectivePremiumSnapshot,
    );
    const effectiveBrokerageAmount = this.roundMoney(
      (brokeragePct / 100) * effectivePremiumSnapshot,
    );
    const effectiveNetPremium = this.roundMoney(
      effectivePremiumSnapshot -
        effectiveCommissionAmount -
        effectiveBrokerageAmount,
    );

    const financialImpactSnapshot: EndorsementFinancialImpactSnapshot = {
      impactType: source.impactType,
      calculationType: 'RETURN_PREMIUM',
      dateBoundaryConvention: 'START_INCLUSIVE_EXPIRY_EXCLUSIVE',
      policyInceptionDate: source.policyInceptionDate?.toISOString() ?? null,
      policyExpiryDate: source.policyExpiryDate?.toISOString() ?? null,
      endorsementEffectiveDate: source.endorsementEffectiveDate.toISOString(),
      totalPolicyDays: dateBreakdown.totalPolicyDays,
      earnedDays: dateBreakdown.earnedDays,
      unearnedDays: dateBreakdown.unearnedDays,
      earnedFraction: dateBreakdown.earnedFraction,
      unearnedFraction: dateBreakdown.unearnedFraction,
      originalPremium: source.originalPremium,
      revisedPremium: source.revisedPremium,
      premiumReduction,
      refundableProRataAmount,
      flatNonRefundableDeductions: source.flatNonRefundableDeductions,
      flatRefundableAmounts: source.flatRefundableAmounts,
      grossReturnPremium,
      taxesAndLeviesAdjustment,
      netReturnPremium,
      originalLinePercent,
      revisedLinePercent,
      impactLinePercent,
      effectivePremiumSnapshot,
      effectiveCommissionAmount,
      effectiveBrokerageAmount,
      effectiveNetPremium,
      signedPremiumImpact,
      signedCommissionImpact,
      signedBrokerageImpact,
      signedNetPremiumImpact,
    };

    return {
      signedLinePercent: revisedLinePercent,
      sharePercent,
      sumInsuredSnapshot: source.revisedSumInsured ?? source.sumInsured,
      premiumSnapshot: signedPremiumImpact,
      commissionPercent: commissionPct,
      commissionAmount: signedCommissionImpact,
      brokeragePercent: brokeragePct,
      brokerageAmount: signedBrokerageImpact,
      netPremium: signedNetPremiumImpact,
      financialImpactSnapshot,
      currency: source.currency,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private asRecordArray(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value)
      ? value
          .map((item) => this.asRecord(item))
          .filter((item) => Object.keys(item).length > 0)
      : [];
  }

  private findOriginalParticipantLinePercent(
    source: EndorsementSnapshotSource,
    participant: { originalParticipantId?: string | null },
  ): number | null {
    if (!participant.originalParticipantId) return null;
    const originalParticipant = source.originalParticipants.find(
      (item) =>
        typeof item.id === 'string' &&
        item.id === participant.originalParticipantId,
    );
    if (!originalParticipant) return null;
    return this.firstOptionalNumber(
      originalParticipant.signedLinePercent,
      originalParticipant.sharePercent,
    );
  }

  private calculatePolicyDayFractions(source: EndorsementSnapshotSource) {
    const inception = source.policyInceptionDate;
    const expiry = source.policyExpiryDate;
    const effective = source.endorsementEffectiveDate;
    if (!inception || !expiry) {
      throw new BadRequestException(
        'Original policy inception and expiry dates are required for return premium calculation',
      );
    }

    const totalPolicyDays = this.daysBetween(inception, expiry);
    if (totalPolicyDays <= 0) {
      throw new BadRequestException(
        'Original policy expiry date must be after inception date for return premium calculation',
      );
    }

    if (this.startOfUtcDay(effective) < this.startOfUtcDay(inception)) {
      throw new BadRequestException(
        'Endorsement effective date cannot be before original policy inception date',
      );
    }
    if (this.startOfUtcDay(effective) > this.startOfUtcDay(expiry)) {
      throw new BadRequestException(
        'Endorsement effective date cannot be after original policy expiry date',
      );
    }

    const earnedDays = Math.min(
      totalPolicyDays,
      Math.max(0, this.daysBetween(inception, effective)),
    );
    const unearnedDays = Math.min(
      totalPolicyDays,
      Math.max(0, this.daysBetween(effective, expiry)),
    );

    return {
      totalPolicyDays,
      earnedDays,
      unearnedDays,
      earnedFraction: this.roundNumber(earnedDays / totalPolicyDays, 8),
      unearnedFraction: this.roundNumber(unearnedDays / totalPolicyDays, 8),
    };
  }

  private daysBetween(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round(
      (this.startOfUtcDay(end).getTime() -
        this.startOfUtcDay(start).getTime()) /
        msPerDay,
    );
  }

  private startOfUtcDay(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private parseDate(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  private extractFlatReturnAdjustments(
    proposed: Record<string, unknown>,
    proposedPlacement: Record<string, unknown>,
  ): {
    flatNonRefundableDeductions: number;
    flatRefundableAmounts: number;
  } {
    const adjustmentCandidates: unknown[] = [
      proposed.returnPremiumAdjustments,
      proposed.financialAdjustments,
      proposed.flatAdjustments,
      proposedPlacement.returnPremiumAdjustments,
      proposedPlacement.financialAdjustments,
      proposedPlacement.flatAdjustments,
    ].flatMap((value): unknown[] => (Array.isArray(value) ? value : []));

    return adjustmentCandidates.reduce<{
      flatNonRefundableDeductions: number;
      flatRefundableAmounts: number;
    }>(
      (totals, item) => {
        const adjustment = this.asRecord(item);
        const amount = this.firstOptionalNumber(adjustment.amount);
        if (amount === null || amount === 0) return totals;
        const treatment = this.cleanString(
          adjustment.treatment ??
            adjustment.calculationTreatment ??
            adjustment.calculationBasis ??
            '',
        ).toUpperCase();
        const isFlat =
          treatment.includes('FLAT') ||
          treatment.includes('NON_PRO_RATA') ||
          treatment.includes('NON-PRORATA');
        if (!isFlat) return totals;

        const direction = this.cleanString(
          adjustment.direction ?? adjustment.returnTreatment ?? '',
        ).toUpperCase();
        const refundable = adjustment.refundable === true;
        const nonRefundable = adjustment.refundable === false;

        if (
          nonRefundable ||
          direction.includes('DEDUCTION') ||
          direction.includes('NON_REFUNDABLE')
        ) {
          totals.flatNonRefundableDeductions = this.roundMoney(
            totals.flatNonRefundableDeductions + Math.abs(amount),
          );
        } else if (refundable || direction.includes('REFUND')) {
          totals.flatRefundableAmounts = this.roundMoney(
            totals.flatRefundableAmounts + Math.abs(amount),
          );
        }
        return totals;
      },
      { flatNonRefundableDeductions: 0, flatRefundableAmounts: 0 },
    );
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private cleanString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private roundNumber(value: number, decimalPlaces: number): number {
    const factor = 10 ** decimalPlaces;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  private firstNumber(...values: unknown[]): number | null {
    for (const value of values) {
      const parsed = this.parseNumber(value);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  private firstOptionalNumber(...values: unknown[]): number | null {
    return this.firstNumber(...values);
  }

  private firstString(...values: unknown[]): string | null {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }

  private parseNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Prisma.Decimal) return value.toNumber();
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toOptionalNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private isSerializableTransactionConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  private isUniqueConstraintConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private rethrowControlledPrismaError(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'An active endorsement closing was created by another request. Please retry validation.',
        );
      }
      if (['P2003', 'P2014', 'P2025'].includes(error.code)) {
        throw new ConflictException(
          'Endorsement validation could not be completed because related records changed. Refresh and retry.',
        );
      }
      if (error.code === 'P2034') {
        throw new ConflictException(
          'Endorsement validation could not be completed due to a concurrent update. Please retry.',
        );
      }
    }
  }
}
