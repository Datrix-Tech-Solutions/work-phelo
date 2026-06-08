import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  PlacementClosingStatus,
  PlacementEndorsementParticipantStatus,
  PlacementEndorsementStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlacementEndorsementClosingStatusDto } from './dto/update-placement-endorsement-closing-status.dto';

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

type EndorsementForClosing = {
  id: string;
  tenantId: string;
  placementId: string;
  status: PlacementEndorsementStatus;
  originalSnapshot: Prisma.JsonValue;
  proposedSnapshot: Prisma.JsonValue | null;
};

@Injectable()
export class PlacementEndorsementClosingsService {
  constructor(private readonly prisma: PrismaService) {}

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
    if (signedLinePercent <= 0) {
      throw new BadRequestException(
        'Endorsement participant must have a signed line percentage greater than zero',
      );
    }

    const snapshotSource = this.buildSnapshotSource(endorsement);
    const snapshot = this.computeSnapshot(
      snapshotSource,
      participant,
      signedLinePercent,
    );

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
        status: true,
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

  private buildSnapshotSource(endorsement: EndorsementForClosing) {
    const proposed = this.asRecord(endorsement.proposedSnapshot);
    const original = this.asRecord(endorsement.originalSnapshot);
    const originalPlacement = this.asRecord(original.placement);

    const premium = this.firstNumber(
      proposed.premium,
      this.asRecord(proposed.placement).premium,
      originalPlacement.premium,
    );
    if (premium === null) {
      throw new BadRequestException(
        'Endorsement premium snapshot is required before creating an endorsement closing',
      );
    }

    return {
      premium,
      sumInsured: this.firstOptionalNumber(
        proposed.sumInsured,
        this.asRecord(proposed.placement).sumInsured,
        originalPlacement.sumInsured,
      ),
      commission: this.firstOptionalNumber(
        proposed.commission,
        this.asRecord(proposed.placement).commission,
        originalPlacement.commission,
      ),
      brokeragePercent: this.firstOptionalNumber(
        proposed.brokeragePercent,
        proposed.preliminaryBrokerage,
        this.asRecord(proposed.placement).brokeragePercent,
        this.asRecord(proposed.placement).preliminaryBrokerage,
        originalPlacement.preliminaryBrokerage,
      ),
      currency: this.firstString(
        proposed.currency,
        this.asRecord(proposed.placement).currency,
        originalPlacement.currency,
      ),
    };
  }

  private computeSnapshot(
    source: {
      premium: number;
      sumInsured: number | null;
      commission: number | null;
      brokeragePercent: number | null;
      currency: string | null;
    },
    participant: {
      sharePercent: Prisma.Decimal | null;
      signedLinePercent: Prisma.Decimal | null;
    },
    signedLinePercent: number,
  ) {
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
      currency: source.currency,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
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
}
