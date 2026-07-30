import { Injectable, Logger } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReinsuranceAccountingEventInput } from './reinsurance-accounting-event.builder';
import { ReinsuranceAccountingOutboxService } from './reinsurance-accounting-outbox.service';

type PlacementNoteForEvent = {
  id: string;
  tenantId: string;
  placementId: string;
  closingId?: string | null;
  participantId?: string | null;
  endorsementId?: string | null;
  endorsementClosingId?: string | null;
  endorsementParticipantId?: string | null;
  counterpartyId: string;
  type: PlacementNoteType;
  direction: PlacementNoteDirection;
  noteNumber: string;
  status: PlacementNoteStatus;
  currency: string;
  grossAmount: Prisma.Decimal | number | string;
  commissionPercent: Prisma.Decimal | number | string | null;
  commissionAmount: Prisma.Decimal | number | string | null;
  brokeragePercent: Prisma.Decimal | number | string | null;
  brokerageAmount: Prisma.Decimal | number | string | null;
  nicLevyPercent: Prisma.Decimal | number | string | null;
  nicLevyAmount: Prisma.Decimal | number | string | null;
  withholdingTaxPercent: Prisma.Decimal | number | string | null;
  withholdingTaxAmount: Prisma.Decimal | number | string | null;
  netAmount: Prisma.Decimal | number | string;
  appliedCharges: Prisma.JsonValue | null;
  noteDate: Date;
  issuedAt: Date | null;
  counterparty?: {
    id: string;
    type: CounterpartyType;
    name: string;
    registrationNumber?: string | null;
  };
  closing?: {
    id: string;
    closingNumber: string;
  } | null;
  endorsement?: {
    id: string;
    endorsementNumber: string;
    type: string;
    impactType: string;
    effectiveDate: Date;
    status: string;
  } | null;
  endorsementClosing?: {
    id: string;
    closingNumber: string;
    endorsementParticipantId: string;
  } | null;
};

type PaymentForEvent = {
  id: string;
  tenantId: string;
  placementId: string;
  closingId: string | null;
  endorsementClosingId: string | null;
  participantId: string | null;
  counterpartyId: string;
  type: PlacementPaymentType;
  direction: PlacementPaymentDirection;
  amount: Prisma.Decimal | number | string;
  currency: string;
  paymentDate: Date;
  reference: string | null;
  settlementReference?: string | null;
  bankReference?: string | null;
  bankConfirmedAt?: Date | null;
  agreedExchangeRate?: Prisma.Decimal | number | string | null;
  bankChargeAmount?: Prisma.Decimal | number | string | null;
  withholdingTaxAmount?: Prisma.Decimal | number | string | null;
  notes: string | null;
  status: PlacementPaymentStatus;
  reversalOfPaymentId: string | null;
  counterparty?: {
    id: string;
    type: CounterpartyType;
    name: string;
    registrationNumber?: string | null;
  };
  placement?: {
    id: string;
    reference: string;
    policyNumber?: string | null;
    title: string;
    cedantId: string;
  };
  reversalOfPayment?: {
    id: string;
    amount: Prisma.Decimal | number | string;
    currency: string;
    paymentDate: Date;
    reference: string | null;
    status: PlacementPaymentStatus;
  } | null;
  allocations?: Array<{
    id: string;
    noteId: string;
    allocatedAmount: Prisma.Decimal | number | string;
    allocatedCurrency: string;
    obligationAmount: Prisma.Decimal | number | string;
    obligationCurrency: string;
    agreedExchangeRate: Prisma.Decimal | number | string | null;
    note?: {
      id: string;
      noteNumber: string;
      type: PlacementNoteType;
      currency: string;
      status?: PlacementNoteStatus;
      direction?: PlacementNoteDirection;
      netAmount?: Prisma.Decimal | number | string;
    };
  }>;
};

export type ReinsurerDisbursementRecordedEligibility = {
  accountingEnabled: boolean;
  eligible: boolean;
  exclusionReasons: string[];
  idempotencyKey: string;
};

@Injectable()
export class ReinsuranceFinancialEventPublisher {
  private readonly logger = new Logger(ReinsuranceFinancialEventPublisher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: ReinsuranceAccountingOutboxService,
  ) {}

