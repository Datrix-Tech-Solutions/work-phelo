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
  PlacementEndorsementImpactType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  Prisma,
  ReinsuranceChargeCode,
  ReinsuranceChargeRateType,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReinsuranceFinancialEventPublisher } from '../accounting-integration/reinsurance-financial-event-publisher.service';
import {
  AppliedChargeSnapshot,
  ChargeCalculationResult,
  ReinsuranceChargeSettingsService,
} from '../settings/reinsurance-charge-settings.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly chargeSettings: ReinsuranceChargeSettingsService,
    private readonly financialEvents: ReinsuranceFinancialEventPublisher,
  ) {}

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
      const noteDate = new Date();
      const snapshot = await this.debitSnapshot(
        tx,
        user.tenantId,
        placement.currency,
        closings,
        noteDate,
      );

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
          noteDate,
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
      const noteDate = new Date();
      const snapshot = await this.creditSnapshot(
        tx,
        user.tenantId,
        closing,
        noteDate,
      );

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
          noteDate,
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
    const endorsement = await this.assertEndorsement(
      user.tenantId,
      placementId,
      endorsementId,
    );
    if (
      endorsement.impactType ===
      PlacementEndorsementImpactType.DECREASE_OR_CANCELLATION
    ) {
      throw new BadRequestException(
        'Endorsement debit notes are not required for decrease or cancellation endorsements',
      );
    }

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
      const noteDate = new Date();
      const snapshot = await this.endorsementDebitSnapshot(
        tx,
        user.tenantId,
        closings,
        noteDate,
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
          noteDate,
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
      const noteDate = new Date();
      const snapshot = await this.endorsementCreditSnapshot(
        tx,
        user.tenantId,
        closing,
        noteDate,
      );

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
          noteDate,
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

    const issuedAt = new Date();
    const accountingEvent =
      await this.financialEvents.prepareDebitNoteIssuedBestEffort(
        user,
        note,
        issuedAt,
      );

    return this.prisma.$transaction(async (tx) => {
      const issuedNote = await tx.placementNote.update({
        where: { id: noteId },
        data: {
          status: PlacementNoteStatus.ISSUED,
          issuedAt,
        },
        include: noteInclude,
      });

      if (accountingEvent) {
        await this.financialEvents.enqueuePreparedEvent(tx, accountingEvent);
      }

      return issuedNote;
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
  ): Promise<{ id: string; impactType: PlacementEndorsementImpactType }> {
    const endorsement = await this.prisma.placementEndorsement.findFirst({
      where: {
        id: endorsementId,
        tenantId,
        placementId,
        placement: { archivedAt: null },
      },
      select: { id: true, impactType: true },
    });
    if (!endorsement)
      throw new NotFoundException('Placement endorsement not found');
    return endorsement;
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

  private async debitSnapshot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    placementCurrency: string | null,
    closings: DebitClosingSnapshot[],
    effectiveAt: Date,
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
    const chargeResult = await this.chargeSettings.calculateCharges(
      tenantId,
      {
        currency,
        grossAmount,
        commissionAmount,
        brokerageAmount: 0,
        effectiveAt,
      },
      tx,
    );
    const legacyCharges = this.legacyChargeFields(chargeResult);

    return {
      currency,
      grossAmount,
      commissionPercent: null,
      commissionAmount,
      brokeragePercent: null,
      brokerageAmount: null,
      ...legacyCharges,
      netAmount: chargeResult.netAmount,
      appliedCharges: this.appliedChargesSnapshot(chargeResult),
    };
  }

  private async creditSnapshot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    closing: {
      currency: string | null;
      grossPremium: Prisma.Decimal | null;
      commissionPercent: Prisma.Decimal | null;
      commissionAmount: Prisma.Decimal | null;
      brokeragePercent: Prisma.Decimal | null;
      brokerageAmount: Prisma.Decimal | null;
      netPremium: Prisma.Decimal | null;
    },
    effectiveAt: Date,
  ) {
    if (!closing.currency) {
      throw new BadRequestException(
        'Closing currency is required before creating a credit note',
      );
    }

    const grossAmount = this.toNumber(closing.grossPremium);
    const commissionAmount = this.toOptionalNumber(closing.commissionAmount);
    const brokerageAmount = this.toOptionalNumber(closing.brokerageAmount);
    const chargeResult = await this.chargeSettings.calculateCharges(
      tenantId,
      {
        currency: closing.currency,
        grossAmount,
        commissionAmount: commissionAmount ?? 0,
        brokerageAmount: brokerageAmount ?? 0,
        effectiveAt,
      },
      tx,
    );
    const legacyCharges = this.legacyChargeFields(chargeResult);

    return {
      currency: closing.currency,
      grossAmount,
      commissionPercent: this.toOptionalNumber(closing.commissionPercent),
      commissionAmount,
      brokeragePercent: this.toOptionalNumber(closing.brokeragePercent),
      brokerageAmount,
      ...legacyCharges,
      netAmount:
        chargeResult.charges.length === 0
          ? this.toNumber(closing.netPremium)
          : chargeResult.netAmount,
      appliedCharges: this.appliedChargesSnapshot(chargeResult),
    };
  }

  private async endorsementDebitSnapshot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    closings: EndorsementDebitClosingSnapshot[],
    effectiveAt: Date,
  ) {
    const currencies = closings.map((closing) => closing.currency);
    if (currencies.some((currency) => !currency)) {
      throw new BadRequestException(
        'Confirmed endorsement closing currency is required before creating a debit note',
      );
    }
    const uniqueCurrencies = new Set(currencies);
    if (uniqueCurrencies.size !== 1) {
      throw new BadRequestException(
        'Endorsement debit note requires confirmed endorsement closings in a single currency',
      );
    }
    const [currency] = Array.from(uniqueCurrencies) as [string];

    const grossAmount = closings.reduce(
      (total, closing) => total + this.toNumber(closing.premiumSnapshot),
      0,
    );
    const commissionAmount = closings.reduce(
      (total, closing) => total + this.toNumber(closing.commissionAmount),
      0,
    );
    const chargeResult = await this.chargeSettings.calculateCharges(
      tenantId,
      {
        currency,
        grossAmount,
        commissionAmount,
        brokerageAmount: 0,
        effectiveAt,
      },
      tx,
    );
    const legacyCharges = this.legacyChargeFields(chargeResult);

    return {
      currency,
      grossAmount,
      commissionPercent: null,
      commissionAmount,
      brokeragePercent: null,
      brokerageAmount: null,
      ...legacyCharges,
      netAmount: chargeResult.netAmount,
      appliedCharges: this.appliedChargesSnapshot(chargeResult),
    };
  }

  private async endorsementCreditSnapshot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    closing: {
      currency: string | null;
      premiumSnapshot: Prisma.Decimal;
      commissionPercent: Prisma.Decimal | null;
      commissionAmount: Prisma.Decimal | null;
      brokeragePercent: Prisma.Decimal | null;
      brokerageAmount: Prisma.Decimal | null;
      netPremium: Prisma.Decimal | null;
    },
    effectiveAt: Date,
  ) {
    if (!closing.currency) {
      throw new BadRequestException(
        'Endorsement closing currency is required before creating a credit note',
      );
    }

    const grossAmount = this.toNumber(closing.premiumSnapshot);
    const commissionAmount = this.toOptionalNumber(closing.commissionAmount);
    const brokerageAmount = this.toOptionalNumber(closing.brokerageAmount);
    const chargeResult = await this.chargeSettings.calculateCharges(
      tenantId,
      {
        currency: closing.currency,
        grossAmount,
        commissionAmount: commissionAmount ?? 0,
        brokerageAmount: brokerageAmount ?? 0,
        effectiveAt,
      },
      tx,
    );
    const legacyCharges = this.legacyChargeFields(chargeResult);

    return {
      currency: closing.currency,
      grossAmount,
      commissionPercent: this.toOptionalNumber(closing.commissionPercent),
      commissionAmount,
      brokeragePercent: this.toOptionalNumber(closing.brokeragePercent),
      brokerageAmount,
      ...legacyCharges,
      netAmount:
        chargeResult.charges.length === 0
          ? this.toNumber(closing.netPremium)
          : chargeResult.netAmount,
      appliedCharges: this.appliedChargesSnapshot(chargeResult),
    };
  }

  private legacyChargeFields(result: ChargeCalculationResult) {
    const nicLevy = this.findCharge(
      result.charges,
      ReinsuranceChargeCode.NIC_LEVY,
    );
    const withholdingTax = this.findCharge(
      result.charges,
      ReinsuranceChargeCode.WITHHOLDING_TAX,
    );
    return {
      nicLevyPercent: this.legacyPercent(nicLevy),
      nicLevyAmount: nicLevy?.amount ?? 0,
      withholdingTaxPercent: this.legacyPercent(withholdingTax),
      withholdingTaxAmount: withholdingTax?.amount ?? 0,
    };
  }

  private findCharge(
    charges: AppliedChargeSnapshot[],
    code: ReinsuranceChargeCode,
  ): AppliedChargeSnapshot | undefined {
    return charges.find((charge) => charge.code === code);
  }

  private legacyPercent(charge: AppliedChargeSnapshot | undefined): number {
    if (!charge || charge.rateType !== ReinsuranceChargeRateType.PERCENTAGE) {
      return 0;
    }
    const rate = Number(charge.rate);
    return Number.isFinite(rate) ? rate : 0;
  }

  private appliedChargesSnapshot(
    result: ChargeCalculationResult,
  ): Prisma.InputJsonObject {
    return {
      version: 1,
      currency: result.currency,
      effectiveAt: result.effectiveAt,
      grossAmount: result.grossAmount,
      commissionAmount: result.commissionAmount,
      brokerageAmount: result.brokerageAmount,
      netBeforeCharges: result.netBeforeCharges,
      additions: result.additions,
      deductions: result.deductions,
      netAmount: result.netAmount,
      charges: result.charges as unknown as Prisma.InputJsonArray,
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
