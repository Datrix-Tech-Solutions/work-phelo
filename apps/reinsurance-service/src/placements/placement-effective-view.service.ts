import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementEndorsementStatus,
  PlacementEndorsementType,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ClosingSnapshot,
  ClosingSnapshotReader,
} from './closing-snapshot.reader';
import { EffectivePlacementViewResponseDto } from './dto/placement-effective-view-response.dto';
import { ReinsuranceMoneyHelper } from './reinsurance-money.helper';

type PlacementForEffectiveView = {
  id: string;
  reference: string;
  title: string;
  cedantId: string;
  currency: string | null;
  sumInsured: Prisma.Decimal | null;
  premium: Prisma.Decimal | null;
  commission: Prisma.Decimal | null;
  facultativeOffer: Prisma.Decimal | null;
  preliminaryBrokerage: Prisma.Decimal | null;
};

type EndorsementForEffectiveView = {
  id: string;
  endorsementNumber: string;
  type: PlacementEndorsementType;
  status: PlacementEndorsementStatus;
  effectiveDate: Date;
  targetPercent: Prisma.Decimal | null;
  proposedSnapshot: Prisma.JsonValue | null;
  closings: Array<{
    id: string;
    closingNumber: string;
    status: PlacementClosingStatus;
    endorsementParticipantId: string;
    signedLinePercent: Prisma.Decimal;
    endorsementParticipant: {
      counterpartyId: string;
    };
  }>;
};

type CounterpartySummary = {
  id: string;
  type: CounterpartyType;
  name: string;
  registrationNumber: string | null;
};

type MutableEffectiveTotals = {
  sumInsured: number | null;
  premium: number | null;
  currency: string | null;
  commissionPercent: number | null;
  brokeragePercent: number | null;
  facultativeOfferPercent: number | null;
};