  async prepareDebitNoteIssued(
    user: RequestUser,
    note: PlacementNoteForEvent,
    issuedAt: Date,
  ): Promise<ReinsuranceAccountingEventInput | null> {
    if (!user.moduleConfig?.accounting) {
      this.logger.debug(
        `Accounting disabled for tenant ${user.tenantId}; DEBIT_NOTE_ISSUED not enqueued for note ${note.id}`,
      );
      return null;
    }

    if (!this.isIssuedPlacementDebitNote(note, issuedAt)) {
      throw new Error(
        `Note ${note.id} is not a valid issued placement debit note`,
      );
    }

    const [placement, counterparty] = await Promise.all([
      this.prisma.placement.findFirst({
        where: {
          id: note.placementId,
          tenantId: note.tenantId,
        },
        select: {
          id: true,
          reference: true,
          policyNumber: true,
          title: true,
          cedantId: true,
        },
      }),
      this.prisma.counterparty.findFirst({
        where: {
          id: note.counterpartyId,
          tenantId: note.tenantId,
          archivedAt: null,
        },
      }),
    ]);

    if (!placement) {
      throw new Error(
        `Placement ${note.placementId} not found for issued debit note ${note.id}`,
      );
    }
    if (!counterparty || counterparty.type !== CounterpartyType.CEDANT) {
      throw new Error(
        `Cedant counterparty ${note.counterpartyId} not found for issued debit note ${note.id}`,
      );
    }

    const occurredAt = issuedAt.toISOString();
    return {
      tenantId: note.tenantId,
      sourceEventType: 'DEBIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: note.id,
      sourceDocumentId: note.id,
      idempotencyKey: `reinsurance:debit-note:${note.id}:issued:v1`,
      occurredAt,
      currency: note.currency,
      payload: {
        transactionDate: occurredAt,
        currency: note.currency,
        references: {
          placementId: placement.id,
          placementReference: placement.reference,
          policyNumber: placement.policyNumber,
          placementTitle: placement.title,
          noteId: note.id,
          noteNumber: note.noteNumber,
          noteDate: note.noteDate.toISOString(),
          issuedAt: occurredAt,
        },
        counterparty: {
          id: counterparty.id,
          type: counterparty.type,
          name: counterparty.name,
          registrationNumber: counterparty.registrationNumber,
          subledgerExternalRef: counterparty.id,
        },
        amounts: {
          grossPremium: this.decimalNumber(note.grossAmount),
          grossAmount: this.decimalNumber(note.grossAmount),
          commissionPercent: this.optionalDecimalNumber(note.commissionPercent),
          commission: this.optionalDecimalNumber(note.commissionAmount) ?? 0,
          commissionAmount:
            this.optionalDecimalNumber(note.commissionAmount) ?? 0,
          brokeragePercent: this.optionalDecimalNumber(note.brokeragePercent),
          brokerage: this.optionalDecimalNumber(note.brokerageAmount) ?? 0,
          brokerageAmount:
            this.optionalDecimalNumber(note.brokerageAmount) ?? 0,
          nicLevyPercent: this.optionalDecimalNumber(note.nicLevyPercent) ?? 0,
          nicLevy: this.optionalDecimalNumber(note.nicLevyAmount) ?? 0,
          nicLevyAmount: this.optionalDecimalNumber(note.nicLevyAmount) ?? 0,
          withholdingTaxPercent:
            this.optionalDecimalNumber(note.withholdingTaxPercent) ?? 0,
          withholdingTax:
            this.optionalDecimalNumber(note.withholdingTaxAmount) ?? 0,
          withholdingTaxAmount:
            this.optionalDecimalNumber(note.withholdingTaxAmount) ?? 0,
          netPremium: this.decimalNumber(note.netAmount),
          netAmount: this.decimalNumber(note.netAmount),
        },
        documents: {
          placementNoteId: note.id,
          placementNoteNumber: note.noteNumber,
          sourceDocumentId: note.id,
        },
        note: {
          id: note.id,
          type: note.type,
          direction: note.direction,
          number: note.noteNumber,
          status: PlacementNoteStatus.ISSUED,
          noteDate: note.noteDate.toISOString(),
          issuedAt: occurredAt,
          appliedCharges: note.appliedCharges,
        },
      },
    };
  }

  async prepareCreditNoteIssued(
    user: RequestUser,
    note: PlacementNoteForEvent,
    issuedAt: Date,
  ): Promise<ReinsuranceAccountingEventInput | null> {
    if (!user.moduleConfig?.accounting) {
      this.logger.debug(
        `Accounting disabled for tenant ${user.tenantId}; CREDIT_NOTE_ISSUED not enqueued for note ${note.id}`,
      );
      return null;
    }

    if (!this.isIssuedPlacementCreditNote(note, issuedAt)) {
      throw new Error(
        `Note ${note.id} is not a valid issued placement credit note`,
      );
    }

    const [placement, fetchedCounterparty] = await Promise.all([
      this.prisma.placement.findFirst({
        where: {
          id: note.placementId,
          tenantId: note.tenantId,
        },
        select: {
          id: true,
          reference: true,
          policyNumber: true,
          title: true,
          cedantId: true,
        },
      }),
      note.counterparty
        ? Promise.resolve(null)
        : this.prisma.counterparty.findFirst({
            where: {
              id: note.counterpartyId,
              tenantId: note.tenantId,
              archivedAt: null,
            },
          }),
    ]);

    if (!placement) {
      throw new Error(
        `Placement ${note.placementId} not found for issued credit note ${note.id}`,
      );
    }
    const counterparty = note.counterparty ?? fetchedCounterparty;
    if (!counterparty || counterparty.type !== CounterpartyType.REINSURER) {
      throw new Error(
        `Reinsurer counterparty ${note.counterpartyId} not found for issued credit note ${note.id}`,
      );
    }

    const occurredAt = issuedAt.toISOString();
    const grossPremium = Math.abs(this.decimalNumber(note.grossAmount));
    const commissionAmount = Math.abs(
      this.optionalDecimalNumber(note.commissionAmount) ?? 0,
    );
    const brokerageAmount = Math.abs(
      this.optionalDecimalNumber(note.brokerageAmount) ?? 0,
    );
    const nicLevyAmount = Math.abs(
      this.optionalDecimalNumber(note.nicLevyAmount) ?? 0,
    );
    const withholdingTaxAmount = Math.abs(
      this.optionalDecimalNumber(note.withholdingTaxAmount) ?? 0,
    );
    const totalCharges = this.roundMoney(nicLevyAmount + withholdingTaxAmount);
    const creditMagnitude = Math.abs(this.decimalNumber(note.netAmount));

    return {
      tenantId: note.tenantId,
      sourceEventType: 'CREDIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: note.id,
      sourceDocumentId: note.id,
      idempotencyKey: `reinsurance:credit-note:${note.id}:issued:v1`,
      occurredAt,
      currency: note.currency,
      payload: {
        transactionDate: occurredAt,
        currency: note.currency,
        references: {
          placementId: placement.id,
          placementReference: placement.reference,
          policyNumber: placement.policyNumber,
          placementTitle: placement.title,
          closingId: note.closingId ?? note.closing?.id ?? null,
          closingNumber: note.closing?.closingNumber ?? null,
          participantId: note.participantId ?? null,
          noteId: note.id,
          noteNumber: note.noteNumber,
          noteDate: note.noteDate.toISOString(),
          issuedAt: occurredAt,
        },
        counterparty: {
          id: counterparty.id,
          type: counterparty.type,
          name: counterparty.name,
          registrationNumber: counterparty.registrationNumber ?? null,
          subledgerExternalRef: counterparty.id,
        },
        amounts: {
          grossPremium,
          grossAmount: grossPremium,
          commissionPercent: this.optionalDecimalNumber(note.commissionPercent),
          commission: commissionAmount,
          commissionAmount,
          brokeragePercent: this.optionalDecimalNumber(note.brokeragePercent),
          brokerage: brokerageAmount,
          brokerageAmount,
          nicLevyPercent: this.optionalDecimalNumber(note.nicLevyPercent) ?? 0,
          nicLevy: nicLevyAmount,
          nicLevyAmount,
          withholdingTaxPercent:
            this.optionalDecimalNumber(note.withholdingTaxPercent) ?? 0,
          withholdingTax: withholdingTaxAmount,
          withholdingTaxAmount,
          charges: totalCharges,
          totalCharges,
          netAmount: creditMagnitude,
          creditMagnitude,
          signedReceivableImpact: 0,
          signedPayableImpact: creditMagnitude,
        },
        documents: {
          placementNoteId: note.id,
          placementNoteNumber: note.noteNumber,
          sourceDocumentId: note.id,
        },
        note: {
          id: note.id,
          type: note.type,
          direction: note.direction,
          number: note.noteNumber,
          status: PlacementNoteStatus.ISSUED,
          noteDate: note.noteDate.toISOString(),
          issuedAt: occurredAt,
          currency: note.currency,
          appliedCharges: note.appliedCharges,
          amountRepresentation: 'POSITIVE_MAGNITUDE_WITH_SIGNED_IMPACTS',
        },
      },
    };
  }

