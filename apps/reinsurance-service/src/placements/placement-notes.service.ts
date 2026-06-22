import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementClosingStatus,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlacementNoteStatusDto } from './dto/update-placement-note-status.dto';
import { VoidPlacementNoteDto } from './dto/void-placement-note.dto';

const noteInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
  participant: {
    select: {
      id: true,
      counterpartyId: true,
    },
  },
  closing: {
    select: {
      id: true,
      closingNumber: true,
    },
  },
  endorsementParticipant: {
    select: {
      id: true,
      counterpartyId: true,
    },
  },
  endorsementClosing: {
    select: {
      id: true,
      closingNumber: true,
    },
  },
} satisfies Prisma.PlacementNoteInclude;

type PlacementNoteRecord = Prisma.PlacementNoteGetPayload<{
  include: typeof noteInclude;
}>;

type DebitClosingSnapshot = {
  grossPremium: Prisma.Decimal | null;
  commissionAmount: Prisma.Decimal | null;
  currency: string | null;
};

type EndorsementDebitClosingSnapshot = {
  premiumSnapshot: Prisma.Decimal;
  commissionAmount: Prisma.Decimal | null;
  currency: string | null;
};

@Injectable()
export class PlacementNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    placementId: string,
  ): Promise<PlacementNoteRecord[]> {
    await this.assertPlacement(tenantId, placementId);
    return this.prisma.placementNote.findMany({
      where: { tenantId, placementId },
      include: noteInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    placementId: string,
    noteId: string,
  ): Promise<PlacementNoteRecord> {
    await this.assertPlacement(tenantId, placementId);
    const note = await this.prisma.placementNote.findFirst({
      where: { id: noteId, tenantId, placementId },
      include: noteInclude,
    });
    if (!note) throw new NotFoundException('Placement note not found');
    return note;
  }

  async findAllEndorsementNotes(
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<PlacementNoteRecord[]> {
    await this.assertEndorsement(tenantId, placementId, endorsementId);
    return this.prisma.placementNote.findMany({
      where: { tenantId, placementId, endorsementId },
      include: noteInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findEndorsementNote(
    tenantId: string,
    placementId: string,
    endorsementId: string,
    noteId: string,
  ): Promise<PlacementNoteRecord> {
    await this.assertEndorsement(tenantId, placementId, endorsementId);
    const note = await this.prisma.placementNote.findFirst({
      where: { id: noteId, tenantId, placementId, endorsementId },
      include: noteInclude,
    });
    if (!note)
      throw new NotFoundException('Placement endorsement note not found');
    return note;
  }

  async createDebitNote(
    user: RequestUser,
    placementId: string,
  ): Promise<PlacementNoteRecord> {
    const placement = await this.findPlacement(user.tenantId, placementId);

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoActiveDebitNote(tx, user.tenantId, placementId);

      const closings = await tx.placementClosing.findMany({
        where: {
          tenantId: user.tenantId,
          placementId,
          status: PlacementClosingStatus.CONFIRMED,
        },
        select: {
          grossPremium: true,
          commissionAmount: true,
          currency: true,
        },
      });
      if (closings.length === 0) {
        throw new BadRequestException(
          'At least one confirmed closing is required before creating a debit note',
        );
      }

      const noteNumber = await this.nextNoteNumber(
        tx,
        user.tenantId,
        placementId,
        PlacementNoteType.DEBIT_NOTE,
      );
      const snapshot = this.debitSnapshot(placement.currency, closings);

      return tx.placementNote.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          counterpartyId: placement.cedantId,
          type: PlacementNoteType.DEBIT_NOTE,
          direction: PlacementNoteDirection.CEDANT_TO_BROKER,
          noteNumber,
          status: PlacementNoteStatus.DRAFT,
          ...snapshot,
          noteDate: new Date(),
          createdByUserId: user.id,
        },
        include: noteInclude,
      });
    });
  }

  async createCreditNote(
    user: RequestUser,
    placementId: string,
    closingId: string,
  ): Promise<PlacementNoteRecord> {
    await this.assertPlacement(user.tenantId, placementId);

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoActiveCreditNote(
        tx,
        user.tenantId,
        placementId,
        closingId,
      );

      const closing = await tx.placementClosing.findFirst({
        where: {
          id: closingId,
          tenantId: user.tenantId,
          placementId,
          status: PlacementClosingStatus.CONFIRMED,
        },
        include: {
          participant: {
            include: {
              counterparty: {
                select: {
                  id: true,
                  type: true,
                },
              },
            },
          },
        },
      });
      if (!closing) {
        throw new BadRequestException(
          'Credit note requires a confirmed closing in the placement',
        );
      }
      if (
        closing.participant.counterparty.type !== CounterpartyType.REINSURER
      ) {
        throw new BadRequestException(
          'Credit note counterparty must be a reinsurer',
        );
      }

      const noteNumber = await this.nextNoteNumber(
        tx,
        user.tenantId,
        placementId,
        PlacementNoteType.CREDIT_NOTE,
      );
      const snapshot = this.creditSnapshot(closing);

      return tx.placementNote.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          closingId,
          participantId: closing.participantId,
          counterpartyId: closing.participant.counterpartyId,
          type: PlacementNoteType.CREDIT_NOTE,
          direction: PlacementNoteDirection.BROKER_TO_REINSURER,
          noteNumber,
          status: PlacementNoteStatus.DRAFT,
          ...snapshot,
          noteDate: new Date(),
          createdByUserId: user.id,
        },
        include: noteInclude,
      });
    });
  }

  async createEndorsementDebitNote(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
  ): Promise<PlacementNoteRecord> {
    const placement = await this.findPlacement(user.tenantId, placementId);
    await this.assertEndorsement(user.tenantId, placementId, endorsementId);

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoActiveEndorsementDebitNote(
        tx,
        user.tenantId,
        placementId,
        endorsementId,
      );

      const closings = await tx.placementEndorsementClosing.findMany({
        where: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          status: PlacementClosingStatus.CONFIRMED,
        },
        select: {
          premiumSnapshot: true,
          commissionAmount: true,
          currency: true,
        },
      });
      if (closings.length === 0) {
        throw new BadRequestException(
          'At least one confirmed endorsement closing is required before creating an endorsement debit note',
        );
      }

      const noteNumber = await this.nextNoteNumber(
        tx,
        user.tenantId,
        placementId,
        PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
      );
      const snapshot = this.endorsementDebitSnapshot(
        placement.currency,
        closings,
      );

      return tx.placementNote.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          counterpartyId: placement.cedantId,
          type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
          direction: PlacementNoteDirection.CEDANT_TO_BROKER,
          noteNumber,
          status: PlacementNoteStatus.DRAFT,
          ...snapshot,
          noteDate: new Date(),
          createdByUserId: user.id,
        },
        include: noteInclude,
      });
    });
  }

  async createEndorsementCreditNote(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    closingId: string,
  ): Promise<PlacementNoteRecord> {
    await this.assertEndorsement(user.tenantId, placementId, endorsementId);

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoActiveEndorsementCreditNote(
        tx,
        user.tenantId,
        placementId,
        endorsementId,
        closingId,
      );

      const closing = await tx.placementEndorsementClosing.findFirst({
        where: {
          id: closingId,
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          status: PlacementClosingStatus.CONFIRMED,
        },
        include: {
          endorsementParticipant: {
            include: {
              counterparty: {
                select: {
                  id: true,
                  type: true,
                },
              },
            },
          },
        },
      });
      if (!closing) {
        throw new BadRequestException(
          'Endorsement credit note requires a confirmed endorsement closing',
        );
      }
      if (
        closing.endorsementParticipant.counterparty.type !==
        CounterpartyType.REINSURER
      ) {
        throw new BadRequestException(
          'Endorsement credit note counterparty must be a reinsurer',
        );
      }

      const noteNumber = await this.nextNoteNumber(
        tx,
        user.tenantId,
        placementId,
        PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
      );
      const snapshot = this.endorsementCreditSnapshot(closing);

      return tx.placementNote.create({
        data: {
          tenantId: user.tenantId,
          placementId,
          endorsementId,
          endorsementClosingId: closing.id,
          endorsementParticipantId: closing.endorsementParticipantId,
          counterpartyId: closing.endorsementParticipant.counterpartyId,
          type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
          direction: PlacementNoteDirection.BROKER_TO_REINSURER,
          noteNumber,
          status: PlacementNoteStatus.DRAFT,
          ...snapshot,
          noteDate: new Date(),
          createdByUserId: user.id,
        },
        include: noteInclude,
      });
    });
  }

  async issue(
    user: RequestUser,
    placementId: string,
    noteId: string,
    dto: UpdatePlacementNoteStatusDto,
  ): Promise<PlacementNoteRecord> {
    if (dto.status !== PlacementNoteStatus.ISSUED) {
      throw new BadRequestException(
        'Only issuing a draft note is supported by this endpoint',
      );
    }

    const note = await this.findOne(user.tenantId, placementId, noteId);
    if (note.status === PlacementNoteStatus.ISSUED) return note;
    if (note.status !== PlacementNoteStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot move note from ${note.status} to ${dto.status}`,
      );
    }

    return this.prisma.placementNote.update({
      where: { id: noteId },
      data: {
        status: PlacementNoteStatus.ISSUED,
        issuedAt: new Date(),
      },
      include: noteInclude,
    });
  }

  async void(
    user: RequestUser,
    placementId: string,
    noteId: string,
    dto: VoidPlacementNoteDto,
  ): Promise<PlacementNoteRecord> {
    const note = await this.findOne(user.tenantId, placementId, noteId);
    if (note.status === PlacementNoteStatus.VOID) {
      throw new BadRequestException('VOID notes are terminal');
    }

    return this.prisma.placementNote.update({
      where: { id: noteId },
      data: {
        status: PlacementNoteStatus.VOID,
        voidedAt: new Date(),
        voidReason: this.cleanRequired(dto.voidReason),
      },
      include: noteInclude,
    });
  }

  async issueEndorsementNote(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    noteId: string,
    dto: UpdatePlacementNoteStatusDto,
  ): Promise<PlacementNoteRecord> {
    if (dto.status !== PlacementNoteStatus.ISSUED) {
      throw new BadRequestException(
        'Only issuing a draft note is supported by this endpoint',
      );
    }

    const note = await this.findEndorsementNote(
      user.tenantId,
      placementId,
      endorsementId,
      noteId,
    );
    if (note.status === PlacementNoteStatus.ISSUED) return note;
    if (note.status !== PlacementNoteStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot move note from ${note.status} to ${dto.status}`,
      );
    }

    return this.prisma.placementNote.update({
      where: { id: noteId },
      data: {
        status: PlacementNoteStatus.ISSUED,
        issuedAt: new Date(),
      },
      include: noteInclude,
    });
  }

  async voidEndorsementNote(
    user: RequestUser,
    placementId: string,
    endorsementId: string,
    noteId: string,
    dto: VoidPlacementNoteDto,
  ): Promise<PlacementNoteRecord> {
    const note = await this.findEndorsementNote(
      user.tenantId,
      placementId,
      endorsementId,
      noteId,
    );
    if (note.status === PlacementNoteStatus.VOID) {
      throw new BadRequestException('VOID notes are terminal');
    }

    return this.prisma.placementNote.update({
      where: { id: noteId },
      data: {
        status: PlacementNoteStatus.VOID,
        voidedAt: new Date(),
        voidReason: this.cleanRequired(dto.voidReason),
      },
      include: noteInclude,
    });
  }

  private async findPlacement(tenantId: string, placementId: string) {
    const placement = await this.prisma.placement.findFirst({
      where: { id: placementId, tenantId, archivedAt: null },
      select: {
        id: true,
        cedantId: true,
        currency: true,
      },
    });
    if (!placement) throw new NotFoundException('Placement not found');
    if (!placement.currency) {
      throw new BadRequestException(
        'Placement currency is required before creating notes',
      );
    }
    return placement;
  }

  private async assertPlacement(
    tenantId: string,
    placementId: string,
  ): Promise<void> {
    await this.findPlacement(tenantId, placementId);
  }

  private async assertEndorsement(
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<void> {
    const endorsement = await this.prisma.placementEndorsement.findFirst({
      where: {
        id: endorsementId,
        tenantId,
        placementId,
        placement: { archivedAt: null },
      },
      select: { id: true },
    });
    if (!endorsement)
      throw new NotFoundException('Placement endorsement not found');
  }

  private async assertNoActiveDebitNote(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
  ): Promise<void> {
    const existing = await tx.placementNote.findFirst({
      where: {
        tenantId,
        placementId,
        type: PlacementNoteType.DEBIT_NOTE,
        status: { not: PlacementNoteStatus.VOID },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An active debit note already exists for this placement',
      );
    }
  }

  private async assertNoActiveCreditNote(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    closingId: string,
  ): Promise<void> {
    const existing = await tx.placementNote.findFirst({
      where: {
        tenantId,
        placementId,
        closingId,
        type: PlacementNoteType.CREDIT_NOTE,
        status: { not: PlacementNoteStatus.VOID },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An active credit note already exists for this closing',
      );
    }
  }

  private async assertNoActiveEndorsementDebitNote(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    endorsementId: string,
  ): Promise<void> {
    const existing = await tx.placementNote.findFirst({
      where: {
        tenantId,
        placementId,
        endorsementId,
        type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
        status: { not: PlacementNoteStatus.VOID },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An active endorsement debit note already exists for this endorsement',
      );
    }
  }

  private async assertNoActiveEndorsementCreditNote(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    endorsementId: string,
    closingId: string,
  ): Promise<void> {
    const existing = await tx.placementNote.findFirst({
      where: {
        tenantId,
        placementId,
        endorsementId,
        endorsementClosingId: closingId,
        type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
        status: { not: PlacementNoteStatus.VOID },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An active endorsement credit note already exists for this endorsement closing',
      );
    }
  }

  private async nextNoteNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementId: string,
    type: PlacementNoteType,
  ): Promise<string> {
    const count = await tx.placementNote.count({
      where: { tenantId, placementId, type },
    });
    const prefix =
      type === PlacementNoteType.DEBIT_NOTE
        ? 'DN'
        : type === PlacementNoteType.CREDIT_NOTE
          ? 'CN'
          : type === PlacementNoteType.ENDORSEMENT_DEBIT_NOTE
            ? 'EDN'
            : 'ECN';
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  private debitSnapshot(
    placementCurrency: string | null,
    closings: DebitClosingSnapshot[],
  ) {
    const currency = placementCurrency ?? closings[0]?.currency;
    if (!currency) {
      throw new BadRequestException(
        'Confirmed closing currency is required before creating a debit note',
      );
    }

    const grossAmount = closings.reduce(
      (total, closing) => total + this.toNumber(closing.grossPremium),
      0,
    );
    const commissionAmount = closings.reduce(
      (total, closing) => total + this.toNumber(closing.commissionAmount),
      0,
    );
    const nicLevyAmount = 0;
    const withholdingTaxAmount = 0;

    return {
      currency,
      grossAmount,
      commissionPercent: null,
      commissionAmount,
      brokeragePercent: null,
      brokerageAmount: null,
      nicLevyPercent: 0,
      nicLevyAmount,
      withholdingTaxPercent: 0,
      withholdingTaxAmount,
      netAmount:
        grossAmount - commissionAmount - nicLevyAmount - withholdingTaxAmount,
    };
  }

  private creditSnapshot(closing: {
    currency: string | null;
    grossPremium: Prisma.Decimal | null;
    commissionPercent: Prisma.Decimal | null;
    commissionAmount: Prisma.Decimal | null;
    brokeragePercent: Prisma.Decimal | null;
    brokerageAmount: Prisma.Decimal | null;
    netPremium: Prisma.Decimal | null;
  }) {
    if (!closing.currency) {
      throw new BadRequestException(
        'Closing currency is required before creating a credit note',
      );
    }

    return {
      currency: closing.currency,
      grossAmount: this.toNumber(closing.grossPremium),
      commissionPercent: this.toOptionalNumber(closing.commissionPercent),
      commissionAmount: this.toOptionalNumber(closing.commissionAmount),
      brokeragePercent: this.toOptionalNumber(closing.brokeragePercent),
      brokerageAmount: this.toOptionalNumber(closing.brokerageAmount),
      nicLevyPercent: 0,
      nicLevyAmount: 0,
      withholdingTaxPercent: 0,
      withholdingTaxAmount: 0,
      netAmount: this.toNumber(closing.netPremium),
    };
  }

  private endorsementDebitSnapshot(
    placementCurrency: string | null,
    closings: EndorsementDebitClosingSnapshot[],
  ) {
    const currency = placementCurrency ?? closings[0]?.currency;
    if (!currency) {
      throw new BadRequestException(
        'Confirmed endorsement closing currency is required before creating a debit note',
      );
    }

    const grossAmount = closings.reduce(
      (total, closing) => total + this.toNumber(closing.premiumSnapshot),
      0,
    );
    const commissionAmount = closings.reduce(
      (total, closing) => total + this.toNumber(closing.commissionAmount),
      0,
    );
    const nicLevyAmount = 0;
    const withholdingTaxAmount = 0;

    return {
      currency,
      grossAmount,
      commissionPercent: null,
      commissionAmount,
      brokeragePercent: null,
      brokerageAmount: null,
      nicLevyPercent: 0,
      nicLevyAmount,
      withholdingTaxPercent: 0,
      withholdingTaxAmount,
      netAmount:
        grossAmount - commissionAmount - nicLevyAmount - withholdingTaxAmount,
    };
  }

  private endorsementCreditSnapshot(closing: {
    currency: string | null;
    premiumSnapshot: Prisma.Decimal;
    commissionPercent: Prisma.Decimal | null;
    commissionAmount: Prisma.Decimal | null;
    brokeragePercent: Prisma.Decimal | null;
    brokerageAmount: Prisma.Decimal | null;
    netPremium: Prisma.Decimal | null;
  }) {
    if (!closing.currency) {
      throw new BadRequestException(
        'Endorsement closing currency is required before creating a credit note',
      );
    }

    return {
      currency: closing.currency,
      grossAmount: this.toNumber(closing.premiumSnapshot),
      commissionPercent: this.toOptionalNumber(closing.commissionPercent),
      commissionAmount: this.toOptionalNumber(closing.commissionAmount),
      brokeragePercent: this.toOptionalNumber(closing.brokeragePercent),
      brokerageAmount: this.toOptionalNumber(closing.brokerageAmount),
      nicLevyPercent: 0,
      nicLevyAmount: 0,
      withholdingTaxPercent: 0,
      withholdingTaxAmount: 0,
      netAmount: this.toNumber(closing.netPremium),
    };
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

  private cleanRequired(value: string): string {
    const cleaned = value.trim();
    if (!cleaned) throw new BadRequestException('Void reason is required');
    return cleaned;
  }
}