@Injectable()
export class PlacementEffectiveViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly closingSnapshotReader: ClosingSnapshotReader,
    private readonly money: ReinsuranceMoneyHelper,
  ) {}

  async getEffectiveView(
    tenantId: string,
    placementId: string,
  ): Promise<EffectivePlacementViewResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const placement = await this.findPlacement(tx, tenantId, placementId);
      const [placementSnapshots, endorsementSnapshots, endorsements] =
        await Promise.all([
          this.closingSnapshotReader.findConfirmedPlacementClosingSnapshots(
            tx,
            tenantId,
            placementId,
          ),
          this.closingSnapshotReader.findConfirmedEndorsementClosingSnapshots(
            tx,
            tenantId,
            placementId,
          ),
          this.findEndorsements(tx, tenantId, placementId),
        ]);

      const baseTotals = this.buildBaseTotals(placement);
      const appliedEndorsements = endorsements.filter((endorsement) =>
        this.isEffectiveEndorsement(endorsement),
      );
      const appliedEndorsementClosingIds = new Set(
        appliedEndorsements.flatMap((endorsement) =>
          endorsement.closings
            .filter(
              (closing) => closing.status === PlacementClosingStatus.CONFIRMED,
            )
            .map((closing) => closing.id),
        ),
      );
      const effectiveEndorsementSnapshots = endorsementSnapshots.filter(
        (snapshot) => appliedEndorsementClosingIds.has(snapshot.closingId),
      );
      const snapshots = [
        ...placementSnapshots,
        ...effectiveEndorsementSnapshots,
      ];
      const counterparties = await this.findCounterparties(
        tx,
        tenantId,
        snapshots.map((snapshot) => snapshot.counterpartyId),
      );
      const warnings = this.buildWarnings(placement, snapshots);
      const effectiveFinancials = this.applyEndorsementFinancialSnapshots(
        baseTotals,
        appliedEndorsements,
      );
      const effectiveParticipants = this.buildEffectiveParticipants(
        snapshots,
        counterparties,
      );
      const facultativeOfferPercent = this.money.roundMoney(
        effectiveParticipants.reduce(
          (total, participant) => total + participant.signedLinePercent,
          0,
        ),
      );
      const snapshotCurrencyCodes = new Set(
        snapshots
          .map((snapshot) => snapshot.currency)
          .filter((currency): currency is string => Boolean(currency)),
      );

      if (snapshotCurrencyCodes.size > 1) {
        warnings.push(
          'Confirmed closing snapshots contain multiple currencies; effective financial totals should be reviewed.',
        );
      }

      return {
        basePlacement: {
          id: placement.id,
          reference: placement.reference,
          title: placement.title,
          cedantId: placement.cedantId,
          currency: placement.currency,
          sumInsured: this.money.toOptionalNumber(placement.sumInsured),
          premium: this.money.toOptionalNumber(placement.premium),
          commissionPercent: this.money.toOptionalNumber(placement.commission),
          brokeragePercent: this.money.toOptionalNumber(
            placement.preliminaryBrokerage,
          ),
          facultativeOfferPercent: this.money.toOptionalNumber(
            placement.facultativeOffer,
          ),
        },
        effectiveTotals: {
          facultativeOfferPercent,
          participantCount: effectiveParticipants.length,
          sumInsured: effectiveFinancials.sumInsured,
          premium: effectiveFinancials.premium,
          currency: effectiveFinancials.currency,
          commissionPercent: effectiveFinancials.commissionPercent,
          brokeragePercent: effectiveFinancials.brokeragePercent,
          grossPremium: this.sumMoney(snapshots, 'premium'),
          commissionAmount: this.sumMoney(snapshots, 'commissionAmount'),
          brokerageAmount: this.sumMoney(snapshots, 'brokerageAmount'),
          netPremium: this.sumMoney(snapshots, 'netPremium'),
        },
        effectiveParticipants,
        appliedEndorsements: this.mapAppliedEndorsements(appliedEndorsements),
        pendingEndorsements: this.mapPendingEndorsements(endorsements),
        warnings,
      };
    });
  }

  private async findPlacement(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ): Promise<PlacementForEffectiveView> {
    const placement = await tx.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: {
        id: true,
        reference: true,
        title: true,
        cedantId: true,
        currency: true,
        sumInsured: true,
        premium: true,
        commission: true,
        facultativeOffer: true,
        preliminaryBrokerage: true,
      },
    });

    if (!placement) {
      throw new NotFoundException('Placement not found');
    }
    return placement;
  }

  private async findEndorsements(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ): Promise<EndorsementForEffectiveView[]> {
    return tx.placementEndorsement.findMany({
      where: { tenantId, placementId },
      select: {
        id: true,
        endorsementNumber: true,
        type: true,
        status: true,
        effectiveDate: true,
        targetPercent: true,
        proposedSnapshot: true,
        closings: {
          select: {
            id: true,
            closingNumber: true,
            status: true,
            endorsementParticipantId: true,
            signedLinePercent: true,
            endorsementParticipant: {
              select: { counterpartyId: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  private async findCounterparties(
    tx: Prisma.TransactionClient,
    tenantId: string,
    counterpartyIds: string[],
  ): Promise<Map<string, CounterpartySummary>> {
    const uniqueIds = [...new Set(counterpartyIds)];
    if (uniqueIds.length === 0) return new Map();

    const counterparties = await tx.counterparty.findMany({
      where: { tenantId, id: { in: uniqueIds } },
      select: {
        id: true,
        type: true,
        name: true,
        registrationNumber: true,
      },
    });

    return new Map(
      counterparties.map((counterparty) => [counterparty.id, counterparty]),
    );
  }

  private buildBaseTotals(
    placement: PlacementForEffectiveView,
  ): MutableEffectiveTotals {
    return {
      sumInsured: this.money.toOptionalNumber(placement.sumInsured),
      premium: this.money.toOptionalNumber(placement.premium),
      currency: placement.currency,
      commissionPercent: this.money.toOptionalNumber(placement.commission),
      brokeragePercent: this.money.toOptionalNumber(
        placement.preliminaryBrokerage,
      ),
      facultativeOfferPercent: this.money.toOptionalNumber(
        placement.facultativeOffer,
      ),
    };
  }

  private applyEndorsementFinancialSnapshots(
    baseTotals: MutableEffectiveTotals,
    endorsements: EndorsementForEffectiveView[],
  ): MutableEffectiveTotals {
    return endorsements.reduce<MutableEffectiveTotals>(
      (current, endorsement) => {
        const proposed = this.asRecord(endorsement.proposedSnapshot);
        const proposedPlacement = this.asRecord(proposed.placement);

        return {
          sumInsured: this.firstOptionalNumber(
            proposed.sumInsured,
            proposedPlacement.sumInsured,
            current.sumInsured,
          ),
          premium: this.firstOptionalNumber(
            proposed.premium,
            proposedPlacement.premium,
            current.premium,
          ),
          currency: this.firstString(
            proposed.currency,
            proposedPlacement.currency,
            current.currency,
          ),
          commissionPercent: this.firstOptionalNumber(
            proposed.commission,
            proposedPlacement.commission,
            current.commissionPercent,
          ),
          brokeragePercent: this.firstOptionalNumber(
            proposed.brokeragePercent,
            proposed.preliminaryBrokerage,
            proposedPlacement.brokeragePercent,
            proposedPlacement.preliminaryBrokerage,
            current.brokeragePercent,
          ),
          facultativeOfferPercent: this.firstOptionalNumber(
            proposed.facultativeOffer,
            proposedPlacement.facultativeOffer,
            endorsement.targetPercent,
            current.facultativeOfferPercent,
          ),
        };
      },
      baseTotals,
    );
  }

  private buildEffectiveParticipants(
    snapshots: ClosingSnapshot[],
    counterparties: Map<string, CounterpartySummary>,
  ) {
    const byCounterparty = new Map<
      string,
      {
        counterpartyId: string;
        counterparty: CounterpartySummary;
        signedLinePercent: number;
        grossPremium: number;
        commissionAmount: number;
        brokerageAmount: number;
        netPremium: number;
        sources: Array<{
          sourceType: 'PLACEMENT_CLOSING' | 'ENDORSEMENT_CLOSING';
          closingId: string;
          participantId?: string;
          endorsementParticipantId?: string;
          signedLinePercent: number;
        }>;
      }
    >();

    for (const snapshot of snapshots) {
      const counterparty = counterparties.get(snapshot.counterpartyId) ?? {
        id: snapshot.counterpartyId,
        type: CounterpartyType.REINSURER,
        name: 'Unknown reinsurer',
        registrationNumber: null,
      };
      const existing = byCounterparty.get(snapshot.counterpartyId) ?? {
        counterpartyId: snapshot.counterpartyId,
        counterparty,
        signedLinePercent: 0,
        grossPremium: 0,
        commissionAmount: 0,
        brokerageAmount: 0,
        netPremium: 0,
        sources: [],
      };

      existing.signedLinePercent += snapshot.signedLinePercent;
      existing.grossPremium += snapshot.premium ?? 0;
      existing.commissionAmount += snapshot.commissionAmount ?? 0;
      existing.brokerageAmount += snapshot.brokerageAmount ?? 0;
      existing.netPremium += snapshot.netPremium ?? 0;
      existing.sources.push({
        sourceType: snapshot.sourceType,
        closingId: snapshot.closingId,
        ...(snapshot.participantId
          ? { participantId: snapshot.participantId }
          : {}),
        ...(snapshot.endorsementParticipantId
          ? { endorsementParticipantId: snapshot.endorsementParticipantId }
          : {}),
        signedLinePercent: this.money.roundMoney(snapshot.signedLinePercent),
      });
      byCounterparty.set(snapshot.counterpartyId, existing);
    }

    return [...byCounterparty.values()]
      .map((participant) => ({
        ...participant,
        signedLinePercent: this.money.roundMoney(participant.signedLinePercent),
        grossPremium: this.money.roundMoney(participant.grossPremium),
        commissionAmount: this.money.roundMoney(participant.commissionAmount),
        brokerageAmount: this.money.roundMoney(participant.brokerageAmount),
        netPremium: this.money.roundMoney(participant.netPremium),
      }))
      .sort((a, b) => a.counterparty.name.localeCompare(b.counterparty.name));
  }

  private mapAppliedEndorsements(endorsements: EndorsementForEffectiveView[]) {
    return endorsements.map((endorsement) => ({
      id: endorsement.id,
      endorsementNumber: endorsement.endorsementNumber,
      type: endorsement.type,
      status: endorsement.status,
      effectiveDate: endorsement.effectiveDate.toISOString(),
      targetPercent: this.money.toOptionalNumber(endorsement.targetPercent),
      confirmedClosings: endorsement.closings
        .filter(
          (closing) => closing.status === PlacementClosingStatus.CONFIRMED,
        )
        .map((closing) => ({
          id: closing.id,
          closingNumber: closing.closingNumber,
          endorsementParticipantId: closing.endorsementParticipantId,
          counterpartyId: closing.endorsementParticipant.counterpartyId,
          signedLinePercent: this.money.toNumber(closing.signedLinePercent),
        })),
    }));
  }

  private isEffectiveEndorsement(
    endorsement: EndorsementForEffectiveView,
  ): boolean {
    if (
      endorsement.status === PlacementEndorsementStatus.VOID ||
      endorsement.status === PlacementEndorsementStatus.DECLINED
    ) {
      return false;
    }
    return endorsement.closings.some(
      (closing) => closing.status === PlacementClosingStatus.CONFIRMED,
    );
  }

  private mapPendingEndorsements(endorsements: EndorsementForEffectiveView[]) {
    return endorsements
      .filter((endorsement) => {
        if (
          endorsement.status === PlacementEndorsementStatus.VOID ||
          endorsement.status === PlacementEndorsementStatus.DECLINED
        ) {
          return false;
        }
        return !endorsement.closings.some(
          (closing) => closing.status === PlacementClosingStatus.CONFIRMED,
        );
      })
      .map((endorsement) => ({
        id: endorsement.id,
        endorsementNumber: endorsement.endorsementNumber,
        type: endorsement.type,
        status: endorsement.status,
        effectiveDate: endorsement.effectiveDate.toISOString(),
        targetPercent: this.money.toOptionalNumber(endorsement.targetPercent),
        confirmedClosingCount: 0,
      }));
  }

  private buildWarnings(
    placement: PlacementForEffectiveView,
    snapshots: ClosingSnapshot[],
  ): string[] {
    const warnings: string[] = [];
    if (snapshots.length === 0) {
      warnings.push(
        'No confirmed placement or endorsement closings were found for this placement.',
      );
    }
    if (!placement.sumInsured) {
      warnings.push('Placement sum insured is not available.');
    }
    if (!placement.premium) {
      warnings.push('Placement premium is not available.');
    }
    if (snapshots.some((snapshot) => snapshot.premium === null)) {
      warnings.push(
        'Some confirmed closing snapshots do not include premium values.',
      );
    }
    return warnings;
  }

  private sumMoney(
    snapshots: ClosingSnapshot[],
    field: 'premium' | 'commissionAmount' | 'brokerageAmount' | 'netPremium',
  ): number {
    return this.money.roundMoney(
      snapshots.reduce((total, snapshot) => total + (snapshot[field] ?? 0), 0),
    );
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private firstOptionalNumber(...values: Array<unknown>): number | null {
    for (const value of values) {
      const parsed = this.money.toOptionalNumber(
        value as Prisma.Decimal | number | string | null | undefined,
      );
      if (parsed !== null) return parsed;
    }
    return null;
  }

  private firstString(...values: Array<unknown>): string | null {
    for (const value of values) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return null;
  }
}