  async prepareEndorsementDebitNoteIssued(
    user: RequestUser,
    note: PlacementNoteForEvent,
    issuedAt: Date,
  ): Promise<ReinsuranceAccountingEventInput | null> {
    if (!user.moduleConfig?.accounting) {
      this.logger.debug(
        `Accounting disabled for tenant ${user.tenantId}; ENDORSEMENT_DEBIT_NOTE_ISSUED not enqueued for note ${note.id}`,
      );
      return null;
    }

    if (!this.isIssuedEndorsementDebitNote(note, issuedAt)) {
      throw new Error(
        `Note ${note.id} is not a valid issued endorsement debit note`,
      );
    }

    const placement = await this.findPlacementForNote(note);
    const counterparty = await this.findOrUseCounterparty(note);
    if (!counterparty || counterparty.type !== CounterpartyType.CEDANT) {
      throw new Error(
        `Cedant counterparty ${note.counterpartyId} not found for issued endorsement debit note ${note.id}`,
      );
    }
    const endorsement = await this.findEndorsementForNote(note);

    const occurredAt = issuedAt.toISOString();
    const grossPremiumAdjustment = this.decimalNumber(note.grossAmount);
    const commissionAdjustment =
      this.optionalDecimalNumber(note.commissionAmount) ?? 0;
    const brokerageAdjustment =
      this.optionalDecimalNumber(note.brokerageAmount) ?? 0;
    const chargesAdjustment = this.roundMoney(
      (this.optionalDecimalNumber(note.nicLevyAmount) ?? 0) +
        (this.optionalDecimalNumber(note.withholdingTaxAmount) ?? 0),
    );
    const netPremiumAdjustment = this.decimalNumber(note.netAmount);
    const adjustmentMagnitude = Math.abs(netPremiumAdjustment);

    return {
      tenantId: note.tenantId,
      sourceEventType: 'ENDORSEMENT_DEBIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: note.id,
      sourceDocumentId: note.id,
      idempotencyKey: `reinsurance:endorsement-debit-note:${note.id}:issued:v1`,
      occurredAt,
      currency: note.currency,
      payload: {
        transactionDate: occurredAt,
        currency: note.currency,
        references: {
          placementId: placement.id,
          placementReference: placement.reference,
          policyNumber: placement.policyNumber,
          placementTitle: placement.title,
          endorsementId: endorsement.id,
          endorsementReference: endorsement.endorsementNumber,
          endorsementClosingId: note.endorsementClosingId ?? null,
          endorsementParticipantId: note.endorsementParticipantId ?? null,
          noteId: note.id,
          noteNumber: note.noteNumber,
          noteDate: note.noteDate.toISOString(),
          issuedAt: occurredAt,
        },
        counterparty: {
          id: counterparty.id,
          type: counterparty.type,
          name: counterparty.name,
          registrationNumber: counterparty.registrationNumber ?? null,
          subledgerExternalRef: counterparty.id,
        },
        amounts: {
          grossPremiumAdjustment,
          grossAmount: grossPremiumAdjustment,
          commissionPercent: this.optionalDecimalNumber(note.commissionPercent),
          commissionAdjustment,
          commissionAmount: commissionAdjustment,
          brokeragePercent: this.optionalDecimalNumber(note.brokeragePercent),
          brokerageAdjustment,
          brokerageAmount: brokerageAdjustment,
          nicLevyPercent: this.optionalDecimalNumber(note.nicLevyPercent) ?? 0,
          nicLevyAdjustment:
            this.optionalDecimalNumber(note.nicLevyAmount) ?? 0,
          withholdingTaxPercent:
            this.optionalDecimalNumber(note.withholdingTaxPercent) ?? 0,
          withholdingTaxAdjustment:
            this.optionalDecimalNumber(note.withholdingTaxAmount) ?? 0,
          chargesAdjustment,
          netPremiumAdjustment,
          netAmount: netPremiumAdjustment,
          adjustmentMagnitude,
          signedReceivableImpact: netPremiumAdjustment,
          signedPayableImpact: 0,
        },
        endorsement: this.endorsementPayload(endorsement),
        documents: {
          placementNoteId: note.id,
          placementNoteNumber: note.noteNumber,
          sourceDocumentId: note.id,
        },
        note: this.notePayload(note, occurredAt),
      },
    };
  }

