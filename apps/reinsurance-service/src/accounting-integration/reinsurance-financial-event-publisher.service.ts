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
  PlacementSettlementMethod,
  PlacementClaimAllocationStatus,
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
  settlementMethod?: PlacementSettlementMethod | null;
  settlementCurrency?: string | null;
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
  closing?: {
    id: string;
    closingNumber: string;
    netPremium?: Prisma.Decimal | number | string | null;
    currency?: string | null;
  } | null;
  endorsementClosing?: {
    id: string;
    closingNumber: string;
    netPremium?: Prisma.Decimal | number | string | null;
    currency?: string | null;
    endorsementId?: string;
    endorsement?: {
      id: string;
      endorsementNumber: string;
      effectiveDate: Date;
      type: string;
    } | null;
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
      nicLevyPercent?: Prisma.Decimal | number | string | null;
      nicLevyAmount?: Prisma.Decimal | number | string | null;
      withholdingTaxPercent?: Prisma.Decimal | number | string | null;
      withholdingTaxAmount?: Prisma.Decimal | number | string | null;
    };
  }>;
};

type ClaimPayableApprovalForEvent = {
  id: string;
  tenantId: string;
  placementId: string;
  claimId: string;
  approvalVersion: number;
  approvedPayableAmount: Prisma.Decimal | number | string;
  finalLossAmount: Prisma.Decimal | number | string;
  currency: string;
  approvedAt: Date;
  approvedByUserId: string;
  notes?: string | null;
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

  async prepareClaimPayableApproved(
    user: RequestUser,
    approval: ClaimPayableApprovalForEvent,
  ): Promise<ReinsuranceAccountingEventInput | null> {
    if (!user.moduleConfig?.accounting) {
      this.logger.debug(
        `Accounting disabled for tenant ${user.tenantId}; CLAIM_PAYABLE_APPROVED not enqueued for approval ${approval.id}`,
      );
      return null;
    }

    if (approval.tenantId !== user.tenantId) {
      throw new Error(
        `Claim payable approval ${approval.id} does not belong to tenant ${user.tenantId}`,
      );
    }

    const [claim, allocations] = await Promise.all([
      this.prisma.placementClaim.findFirst({
        where: {
          id: approval.claimId,
          tenantId: approval.tenantId,
          placementId: approval.placementId,
        },
        select: {
          id: true,
          claimNumber: true,
          currency: true,
          finalLossAmount: true,
          placement: {
            select: {
              id: true,
              reference: true,
              policyNumber: true,
              title: true,
              cedantId: true,
            },
          },
        },
      }),
      this.prisma.placementClaimAllocation.findMany({
        where: {
          tenantId: approval.tenantId,
          placementId: approval.placementId,
          claimId: approval.claimId,
          status: { not: PlacementClaimAllocationStatus.VOID },
        },
        select: {
          id: true,
          placementClosingId: true,
          endorsementClosingId: true,
          participantId: true,
          endorsementParticipantId: true,
          counterpartyId: true,
          signedLinePercent: true,
          allocatedFinalLossAmount: true,
          cashCallAmount: true,
          counterparty: {
            select: {
              id: true,
              type: true,
              name: true,
              registrationNumber: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    if (!claim) {
      throw new Error(
        `Claim ${approval.claimId} not found for payable approval ${approval.id}`,
      );
    }
    if (claim.currency !== approval.currency) {
      throw new Error(
        `Claim payable approval ${approval.id} currency does not match claim currency`,
      );
    }
    if (allocations.length === 0) {
      throw new Error(
        `Claim payable approval ${approval.id} requires at least one active reinsurer allocation`,
      );
    }
    const invalidAllocation = allocations.find(
      (allocation) =>
        allocation.counterparty.type !== CounterpartyType.REINSURER,
    );
    if (invalidAllocation) {
      throw new Error(
        `Claim payable approval ${approval.id} has non-reinsurer allocation counterparty ${invalidAllocation.counterpartyId}`,
      );
    }

    const cedant = await this.prisma.counterparty.findFirst({
      where: {
        id: claim.placement.cedantId,
        tenantId: approval.tenantId,
        archivedAt: null,
      },
      select: {
        id: true,
        type: true,
        name: true,
        registrationNumber: true,
      },
    });
    if (!cedant || cedant.type !== CounterpartyType.CEDANT) {
      throw new Error(
        `Cedant counterparty ${claim.placement.cedantId} not found for claim payable approval ${approval.id}`,
      );
    }

    const occurredAt = approval.approvedAt.toISOString();
    const approvedPayableAmount = this.decimalNumber(
      approval.approvedPayableAmount,
    );
    const finalLossAmount = this.decimalNumber(approval.finalLossAmount);

    return {
      tenantId: approval.tenantId,
      sourceEventType: 'CLAIM_PAYABLE_APPROVED',
      sourceRecordType: 'PlacementClaimPayableApproval',
      sourceRecordId: approval.id,
      sourceDocumentId: approval.claimId,
      idempotencyKey: `reinsurance:claim:${approval.claimId}:payable-approved:${approval.approvalVersion}:v1`,
      occurredAt,
      currency: approval.currency,
      payload: {
        transactionDate: occurredAt,
        currency: approval.currency,
        references: {
          placementId: claim.placement.id,
          placementReference: claim.placement.reference,
          policyNumber: claim.placement.policyNumber,
          placementTitle: claim.placement.title,
          claimId: claim.id,
          claimNumber: claim.claimNumber,
          approvalId: approval.id,
          approvalVersion: approval.approvalVersion,
          approvedAt: occurredAt,
          approvedByUserId: approval.approvedByUserId,
        },
        cedant: {
          id: cedant.id,
          type: cedant.type,
          name: cedant.name,
          registrationNumber: cedant.registrationNumber ?? null,
          subledgerExternalRef: cedant.id,
        },
        reinsurers: allocations.map((allocation) => ({
          allocationId: allocation.id,
          counterpartyId: allocation.counterpartyId,
          counterpartyType: allocation.counterparty.type,
          counterpartyName: allocation.counterparty.name,
          registrationNumber: allocation.counterparty.registrationNumber,
          subledgerExternalRef: allocation.counterpartyId,
          placementClosingId: allocation.placementClosingId,
          endorsementClosingId: allocation.endorsementClosingId,
          participantId: allocation.participantId,
          endorsementParticipantId: allocation.endorsementParticipantId,
          signedLinePercent: this.decimalNumber(allocation.signedLinePercent),
          allocatedFinalLossAmount: this.optionalDecimalNumber(
            allocation.allocatedFinalLossAmount,
          ),
          cashCallAmount: this.optionalDecimalNumber(allocation.cashCallAmount),
        })),
        amounts: {
          approvedPayableAmount,
          finalLossAmount,
          signedClaimPayableImpact: approvedPayableAmount,
        },
        claim: {
          id: claim.id,
          claimNumber: claim.claimNumber,
          currency: claim.currency,
          finalLossAmount,
        },
        approval: {
          id: approval.id,
          version: approval.approvalVersion,
          approvedAt: occurredAt,
          approvedByUserId: approval.approvedByUserId,
          notes: approval.notes ?? null,
          recognitionBoundary: 'REINSURER_FINAL_CLAIM_APPROVAL',
        },
        policy: {
          scope:
            'Reinsurance claims between Cedant and Reinsurers through Broker',
          postingEngine: 'POSTING_RULES',
          claimSettlementTaxTreatment: 'NOT_APPLICABLE',
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
        `Payment ${payment.id} is not a valid bank-confirmed premium receipt`,
      );
    }

    const placement = this.requirePlacement(payment);
    const counterparty = this.requireCedantCounterparty(payment);
    const paymentAmount = Math.abs(this.decimalNumber(payment.amount));
    const occurredAt = payment.bankConfirmedAt?.toISOString();
    if (!occurredAt) {
      throw new Error(
        `Payment ${payment.id} is missing bankConfirmedAt for PREMIUM_PAYMENT_RECEIVED`,
      );
    }
    const exchangeRate = this.optionalDecimalNumber(payment.agreedExchangeRate);
    const bankCharges = Math.abs(
      this.optionalDecimalNumber(payment.bankChargeAmount) ?? 0,
    );
    const settlementMethod =
      payment.settlementMethod ?? PlacementSettlementMethod.BANK_TRANSFER;
    const settlementCurrency = payment.settlementCurrency ?? payment.currency;
    const cashAffecting = this.isCashAffectingSettlement(settlementMethod);
    const signedCashImpact = cashAffecting ? paymentAmount : 0;

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
        amounts: {
          paymentAmount,
          bankCharges,
          signedCashImpact,
          signedReceivableImpact: -paymentAmount,
          cashAffectingSettlement: cashAffecting,
        },
        payment: {
          id: payment.id,
          paymentDate: payment.paymentDate.toISOString(),
          bankConfirmedAt: occurredAt,
          paymentMethod: settlementMethod,
          paymentReference: payment.reference,
          settlementReference: payment.settlementReference ?? null,
          bankReference: payment.bankReference,
          settlementMethod,
          method: settlementMethod,
          currency: payment.currency,
          settlementCurrency,
          agreedExchangeRate: exchangeRate,
          confirmedExchangeRate: exchangeRate,
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
    const settlementMethod =
      reversalPayment.settlementMethod ??
      PlacementSettlementMethod.BANK_TRANSFER;
    const settlementCurrency =
      reversalPayment.settlementCurrency ?? reversalPayment.currency;
    const cashAffecting = this.isCashAffectingSettlement(settlementMethod);
    const signedCashImpact = cashAffecting ? -paymentAmount : 0;

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
          signedCashImpact,
          signedReceivableImpact: paymentAmount,
          cashAffectingSettlement: cashAffecting,
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
          settlementMethod,
          method: settlementMethod,
          settlementCurrency,
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
    const sourceCharges = this.sourceChargeFacts(payment);
    const occurredAt = payment.bankConfirmedAt?.toISOString();
    if (!occurredAt) {
      throw new Error(
        `Payment ${payment.id} is missing bankConfirmedAt for REINSURER_DISBURSEMENT_RECORDED`,
      );
    }
    const exchangeRate = this.optionalDecimalNumber(payment.agreedExchangeRate);
    const settlementMethod =
      payment.settlementMethod ?? PlacementSettlementMethod.BANK_TRANSFER;
    const settlementCurrency = payment.settlementCurrency ?? payment.currency;
    const cashAffecting = this.isCashAffectingSettlement(settlementMethod);
    const signedCashImpact = cashAffecting ? -paymentAmount : 0;

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
          closingId: payment.closingId ?? payment.closing?.id ?? null,
          closingNumber: payment.closing?.closingNumber ?? null,
          endorsementClosingId:
            payment.endorsementClosingId ??
            payment.endorsementClosing?.id ??
            null,
          endorsementClosingNumber:
            payment.endorsementClosing?.closingNumber ?? null,
          endorsementId: payment.endorsementClosing?.endorsementId ?? null,
          endorsementReference:
            payment.endorsementClosing?.endorsement?.endorsementNumber ?? null,
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
          settlementMethod,
          method: settlementMethod,
          currency: payment.currency,
          settlementCurrency,
          agreedExchangeRate: exchangeRate,
          confirmedExchangeRate: exchangeRate,
          isReversal: false,
          reversalOfPaymentId: null,
          notes: payment.notes,
        },
        amounts: {
          paymentAmount,
          allocatedAmount,
          unallocatedAmount,
          bankCharges,
          nicLevyAmount: sourceCharges.nicLevyAmount,
          contractualWithholdingTaxAmount:
            sourceCharges.contractualWithholdingTaxAmount,
          contractualWithholdingTaxRate:
            sourceCharges.contractualWithholdingTaxRate,
          withholdingTax: sourceCharges.contractualWithholdingTaxAmount,
          signedCashImpact,
          signedPayableImpact: -allocatedAmount,
          cashAffectingSettlement: cashAffecting,
        },
        sourceCharges,
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
          nicLevyAmount: this.optionalDecimalNumber(
            allocation.note?.nicLevyAmount,
          ),
          contractualWithholdingTaxAmount: this.optionalDecimalNumber(
            allocation.note?.withholdingTaxAmount,
          ),
          contractualWithholdingTaxRate: this.optionalDecimalNumber(
            allocation.note?.withholdingTaxPercent,
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
    const paymentCurrency = payment.currency?.trim().toUpperCase();
    const settlementCurrency =
      payment.settlementCurrency?.trim().toUpperCase() ?? paymentCurrency;
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
        allocation.note.direction !== PlacementNoteDirection.BROKER_TO_REINSURER
      ) {
        exclusionReasons.push('unsupported obligation type');
      }
      if (
        paymentCurrency &&
        allocation.obligationCurrency.trim().toUpperCase() !==
          settlementCurrency &&
        !allocation.agreedExchangeRate &&
        !payment.agreedExchangeRate
      ) {
        exclusionReasons.push('missing agreed FX rate');
      }
    }
    if (allocations.length > 0) {
      const paymentAmount = Math.abs(this.decimalNumber(payment.amount));
      if (this.roundMoney(allocatedTotal) !== this.roundMoney(paymentAmount)) {
        exclusionReasons.push('incomplete allocation');
      }
    }
    if (allocations.length === 0 && settlementCurrency) {
      const obligationCurrency =
        payment.closing?.currency?.trim().toUpperCase() ??
        payment.endorsementClosing?.currency?.trim().toUpperCase() ??
        paymentCurrency;
      if (
        obligationCurrency &&
        obligationCurrency !== settlementCurrency &&
        !payment.agreedExchangeRate
      ) {
        exclusionReasons.push('missing agreed FX rate');
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

  private isCashAffectingSettlement(
    method: PlacementSettlementMethod,
  ): boolean {
    const cashAffectingMethods: PlacementSettlementMethod[] = [
      PlacementSettlementMethod.BANK_TRANSFER,
      PlacementSettlementMethod.CHEQUE,
      PlacementSettlementMethod.CASH,
      PlacementSettlementMethod.MOBILE_MONEY,
    ];
    return cashAffectingMethods.includes(method);
  }

  private sourceChargeFacts(payment: PaymentForEvent): {
    nicLevyAmount: number | null;
    contractualWithholdingTaxAmount: number | null;
    contractualWithholdingTaxRate: number | null;
    sources: Array<{
      noteId: string;
      noteNumber: string | null;
      noteType: PlacementNoteType | null;
      allocatedObligationAmount: number;
      noteNetAmount: number | null;
      allocationRatio: number | null;
      nicLevyAmount: number | null;
      withholdingTaxAmount: number | null;
      withholdingTaxRate: number | null;
    }>;
  } {
    const sources = (payment.allocations ?? [])
      .filter((allocation) => allocation.note)
      .map((allocation) => {
        const note = allocation.note!;
        const allocatedObligationAmount = Math.abs(
          this.decimalNumber(allocation.obligationAmount),
        );
        const noteNetAmountRaw = this.optionalDecimalNumber(note.netAmount);
        const noteNetAmount =
          noteNetAmountRaw === null ? null : Math.abs(noteNetAmountRaw);
        const allocationRatio =
          noteNetAmount && noteNetAmount > 0
            ? allocatedObligationAmount / noteNetAmount
            : null;
        const ratio = allocationRatio ?? 1;
        const nicLevyAmount = this.proportionalSourceAmount(
          note.nicLevyAmount,
          ratio,
        );
        const withholdingTaxAmount = this.proportionalSourceAmount(
          note.withholdingTaxAmount,
          ratio,
        );

        return {
          noteId: note.id,
          noteNumber: note.noteNumber ?? null,
          noteType: note.type ?? null,
          allocatedObligationAmount,
          noteNetAmount,
          allocationRatio:
            allocationRatio === null ? null : this.roundMoney(allocationRatio),
          nicLevyAmount,
          withholdingTaxAmount,
          withholdingTaxRate: this.optionalDecimalNumber(
            note.withholdingTaxPercent,
          ),
        };
      });

    const nicLevyAmount = this.nullIfZero(
      this.roundMoney(
        sources.reduce(
          (total, source) => total + (source.nicLevyAmount ?? 0),
          0,
        ),
      ),
    );
    const contractualWithholdingTaxAmount = this.nullIfZero(
      this.roundMoney(
        sources.reduce(
          (total, source) => total + (source.withholdingTaxAmount ?? 0),
          0,
        ),
      ),
    );
    const uniqueRates = [
      ...new Set(
        sources
          .map((source) => source.withholdingTaxRate)
          .filter((rate): rate is number => rate !== null),
      ),
    ];

    return {
      nicLevyAmount,
      contractualWithholdingTaxAmount,
      contractualWithholdingTaxRate:
        uniqueRates.length === 1 ? uniqueRates[0] : null,
      sources,
    };
  }

  private proportionalSourceAmount(
    amount: Prisma.Decimal | number | string | null | undefined,
    ratio: number,
  ): number | null {
    const parsed = this.optionalDecimalNumber(amount);
    if (parsed === null) return null;
    return this.nullIfZero(this.roundMoney(Math.abs(parsed) * ratio));
  }

  private nullIfZero(value: number): number | null {
    return value === 0 ? null : value;
  }

  prepareReinsurerDisbursementReversed(
    user: RequestUser,
    reversalPayment: PaymentForEvent,
  ): ReinsuranceAccountingEventInput | null {
    const eligibility = this.classifyReinsurerDisbursementReversed(
      user,
      reversalPayment,
    );
    if (!eligibility.accountingEnabled) {
      this.logger.debug(
        `Accounting disabled for tenant ${user.tenantId}; REINSURER_DISBURSEMENT_REVERSED not enqueued for payment ${reversalPayment.id}`,
      );
      return null;
    }
    if (!eligibility.eligible) {
      throw new Error(
        `Payment ${reversalPayment.id} is not eligible for REINSURER_DISBURSEMENT_REVERSED: ${eligibility.exclusionReasons.join(', ')}`,
      );
    }

    const placement = this.requirePlacement(reversalPayment);
    const counterparty = this.requireReinsurerCounterparty(reversalPayment);
    const originalPayment = reversalPayment.reversalOfPayment;
    if (!originalPayment) {
      throw new Error(
        `Reversal payment ${reversalPayment.id} is missing its original payment reference`,
      );
    }

    const paymentAmount = Math.abs(this.decimalNumber(reversalPayment.amount));
    const allocatedAmount = this.roundMoney(
      (reversalPayment.allocations ?? []).reduce(
        (total, allocation) =>
          total + Math.abs(this.decimalNumber(allocation.allocatedAmount)),
        0,
      ),
    );
    const bankCharges = Math.abs(
      this.optionalDecimalNumber(reversalPayment.bankChargeAmount) ?? 0,
    );
    const sourceCharges = this.sourceChargeFacts(reversalPayment);
    const occurredAt = reversalPayment.paymentDate.toISOString();
    const exchangeRate = this.optionalDecimalNumber(
      reversalPayment.agreedExchangeRate,
    );
    const settlementMethod =
      reversalPayment.settlementMethod ??
      PlacementSettlementMethod.BANK_TRANSFER;
    const cashAffecting = this.isCashAffectingSettlement(settlementMethod);
    const signedCashImpact = cashAffecting ? paymentAmount : 0;

    return {
      tenantId: reversalPayment.tenantId,
      sourceEventType: 'REINSURER_DISBURSEMENT_REVERSED',
      sourceRecordType: 'PlacementPayment',
      sourceRecordId: reversalPayment.id,
      sourceDocumentId: reversalPayment.id,
      idempotencyKey: this.reinsurerDisbursementReversedIdempotencyKey(
        reversalPayment.id,
      ),
      occurredAt,
      currency: reversalPayment.currency,
      payload: {
        transactionDate: occurredAt,
        currency: reversalPayment.currency,
        ...(exchangeRate ? { exchangeRate } : {}),
        references: {
          placementId: placement.id,
          placementReference: placement.reference,
          policyNumber: placement.policyNumber,
          placementTitle: placement.title,
          originalPaymentId: originalPayment.id,
          reversalPaymentId: reversalPayment.id,
          paymentId: reversalPayment.id,
          settlementReference: reversalPayment.settlementReference ?? null,
          closingId:
            reversalPayment.closingId ?? reversalPayment.closing?.id ?? null,
          closingNumber: reversalPayment.closing?.closingNumber ?? null,
          endorsementClosingId:
            reversalPayment.endorsementClosingId ??
            reversalPayment.endorsementClosing?.id ??
            null,
          endorsementClosingNumber:
            reversalPayment.endorsementClosing?.closingNumber ?? null,
          endorsementId:
            reversalPayment.endorsementClosing?.endorsementId ?? null,
          endorsementReference:
            reversalPayment.endorsementClosing?.endorsement
              ?.endorsementNumber ?? null,
        },
        counterparty: {
          id: counterparty.id,
          type: counterparty.type,
          name: counterparty.name,
          registrationNumber: counterparty.registrationNumber ?? null,
          subledgerExternalRef: counterparty.id,
        },
        payment: {
          id: reversalPayment.id,
          originalPaymentId: originalPayment.id,
          reversalPaymentId: reversalPayment.id,
          status: reversalPayment.status,
          originalPaymentStatus: originalPayment.status,
          type: reversalPayment.type,
          direction: reversalPayment.direction,
          paymentDate: occurredAt,
          originalPaymentDate: originalPayment.paymentDate.toISOString(),
          paymentReference: reversalPayment.reference,
          originalPaymentReference: originalPayment.reference,
          settlementReference: reversalPayment.settlementReference ?? null,
          bankReference: reversalPayment.bankReference,
          settlementMethod,
          method: settlementMethod,
          currency: reversalPayment.currency,
          settlementCurrency:
            reversalPayment.settlementCurrency ?? reversalPayment.currency,
          agreedExchangeRate: exchangeRate,
          confirmedExchangeRate: exchangeRate,
          isReversal: true,
          reversalOfPaymentId: originalPayment.id,
          notes: reversalPayment.notes,
        },
        amounts: {
          paymentAmount,
          originalPaymentAmount: Math.abs(
            this.decimalNumber(originalPayment.amount),
          ),
          allocatedAmount,
          bankCharges,
          nicLevyAmount: sourceCharges.nicLevyAmount,
          contractualWithholdingTaxAmount:
            sourceCharges.contractualWithholdingTaxAmount,
          contractualWithholdingTaxRate:
            sourceCharges.contractualWithholdingTaxRate,
          withholdingTax: sourceCharges.contractualWithholdingTaxAmount,
          signedCashImpact,
          signedPayableImpact: allocatedAmount,
          cashAffectingSettlement: cashAffecting,
        },
        sourceCharges,
        allocations: (reversalPayment.allocations ?? []).map((allocation) => ({
          allocationId: allocation.id,
          creditNoteId: allocation.noteId,
          creditNoteNumber: allocation.note?.noteNumber ?? null,
          obligationType: allocation.note?.type ?? null,
          obligationCurrency: allocation.obligationCurrency,
          allocatedAmount: Math.abs(
            this.decimalNumber(allocation.obligationAmount),
          ),
          paymentCurrencyAmount: Math.abs(
            this.decimalNumber(allocation.allocatedAmount),
          ),
          agreedExchangeRate: this.optionalDecimalNumber(
            allocation.agreedExchangeRate,
          ),
          nicLevyAmount: this.optionalDecimalNumber(
            allocation.note?.nicLevyAmount,
          ),
          contractualWithholdingTaxAmount: this.optionalDecimalNumber(
            allocation.note?.withholdingTaxAmount,
          ),
          contractualWithholdingTaxRate: this.optionalDecimalNumber(
            allocation.note?.withholdingTaxPercent,
          ),
        })),
        allocation: {
          model: 'CREDIT_NOTE_ALLOCATIONS',
          allocationCount: reversalPayment.allocations?.length ?? 0,
          reversesRecognizedDisbursement: true,
        },
        documents: {
          sourceDocumentId: reversalPayment.id,
          paymentDocumentId: null,
        },
      },
    };
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
      payment.status === PlacementPaymentStatus.BANK_CONFIRMED &&
      payment.reversalOfPaymentId === null &&
      payment.paymentDate instanceof Date &&
      !Number.isNaN(payment.paymentDate.getTime()) &&
      payment.bankConfirmedAt instanceof Date &&
      !Number.isNaN(payment.bankConfirmedAt.getTime()) &&
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

  classifyReinsurerDisbursementReversed(
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
    if (payment.status !== PlacementPaymentStatus.RECORDED) {
      exclusionReasons.push('unsupported status');
    }
    if (
      typeof payment.reversalOfPaymentId !== 'string' ||
      payment.reversalOfPaymentId.trim().length === 0
    ) {
      exclusionReasons.push('not a reversal row');
    }
    if (!payment.reversalOfPayment) {
      exclusionReasons.push('missing original payment');
    }
    if (!payment.counterparty) {
      exclusionReasons.push('missing reinsurer');
    } else if (payment.counterparty.type !== CounterpartyType.REINSURER) {
      exclusionReasons.push('missing reinsurer');
    }
    if (
      !(payment.paymentDate instanceof Date) ||
      Number.isNaN(payment.paymentDate.getTime())
    ) {
      exclusionReasons.push('missing reversal date');
    }
    if (!payment.currency?.trim()) {
      exclusionReasons.push('missing payment currency');
    }
    if (this.decimalNumber(payment.amount) >= 0) {
      exclusionReasons.push('not a reversing amount');
    }

    const allocations = payment.allocations ?? [];
    const paymentCurrency = payment.currency?.trim().toUpperCase();
    const settlementCurrency =
      payment.settlementCurrency?.trim().toUpperCase() ?? paymentCurrency;
    let allocatedTotal = 0;
    for (const allocation of allocations) {
      allocatedTotal = this.roundMoney(
        allocatedTotal +
          Math.abs(this.decimalNumber(allocation.allocatedAmount)),
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
        paymentCurrency &&
        allocation.obligationCurrency.trim().toUpperCase() !==
          settlementCurrency &&
        !allocation.agreedExchangeRate &&
        !payment.agreedExchangeRate
      ) {
        exclusionReasons.push('missing agreed FX rate');
      }
    }
    if (allocations.length > 0) {
      const paymentAmount = Math.abs(this.decimalNumber(payment.amount));
      if (this.roundMoney(allocatedTotal) !== this.roundMoney(paymentAmount)) {
        exclusionReasons.push('incomplete allocation');
      }
    }
    if (allocations.length === 0 && settlementCurrency) {
      const obligationCurrency =
        payment.closing?.currency?.trim().toUpperCase() ??
        payment.endorsementClosing?.currency?.trim().toUpperCase() ??
        paymentCurrency;
      if (
        obligationCurrency &&
        obligationCurrency !== settlementCurrency &&
        !payment.agreedExchangeRate
      ) {
        exclusionReasons.push('missing agreed FX rate');
      }
    }

    const uniqueReasons = [...new Set(exclusionReasons)];
    return {
      accountingEnabled: Boolean(user.moduleConfig?.accounting),
      eligible: uniqueReasons.length === 0,
      exclusionReasons: uniqueReasons,
      idempotencyKey: this.reinsurerDisbursementReversedIdempotencyKey(
        payment.id,
      ),
    };
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

  private reinsurerDisbursementReversedIdempotencyKey(paymentId: string) {
    return `reinsurance:reinsurer-disbursement:${paymentId}:reversal:v1`;
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
