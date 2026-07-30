import { Injectable, Logger } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReinsuranceAccountingEventInput } from './reinsurance-accounting-event.builder';
import { ReinsuranceAccountingOutboxService } from './reinsurance-accounting-outbox.service';

type DebitNoteForEvent = {
  id: string;
  tenantId: string;
  placementId: string;
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
    note: DebitNoteForEvent,
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

  enqueuePreparedEvent(
    tx: Prisma.TransactionClient,
    event: ReinsuranceAccountingEventInput,
  ) {
    return this.outbox.enqueueAccountingEvent(tx, event);
  }

  private isIssuedPlacementDebitNote(
    note: DebitNoteForEvent,
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
}