  async prepareEndorsementCreditNoteIssued(
    user: RequestUser,
    note: PlacementNoteForEvent,
    issuedAt: Date,
  ): Promise<ReinsuranceAccountingEventInput | null> {
    if (!user.moduleConfig?.accounting) {
      this.logger.debug(
        `Accounting disabled for tenant ${user.tenantId}; ENDORSEMENT_CREDIT_NOTE_ISSUED not enqueued for note ${note.id}`,
      );
      return null;
    }

    if (!this.isIssuedEndorsementCreditNote(note, issuedAt)) {
      throw new Error(
        `Note ${note.id} is not a valid issued endorsement credit note`,
      );
    }

    const placement = await this.findPlacementForNote(note);
    const counterparty = await this.findOrUseCounterparty(note);
    if (!counterparty || counterparty.type !== CounterpartyType.REINSURER) {
      throw new Error(
        `Reinsurer counterparty ${note.counterpartyId} not found for issued endorsement credit note ${note.id}`,
      );
    }
    const endorsement = await this.findEndorsementForNote(note);

    const occurredAt = issuedAt.toISOString();
    const rawGrossPremiumAdjustment = this.decimalNumber(note.grossAmount);
    const rawCommissionAdjustment =
      this.optionalDecimalNumber(note.commissionAmount) ?? 0;
    const rawBrokerageAdjustment =
      this.optionalDecimalNumber(note.brokerageAmount) ?? 0;
    const rawNetPremiumAdjustment = this.decimalNumber(note.netAmount);
    const grossPremiumAdjustment = Math.abs(rawGrossPremiumAdjustment);
    const commissionAdjustment = Math.abs(rawCommissionAdjustment);
    const brokerageAdjustment = Math.abs(rawBrokerageAdjustment);
    const nicLevyAdjustment = Math.abs(
      this.optionalDecimalNumber(note.nicLevyAmount) ?? 0,
    );
    const withholdingTaxAdjustment = Math.abs(
      this.optionalDecimalNumber(note.withholdingTaxAmount) ?? 0,
    );
    const chargesAdjustment = this.roundMoney(
      nicLevyAdjustment + withholdingTaxAdjustment,
    );
    const adjustmentMagnitude = Math.abs(rawNetPremiumAdjustment);

    return {
      tenantId: note.tenantId,
      sourceEventType: 'ENDORSEMENT_CREDIT_NOTE_ISSUED',
      sourceRecordType: 'PlacementNote',
      sourceRecordId: note.id,
      sourceDocumentId: note.id,
      idempotencyKey: `reinsurance:endorsement-credit-note:${note.id}:issued:v1`,
      occurredAt,
      currency: note.currency,
      payload: {
        transactionDate: occurredAt,
        currency: note.currency,
        references: {
          placementId: placement.id,
          placementReference: placement.reference,
          policyNumber: placement.policyNumber,
          placementTitle: placement.title,
          endorsementId: endorsement.id,
          endorsementReference: endorsement.endorsementNumber,
          endorsementClosingId:
            note.endorsementClosingId ?? note.endorsementClosing?.id ?? null,
          endorsementClosingNumber:
            note.endorsementClosing?.closingNumber ?? null,
          endorsementParticipantId:
            note.endorsementParticipantId ??
            note.endorsementClosing?.endorsementParticipantId ??
            null,
          noteId: note.id,
          noteNumber: note.noteNumber,
          noteDate: note.noteDate.toISOString(),
          issuedAt: occurredAt,
        },
        counterparty: {
          id: counterparty.id,
          type: counterparty.type,
          name: counterparty.name,
          registrationNumber: counterparty.registrationNumber ?? null,
          subledgerExternalRef: counterparty.id,
        },
        amounts: {
          rawGrossPremiumAdjustment,
          rawCommissionAdjustment,
          rawBrokerageAdjustment,
          rawNetPremiumAdjustment,
          grossPremiumAdjustment,
          grossAmount: grossPremiumAdjustment,
          commissionPercent: this.optionalDecimalNumber(note.commissionPercent),
          commissionAdjustment,
          commissionAmount: commissionAdjustment,
          brokeragePercent: this.optionalDecimalNumber(note.brokeragePercent),
          brokerageAdjustment,
          brokerageAmount: brokerageAdjustment,
          nicLevyPercent: this.optionalDecimalNumber(note.nicLevyPercent) ?? 0,
          nicLevyAdjustment,
          withholdingTaxPercent:
            this.optionalDecimalNumber(note.withholdingTaxPercent) ?? 0,
          withholdingTaxAdjustment,
          chargesAdjustment,
          netPremiumAdjustment: rawNetPremiumAdjustment,
          netAmount: adjustmentMagnitude,
          adjustmentMagnitude,
          returnPremiumMagnitude: adjustmentMagnitude,
          signedReceivableImpact: 0,
          signedPayableImpact: adjustmentMagnitude,
        },
        endorsement: this.endorsementPayload(endorsement),
        documents: {
          placementNoteId: note.id,
          placementNoteNumber: note.noteNumber,
          sourceDocumentId: note.id,
        },
        note: {
          ...this.notePayload(note, occurredAt),
          amountRepresentation: 'POSITIVE_MAGNITUDE_WITH_SIGNED_IMPACTS',
        },
      },
    };
  }

  preparePremiumPaymentReceived(
    user: RequestUser,
    payment: PaymentForEvent,
  ): ReinsuranceAccountingEventInput | null {
    if (!user.moduleConfig?.accounting) {
      this.logger.debug(
        `Accounting disabled for tenant ${user.tenantId}; PREMIUM_PAYMENT_RECEIVED not enqueued for payment ${payment.id}`,
      );
      return null;
    }

    if (!this.isRecordedPremiumPayment(payment)) {
      throw new Error(
        `Payment ${payment.id} is not a valid recorded premium receipt`,
      );
    }

    const placement = this.requirePlacement(payment);
    const counterparty = this.requireCedantCounterparty(payment);
    const paymentAmount = Math.abs(this.decimalNumber(payment.amount));
    const occurredAt = payment.paymentDate.toISOString();

    return {
      tenantId: payment.tenantId,
      sourceEventType: 'PREMIUM_PAYMENT_RECEIVED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: payment.id,
      sourceDocumentId: payment.id,
      idempotencyKey: `reinsurance:payment:${payment.id}:recorded:v1`,
      occurredAt,
      currency: payment.currency,
      payload: {
        transactionDate: occurredAt,
        currency: payment.currency,
        references: {
          placementId: placement.id,
          placementReference: placement.reference,
          policyNumber: placement.policyNumber,
          placementTitle: placement.title,
          paymentId: payment.id,
        },
        counterparty: {
          id: counterparty.id,
          type: counterparty.type,
          name: counterparty.name,
          registrationNumber: counterparty.registrationNumber ?? null,
          subledgerExternalRef: counterparty.id,
        },
        amounts: {
          paymentAmount,
          signedCashImpact: paymentAmount,
          signedReceivableImpact: -paymentAmount,
        },
        payment: {
          id: payment.id,
          paymentDate: occurredAt,
          paymentMethod: null,
          paymentReference: payment.reference,
          bankReference: payment.reference,
          status: payment.status,
          type: payment.type,
          direction: payment.direction,
          isReversal: false,
          reversalOfPaymentId: null,
          notes: payment.notes,
        },
        allocation: {
          model: 'PLACEMENT_LEVEL_RECEIVABLE',
          noteAllocationSupported: false,
          noteId: null,
          noteNumber: null,
        },
        documents: {
          sourceDocumentId: payment.id,
          paymentReceiptDocumentId: null,
        },
      },
    };
  }

  preparePaymentReversed(
    user: RequestUser,
    reversalPayment: PaymentForEvent,
  ): ReinsuranceAccountingEventInput | null {
    if (!user.moduleConfig?.accounting) {
      this.logger.debug(
        `Accounting disabled for tenant ${user.tenantId}; PAYMENT_REVERSED not enqueued for payment ${reversalPayment.id}`,
      );
      return null;
    }

    if (!this.isRecordedPaymentReversal(reversalPayment)) {
      throw new Error(
        `Payment ${reversalPayment.id} is not a valid recorded payment reversal`,
      );
    }

    const placement = this.requirePlacement(reversalPayment);
    const counterparty = this.requireCedantCounterparty(reversalPayment);
    const originalPayment = reversalPayment.reversalOfPayment;
    if (!originalPayment) {
      throw new Error(
        `Reversal payment ${reversalPayment.id} is missing its original payment reference`,
      );
    }
    const paymentAmount = Math.abs(this.decimalNumber(reversalPayment.amount));
    const occurredAt = reversalPayment.paymentDate.toISOString();

    return {
      tenantId: reversalPayment.tenantId,
      sourceEventType: 'PAYMENT_REVERSED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: reversalPayment.id,
      sourceDocumentId: reversalPayment.id,
      idempotencyKey: `reinsurance:payment:${reversalPayment.id}:reversal:v1`,
      occurredAt,
      currency: reversalPayment.currency,
      payload: {
        transactionDate: occurredAt,
        currency: reversalPayment.currency,
        references: {
          placementId: placement.id,
          placementReference: placement.reference,
          policyNumber: placement.policyNumber,
          placementTitle: placement.title,
          originalPaymentId: originalPayment.id,
          reversalPaymentId: reversalPayment.id,
          paymentId: reversalPayment.id,
        },
        counterparty: {
          id: counterparty.id,
          type: counterparty.type,
          name: counterparty.name,
          registrationNumber: counterparty.registrationNumber ?? null,
          subledgerExternalRef: counterparty.id,
        },
        amounts: {
          paymentAmount,
          originalPaymentAmount: Math.abs(
            this.decimalNumber(originalPayment.amount),
          ),
          signedCashImpact: -paymentAmount,
          signedReceivableImpact: paymentAmount,
        },
        payment: {
          id: reversalPayment.id,
          originalPaymentId: originalPayment.id,
          reversalPaymentId: reversalPayment.id,
          paymentDate: occurredAt,
          originalPaymentDate: originalPayment.paymentDate.toISOString(),
          paymentMethod: null,
          paymentReference: reversalPayment.reference,
          originalPaymentReference: originalPayment.reference,
          bankReference: reversalPayment.reference,
          status: reversalPayment.status,
          originalPaymentStatus: originalPayment.status,
          type: reversalPayment.type,
          direction: reversalPayment.direction,
          isReversal: true,
          notes: reversalPayment.notes,
        },
        allocation: {
          model: 'PLACEMENT_LEVEL_RECEIVABLE',
          noteAllocationSupported: false,
          noteId: null,
          noteNumber: null,
        },
        documents: {
          sourceDocumentId: reversalPayment.id,
          paymentReceiptDocumentId: null,
        },
      },
    };
  }

  prepareReinsurerDisbursementRecorded(
    user: RequestUser,
    payment: PaymentForEvent,
  ): ReinsuranceAccountingEventInput | null {
    const eligibility = this.classifyReinsurerDisbursementRecorded(
      user,
      payment,
    );
    if (!eligibility.accountingEnabled) {
      this.logger.debug(
        `Accounting disabled for tenant ${user.tenantId}; REINSURER_DISBURSEMENT_RECORDED not enqueued for payment ${payment.id}`,
      );
      return null;
    }
    if (!eligibility.eligible) {
      throw new Error(
        `Payment ${payment.id} is not eligible for REINSURER_DISBURSEMENT_RECORDED: ${eligibility.exclusionReasons.join(', ')}`,
      );
    }

    const placement = this.requirePlacement(payment);
    const counterparty = this.requireReinsurerCounterparty(payment);
    const paymentAmount = Math.abs(this.decimalNumber(payment.amount));
    const allocatedAmount = this.roundMoney(
      (payment.allocations ?? []).reduce(
        (total, allocation) =>
          total + Math.abs(this.decimalNumber(allocation.allocatedAmount)),
        0,
      ),
    );
    const unallocatedAmount = this.roundMoney(paymentAmount - allocatedAmount);
    const bankCharges = Math.abs(
      this.optionalDecimalNumber(payment.bankChargeAmount) ?? 0,
    );
    const withholdingTax = Math.abs(
      this.optionalDecimalNumber(payment.withholdingTaxAmount) ?? 0,
    );
    const occurredAt = payment.bankConfirmedAt?.toISOString();
    if (!occurredAt) {
      throw new Error(
        `Payment ${payment.id} is missing bankConfirmedAt for REINSURER_DISBURSEMENT_RECORDED`,
      );
    }
    const exchangeRate = this.optionalDecimalNumber(payment.agreedExchangeRate);

    return {
      tenantId: payment.tenantId,
      sourceEventType: 'REINSURER_DISBURSEMENT_RECORDED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: payment.id,
      sourceDocumentId: payment.id,
      idempotencyKey: this.reinsurerDisbursementRecordedIdempotencyKey(
        payment.id,
      ),
      occurredAt,
      currency: payment.currency,
      payload: {
        transactionDate: occurredAt,
        currency: payment.currency,
        ...(exchangeRate ? { exchangeRate } : {}),
        references: {
          placementId: placement.id,
          placementReference: placement.reference,
          policyNumber: placement.policyNumber,
          placementTitle: placement.title,
          paymentId: payment.id,
          paymentReference: payment.reference,
          settlementReference: payment.settlementReference ?? null,
        },
        counterparty: {
          id: counterparty.id,
          type: counterparty.type,
          name: counterparty.name,
          registrationNumber: counterparty.registrationNumber ?? null,
          subledgerExternalRef: counterparty.id,
        },
        payment: {
          id: payment.id,
          status: payment.status,
          type: payment.type,
          direction: payment.direction,
          paymentDate: payment.paymentDate.toISOString(),
          bankConfirmedAt: occurredAt,
          paymentReference: payment.reference,
          settlementReference: payment.settlementReference ?? null,
          bankReference: payment.bankReference,
          method: null,
          currency: payment.currency,
          agreedExchangeRate: exchangeRate,
          isReversal: false,
          reversalOfPaymentId: null,
          notes: payment.notes,
        },
        amounts: {
          paymentAmount,
          allocatedAmount,
          unallocatedAmount,
          bankCharges,
          withholdingTax,
          signedCashImpact: -paymentAmount,
          signedPayableImpact: -allocatedAmount,
        },
        allocations: (payment.allocations ?? []).map((allocation) => ({
          allocationId: allocation.id,
          creditNoteId: allocation.noteId,
          creditNoteNumber: allocation.note?.noteNumber ?? null,
          obligationType: allocation.note?.type ?? null,
          obligationCurrency: allocation.obligationCurrency,
          allocatedAmount: this.decimalNumber(allocation.obligationAmount),
          paymentCurrencyAmount: this.decimalNumber(allocation.allocatedAmount),
          agreedExchangeRate: this.optionalDecimalNumber(
            allocation.agreedExchangeRate,
          ),
        })),
        allocation: {
          model: 'CREDIT_NOTE_ALLOCATIONS',
          allocationCount: payment.allocations?.length ?? 0,
          supportsOnePaymentToManyCreditNotes: true,
          supportsManyPaymentsToOneCreditNote: true,
          unallocatedPaymentsSupported: false,
        },
        documents: {
          sourceDocumentId: payment.id,
          paymentDocumentId: null,
        },
      },
    };
  }

  classifyReinsurerDisbursementRecorded(
    user: RequestUser,
    payment: PaymentForEvent,
  ): ReinsurerDisbursementRecordedEligibility {
    const exclusionReasons: string[] = [];
    if (!user.moduleConfig?.accounting) {
      exclusionReasons.push('accounting disabled');
    }
    if (payment.type !== PlacementPaymentType.REINSURER_DISBURSEMENT) {
      exclusionReasons.push('wrong payment type');
    }
    if (payment.direction !== PlacementPaymentDirection.OUTBOUND) {
      exclusionReasons.push('wrong direction');
    }
    if (payment.status === PlacementPaymentStatus.FAILED) {
      exclusionReasons.push('failed payment');
    } else if (payment.status === PlacementPaymentStatus.CANCELLED) {
      exclusionReasons.push('cancelled payment');
    } else if (payment.status !== PlacementPaymentStatus.BANK_CONFIRMED) {
      exclusionReasons.push('unsupported status');
    }
    if (payment.reversalOfPaymentId) {
      exclusionReasons.push('reversal row');
    }
    if (!payment.counterparty) {
      exclusionReasons.push('missing reinsurer');
    } else if (payment.counterparty.type !== CounterpartyType.REINSURER) {
      exclusionReasons.push('missing reinsurer');
    }
    if (!payment.bankConfirmedAt) {
      exclusionReasons.push('missing bank confirmation date');
    }
    if (!payment.currency?.trim()) {
      exclusionReasons.push('missing payment currency');
    }

    const allocations = payment.allocations ?? [];
    if (allocations.length === 0) {
      exclusionReasons.push('no allocations');
    } else {
      const paymentCurrency = payment.currency?.trim().toUpperCase();
      let allocatedTotal = 0;
      for (const allocation of allocations) {
        allocatedTotal = this.roundMoney(
          allocatedTotal + this.decimalNumber(allocation.allocatedAmount),
        );
        if (!allocation.note) {
          exclusionReasons.push('missing credit note');
          continue;
        }
        if (
          allocation.note.type !== PlacementNoteType.CREDIT_NOTE &&
          allocation.note.type !== PlacementNoteType.ENDORSEMENT_CREDIT_NOTE
        ) {
          exclusionReasons.push('unsupported obligation type');
        }
        if (
          allocation.note.status !== undefined &&
          allocation.note.status !== PlacementNoteStatus.ISSUED
        ) {
          exclusionReasons.push('missing credit note');
        }
        if (
          allocation.note.direction !== undefined &&
          allocation.note.direction !==
            PlacementNoteDirection.BROKER_TO_REINSURER
        ) {
          exclusionReasons.push('unsupported obligation type');
        }
        if (
          paymentCurrency &&
          allocation.obligationCurrency.trim().toUpperCase() !==
            paymentCurrency &&
          !allocation.agreedExchangeRate &&
          !payment.agreedExchangeRate
        ) {
          exclusionReasons.push('missing agreed FX rate');
        }
      }
      const paymentAmount = Math.abs(this.decimalNumber(payment.amount));
      if (this.roundMoney(allocatedTotal) !== this.roundMoney(paymentAmount)) {
        exclusionReasons.push('incomplete allocation');
      }
    }

    const uniqueReasons = [...new Set(exclusionReasons)];
    return {
      accountingEnabled: Boolean(user.moduleConfig?.accounting),
      eligible: uniqueReasons.length === 0,
      exclusionReasons: uniqueReasons,
      idempotencyKey: this.reinsurerDisbursementRecordedIdempotencyKey(
        payment.id,
      ),
    };
  }

  enqueuePreparedEvent(
    tx: Prisma.TransactionClient,
    event: ReinsuranceAccountingEventInput,
  ) {
    return this.outbox.enqueueAccountingEvent(tx, event);
  }

  private isIssuedPlacementDebitNote(
    note: PlacementNoteForEvent,
    issuedAt: Date,
  ): boolean {
    return (
      note.type === PlacementNoteType.DEBIT_NOTE &&
      note.direction === PlacementNoteDirection.CEDANT_TO_BROKER &&
      (note.status === PlacementNoteStatus.DRAFT ||
        note.status === PlacementNoteStatus.ISSUED) &&
      issuedAt instanceof Date &&
      !Number.isNaN(issuedAt.getTime()) &&
      note.currency.trim().length === 3 &&
      this.decimalNumber(note.netAmount) > 0
    );
  }

  private isIssuedPlacementCreditNote(
    note: PlacementNoteForEvent,
    issuedAt: Date,
  ): boolean {
    return (
      note.type === PlacementNoteType.CREDIT_NOTE &&
      note.direction === PlacementNoteDirection.BROKER_TO_REINSURER &&
      (note.status === PlacementNoteStatus.DRAFT ||
        note.status === PlacementNoteStatus.ISSUED) &&
      issuedAt instanceof Date &&
      !Number.isNaN(issuedAt.getTime()) &&
      note.currency.trim().length === 3 &&
      this.decimalNumber(note.netAmount) > 0
    );
  }

  private isIssuedEndorsementDebitNote(
    note: PlacementNoteForEvent,
    issuedAt: Date,
  ): boolean {
    return (
      note.type === PlacementNoteType.ENDORSEMENT_DEBIT_NOTE &&
      note.direction === PlacementNoteDirection.CEDANT_TO_BROKER &&
      typeof note.endorsementId === 'string' &&
      note.endorsementId.trim().length > 0 &&
      (note.status === PlacementNoteStatus.DRAFT ||
        note.status === PlacementNoteStatus.ISSUED) &&
      issuedAt instanceof Date &&
      !Number.isNaN(issuedAt.getTime()) &&
      note.currency.trim().length === 3 &&
      this.decimalNumber(note.netAmount) > 0
    );
  }

  private isIssuedEndorsementCreditNote(
    note: PlacementNoteForEvent,
    issuedAt: Date,
  ): boolean {
    return (
      note.type === PlacementNoteType.ENDORSEMENT_CREDIT_NOTE &&
      note.direction === PlacementNoteDirection.BROKER_TO_REINSURER &&
      typeof note.endorsementId === 'string' &&
      note.endorsementId.trim().length > 0 &&
      typeof note.endorsementClosingId === 'string' &&
      note.endorsementClosingId.trim().length > 0 &&
      (note.status === PlacementNoteStatus.DRAFT ||
        note.status === PlacementNoteStatus.ISSUED) &&
      issuedAt instanceof Date &&
      !Number.isNaN(issuedAt.getTime()) &&
      note.currency.trim().length === 3 &&
      Math.abs(this.decimalNumber(note.netAmount)) > 0
    );
  }

  private async findPlacementForNote(note: PlacementNoteForEvent) {
    const placement = await this.prisma.placement.findFirst({
      where: {
        id: note.placementId,
        tenantId: note.tenantId,
      },
      select: {
        id: true,
        reference: true,
        policyNumber: true,
        title: true,
        cedantId: true,
      },
    });
    if (!placement) {
      throw new Error(
        `Placement ${note.placementId} not found for issued note ${note.id}`,
      );
    }
    return placement;
  }

  private async findOrUseCounterparty(note: PlacementNoteForEvent) {
    return (
      note.counterparty ??
      (await this.prisma.counterparty.findFirst({
        where: {
          id: note.counterpartyId,
          tenantId: note.tenantId,
          archivedAt: null,
        },
        select: {
          id: true,
          type: true,
          name: true,
          registrationNumber: true,
        },
      }))
    );
  }

  private async findEndorsementForNote(note: PlacementNoteForEvent) {
    if (note.endorsement) return note.endorsement;
    const endorsement = await this.prisma.placementEndorsement.findFirst({
      where: {
        id: note.endorsementId ?? '',
        tenantId: note.tenantId,
        placementId: note.placementId,
      },
      select: {
        id: true,
        endorsementNumber: true,
        type: true,
        impactType: true,
        effectiveDate: true,
        status: true,
      },
    });
    if (!endorsement) {
      throw new Error(
        `Endorsement ${note.endorsementId ?? ''} not found for issued endorsement note ${note.id}`,
      );
    }
    return endorsement;
  }

  private endorsementPayload(endorsement: {
    id: string;
    endorsementNumber: string;
    type: string;
    impactType: string;
    effectiveDate: Date;
    status: string;
  }) {
    return {
      id: endorsement.id,
      reference: endorsement.endorsementNumber,
      type: endorsement.type,
      impactType: endorsement.impactType,
      effectiveDate: endorsement.effectiveDate.toISOString(),
      status: endorsement.status,
    };
  }

  private notePayload(note: PlacementNoteForEvent, issuedAt: string) {
    return {
      id: note.id,
      type: note.type,
      direction: note.direction,
      number: note.noteNumber,
      status: PlacementNoteStatus.ISSUED,
      noteDate: note.noteDate.toISOString(),
      issuedAt,
      currency: note.currency,
      appliedCharges: note.appliedCharges,
    };
  }

  private isRecordedPremiumPayment(payment: PaymentForEvent): boolean {
    return (
      payment.type === PlacementPaymentType.PREMIUM_RECEIVED &&
      payment.direction === PlacementPaymentDirection.INBOUND &&
      payment.status === PlacementPaymentStatus.RECORDED &&
      payment.reversalOfPaymentId === null &&
      payment.paymentDate instanceof Date &&
      !Number.isNaN(payment.paymentDate.getTime()) &&
      payment.currency.trim().length === 3 &&
      this.decimalNumber(payment.amount) > 0
    );
  }

  private isRecordedPaymentReversal(payment: PaymentForEvent): boolean {
    return (
      payment.type === PlacementPaymentType.PREMIUM_RECEIVED &&
      payment.direction === PlacementPaymentDirection.INBOUND &&
      payment.status === PlacementPaymentStatus.RECORDED &&
      typeof payment.reversalOfPaymentId === 'string' &&
      payment.reversalOfPaymentId.trim().length > 0 &&
      payment.paymentDate instanceof Date &&
      !Number.isNaN(payment.paymentDate.getTime()) &&
      payment.currency.trim().length === 3 &&
      this.decimalNumber(payment.amount) < 0
    );
  }

  private requirePlacement(payment: PaymentForEvent) {
    if (!payment.placement) {
      throw new Error(
        `Placement ${payment.placementId} not available for payment ${payment.id}`,
      );
    }
    return payment.placement;
  }

  private requireCedantCounterparty(payment: PaymentForEvent) {
    if (
      !payment.counterparty ||
      payment.counterparty.type !== CounterpartyType.CEDANT
    ) {
      throw new Error(
        `Cedant counterparty ${payment.counterpartyId} not available for payment ${payment.id}`,
      );
    }
    return payment.counterparty;
  }

  private requireReinsurerCounterparty(payment: PaymentForEvent) {
    if (
      !payment.counterparty ||
      payment.counterparty.type !== CounterpartyType.REINSURER
    ) {
      throw new Error(
        `Reinsurer counterparty ${payment.counterpartyId} not available for payment ${payment.id}`,
      );
    }
    return payment.counterparty;
  }

  private reinsurerDisbursementRecordedIdempotencyKey(paymentId: string) {
    return `reinsurance:reinsurer-disbursement:${paymentId}:recorded:v1`;
  }

  private optionalDecimalNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined) return null;
    return this.decimalNumber(value);
  }

  private decimalNumber(value: Prisma.Decimal | number | string): number {
    const raw =
      value instanceof Prisma.Decimal
        ? value.toString()
        : typeof value === 'number'
          ? value.toString()
          : value;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid monetary value ${raw}`);
    }
    return parsed;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
