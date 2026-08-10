import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  PlacementPaymentDirection,
  PlacementPaymentStatus,
  PlacementPaymentType,
  PlacementClaimRecoveryReceiptStatus,
  PlacementClaimCedantSettlementStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReinsuranceAccountingEventInput } from './reinsurance-accounting-event.builder';
import { ReinsuranceFinancialEventPublisher } from './reinsurance-financial-event-publisher.service';
import {
  ReinsuranceAccountingClient,
  ReinsuranceAccountingClientError,
} from './reinsurance-accounting-client';
import {
  ProcessAccountingOutboxOptions,
  ReinsuranceAccountingOutboxService,
} from './reinsurance-accounting-outbox.service';

type CounterpartyRecord = Prisma.CounterpartyGetPayload<object>;

const paymentReconciliationInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
  placement: {
    select: {
      id: true,
      reference: true,
      policyNumber: true,
      title: true,
      cedantId: true,
    },
  },
  reversalOfPayment: {
    select: {
      id: true,
      amount: true,
      currency: true,
      paymentDate: true,
      reference: true,
      status: true,
    },
  },
  closing: {
    select: {
      id: true,
      closingNumber: true,
      netPremium: true,
      currency: true,
    },
  },
  endorsementClosing: {
    select: {
      id: true,
      closingNumber: true,
      netPremium: true,
      currency: true,
      endorsementId: true,
      endorsement: {
        select: {
          id: true,
          endorsementNumber: true,
          effectiveDate: true,
          type: true,
        },
      },
    },
  },
  allocations: {
    include: {
      note: {
        select: {
          id: true,
          noteNumber: true,
          type: true,
          direction: true,
          status: true,
          currency: true,
          netAmount: true,
          nicLevyPercent: true,
          nicLevyAmount: true,
          withholdingTaxPercent: true,
          withholdingTaxAmount: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.PlacementPaymentInclude;

const claimRecoveryReceiptReconciliationInclude = {
  counterparty: {
    select: {
      id: true,
      type: true,
      name: true,
      registrationNumber: true,
    },
  },
} satisfies Prisma.PlacementClaimRecoveryReceiptInclude;

const claimCedantSettlementReconciliationInclude = {
  reversalSettlements: {
    select: { id: true },
  },
} satisfies Prisma.PlacementClaimCedantSettlementInclude;

type AccountingSubledgerSyncResult =
  | {
      status: 'DISABLED' | 'SKIPPED';
      accountingEnabled: boolean;
      message: string;
    }
  | {
      status: 'SYNCED';
      accountingEnabled: true;
      subledgerId: string;
      subledgerCode?: string;
      subledgerType?: string;
      externalRef: string;
    }
  | {
      status: 'FAILED';
      accountingEnabled: true;
      retryable: boolean;
      statusCode?: number;
      message: string;
    };

@Injectable()
export class ReinsuranceAccountingReadinessService {
  private readonly logger = new Logger(
    ReinsuranceAccountingReadinessService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ReinsuranceAccountingClient,
    private readonly outbox: ReinsuranceAccountingOutboxService,
    private readonly financialEvents: ReinsuranceFinancialEventPublisher,
  ) {}

  status(user: RequestUser) {
    const configuration = this.client.configurationStatus();
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    return {
      accountingEnabled,
      integrationConfigured: configuration.configured,
      baseUrlConfigured: configuration.baseUrlConfigured,
      serviceAuthSecretConfigured: configuration.serviceAuthSecretConfigured,
      sourceEventsActive: accountingEnabled,
      activeSourceEvents: accountingEnabled
        ? [
            'DEBIT_NOTE_ISSUED',
            'CREDIT_NOTE_ISSUED',
            'ENDORSEMENT_DEBIT_NOTE_ISSUED',
            'ENDORSEMENT_CREDIT_NOTE_ISSUED',
            'PREMIUM_PAYMENT_RECEIVED',
            'PAYMENT_REVERSED',
            'REINSURER_DISBURSEMENT_RECORDED',
            'REINSURER_DISBURSEMENT_REVERSED',
            'CLAIM_PAYABLE_APPROVED',
            'CLAIM_CEDANT_SETTLEMENT_PAID',
            'CLAIM_CEDANT_SETTLEMENT_REVERSED',
            'CLAIM_RECOVERY_APPROVED',
            'CLAIM_RECOVERY_RECEIVED',
            'CLAIM_RECOVERY_RECEIPT_REVERSED',
          ]
        : [],
      readinessMode:
        'Debit-note, credit-note, premium-payment, reinsurer-disbursement, claim-payable and claim-recovery source-event capture, counterparty subledger readiness and outbox dispatch.',
      message: accountingEnabled
        ? configuration.configured
          ? 'Accounting integration is configured. Reinsurance financial-event capture is active for issued placement and endorsement debit/credit notes, premium payment lifecycle records, bank-confirmed reinsurer disbursements including reversals, broker-confirmed claim payable approvals, bank-confirmed cedant claim settlements including reversals, approved claim recoveries and bank-confirmed claim recovery receipts including reversals.'
          : 'Accounting is enabled. Reinsurance financial-event capture is active, but delivery is missing Accounting integration configuration.'
        : 'Accounting module is not enabled for this tenant; Reinsurance business workflows continue without Accounting outbox events.',
    };
  }

  async syncCounterpartyById(user: RequestUser, counterpartyId: string) {
    const counterparty = await this.prisma.counterparty.findFirst({
      where: {
        id: counterpartyId,
        tenantId: user.tenantId,
        archivedAt: null,
      },
    });
    if (!counterparty) throw new NotFoundException('Counterparty not found');
    return this.syncCounterparty(user, counterparty);
  }

  async syncCounterparty(
    user: RequestUser,
    counterparty: CounterpartyRecord,
  ): Promise<AccountingSubledgerSyncResult> {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    if (!accountingEnabled) {
      return {
        status: 'DISABLED',
        accountingEnabled,
        message:
          'Accounting module is not enabled for this tenant; subledger sync skipped.',
      };
    }

    const subledgerType = this.subledgerType(counterparty.type);
    if (!subledgerType) {
      return {
        status: 'SKIPPED',
        accountingEnabled,
        message:
          'Only Cedant and Reinsurer counterparties require Accounting subledger readiness.',
      };
    }

    try {
      const subledger = await this.client.ensureSubledger({
        tenantId: counterparty.tenantId,
        type: subledgerType,
        externalRef: counterparty.id,
        name: counterparty.name,
        metadata: {
          sourceModule: 'REINSURANCE',
          sourceRecordType: 'Counterparty',
          sourceRecordId: counterparty.id,
          counterpartyType: counterparty.type,
        },
      });
      return {
        status: 'SYNCED',
        accountingEnabled,
        subledgerId: subledger.id,
        subledgerCode: subledger.code,
        subledgerType: subledger.type,
        externalRef: counterparty.id,
      };
    } catch (error) {
      const failure = this.failure(error);
      return {
        status: 'FAILED',
        accountingEnabled,
        ...failure,
      };
    }
  }

  async syncCounterpartyBestEffort(
    user: RequestUser,
    counterparty: CounterpartyRecord,
  ) {
    const result = await this.syncCounterparty(user, counterparty);
    if (result.status === 'FAILED') {
      this.logger.warn(
        `Accounting subledger readiness failed for counterparty ${counterparty.id}: ${result.message}`,
      );
    }
    return result;
  }

  processPending(user: RequestUser, options: ProcessAccountingOutboxOptions) {
    return this.outbox.processPending(this.prisma, {
      tenantId: user.tenantId,
      limit: options.limit,
    });
  }

  async findPendingClaimRecoveryReceiptConfirmations(user: RequestUser) {
    const receipts = await this.prisma.placementClaimRecoveryReceipt.findMany({
      where: {
        tenantId: user.tenantId,
        status: PlacementClaimRecoveryReceiptStatus.RECORDED,
        reversalOfReceiptId: null,
        placement: { archivedAt: null },
      },
      select: {
        id: true,
        placementId: true,
        claimId: true,
        allocationId: true,
        cashCallId: true,
        recoveryApprovalId: true,
        counterpartyId: true,
        currency: true,
        amount: true,
        paymentDate: true,
        reference: true,
        settlementMethod: true,
        settlementCurrency: true,
        agreedExchangeRate: true,
        status: true,
        createdAt: true,
        placement: {
          select: {
            id: true,
            reference: true,
            policyNumber: true,
            title: true,
          },
        },
        claim: {
          select: {
            id: true,
            claimNumber: true,
          },
        },
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
          },
        },
      },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      items: receipts.map((receipt) => ({
        id: `REINSURANCE_CLAIM_RECOVERY_RECEIPT:${receipt.id}`,
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'PlacementClaimRecoveryReceipt',
        sourceRecordId: receipt.id,
        sourceParentId: receipt.placementId,
        sourceReference: receipt.reference ?? receipt.id,
        action: 'CONFIRM_BANK_RECEIPT',
        direction: 'INBOUND',
        status: receipt.status,
        amount: receipt.amount.toString(),
        currency: receipt.currency,
        operationalDate: receipt.paymentDate.toISOString(),
        settlementMethod: receipt.settlementMethod,
        settlementCurrency: receipt.settlementCurrency ?? receipt.currency,
        agreedExchangeRate: receipt.agreedExchangeRate?.toString() ?? null,
        counterparty: receipt.counterparty,
        sourceDetailUrl: `/operations/reinsurance/facultative/${receipt.placementId}`,
        businessSnapshot: {
          placementId: receipt.placement.id,
          placementReference: receipt.placement.reference,
          policyNumber: receipt.placement.policyNumber,
          placementTitle: receipt.placement.title,
          claimId: receipt.claim.id,
          claimNumber: receipt.claim.claimNumber,
          allocationId: receipt.allocationId,
          cashCallId: receipt.cashCallId,
          recoveryApprovalId: receipt.recoveryApprovalId,
        },
      })),
    };
  }

  async findPendingClaimCedantSettlementConfirmations(user: RequestUser) {
    const settlements =
      await this.prisma.placementClaimCedantSettlement.findMany({
        where: {
          tenantId: user.tenantId,
          status: PlacementClaimCedantSettlementStatus.RECORDED,
          reversalOfSettlementId: null,
          placement: { archivedAt: null },
        },
        select: {
          id: true,
          placementId: true,
          claimId: true,
          payableApprovalId: true,
          currency: true,
          amount: true,
          settlementDate: true,
          reference: true,
          settlementMethod: true,
          settlementCurrency: true,
          agreedExchangeRate: true,
          status: true,
          createdAt: true,
          placement: {
            select: {
              id: true,
              reference: true,
              policyNumber: true,
              title: true,
              cedant: {
                select: {
                  id: true,
                  type: true,
                  name: true,
                  registrationNumber: true,
                },
              },
            },
          },
          claim: {
            select: {
              id: true,
              claimNumber: true,
            },
          },
        },
        orderBy: [{ settlementDate: 'desc' }, { createdAt: 'desc' }],
      });

    return {
      items: settlements.map((settlement) => ({
        id: `REINSURANCE_CLAIM_CEDANT_SETTLEMENT:${settlement.id}`,
        sourceModule: 'REINSURANCE',
        sourceRecordType: 'PlacementClaimCedantSettlement',
        sourceRecordId: settlement.id,
        sourceParentId: settlement.placementId,
        sourceReference: settlement.reference ?? settlement.id,
        action: 'CONFIRM_BANK_PAYMENT',
        transactionType: 'CLAIM_CEDANT_SETTLEMENT',
        direction: 'OUTBOUND',
        status: settlement.status,
        amount: settlement.amount.toString(),
        currency: settlement.currency,
        operationalDate: settlement.settlementDate.toISOString(),
        settlementMethod: settlement.settlementMethod,
        settlementCurrency:
          settlement.settlementCurrency ?? settlement.currency,
        agreedExchangeRate: settlement.agreedExchangeRate?.toString() ?? null,
        counterparty: settlement.placement.cedant,
        sourceDetailUrl: `/operations/reinsurance/facultative/${settlement.placementId}`,
        businessSnapshot: {
          placementId: settlement.placement.id,
          placementReference: settlement.placement.reference,
          policyNumber: settlement.placement.policyNumber,
          placementTitle: settlement.placement.title,
          claimId: settlement.claim.id,
          claimNumber: settlement.claim.claimNumber,
          payableApprovalId: settlement.payableApprovalId,
        },
      })),
    };
  }

  async reconcileDebitNoteIssuedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message:
          'Accounting module is not enabled for this tenant; no debit-note events are captured in Phase 1.',
      };
    }

    const notes = await this.prisma.placementNote.findMany({
      where: {
        tenantId: user.tenantId,
        type: PlacementNoteType.DEBIT_NOTE,
        direction: PlacementNoteDirection.CEDANT_TO_BROKER,
        status: PlacementNoteStatus.ISSUED,
        issuedAt: { not: null },
        placement: { archivedAt: null },
      },
      include: {
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
          },
        },
      },
      orderBy: { issuedAt: 'asc' },
      take: limit,
    });
    const keys = notes.map((note) => this.debitNoteIdempotencyKey(note.id));
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      noteId: string;
      noteNumber: string;
      placementId: string;
      issuedAt: string;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const note of notes) {
      const idempotencyKey = this.debitNoteIdempotencyKey(note.id);
      const existingEvent = existingByKey.get(idempotencyKey);
      if (existingEvent) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'PRESENT',
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }

      if (dryRun) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'MISSING',
        });
        continue;
      }

      const issuedAt = note.issuedAt;
      if (!issuedAt) continue;
      const event = await this.financialEvents.prepareDebitNoteIssued(
        user,
        note,
        issuedAt,
      );
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        noteId: note.id,
        noteNumber: note.noteNumber,
        placementId: note.placementId,
        issuedAt: issuedAt.toISOString(),
        idempotencyKey,
        status: 'ENQUEUED',
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: notes.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  async reconcileCreditNoteIssuedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message:
          'Accounting module is not enabled for this tenant; no credit-note events are captured in Phase 1.',
      };
    }

    const notes = await this.prisma.placementNote.findMany({
      where: {
        tenantId: user.tenantId,
        type: PlacementNoteType.CREDIT_NOTE,
        direction: PlacementNoteDirection.BROKER_TO_REINSURER,
        status: PlacementNoteStatus.ISSUED,
        issuedAt: { not: null },
        placement: { archivedAt: null },
      },
      include: {
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
          },
        },
        closing: {
          select: {
            id: true,
            closingNumber: true,
          },
        },
      },
      orderBy: { issuedAt: 'asc' },
      take: limit,
    });
    const keys = notes.map((note) => this.creditNoteIdempotencyKey(note.id));
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      noteId: string;
      noteNumber: string;
      placementId: string;
      issuedAt: string;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const note of notes) {
      const idempotencyKey = this.creditNoteIdempotencyKey(note.id);
      const existingEvent = existingByKey.get(idempotencyKey);
      if (existingEvent) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'PRESENT',
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }

      if (dryRun) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'MISSING',
        });
        continue;
      }

      const issuedAt = note.issuedAt;
      if (!issuedAt) continue;
      const event = await this.financialEvents.prepareCreditNoteIssued(
        user,
        note,
        issuedAt,
      );
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        noteId: note.id,
        noteNumber: note.noteNumber,
        placementId: note.placementId,
        issuedAt: issuedAt.toISOString(),
        idempotencyKey,
        status: 'ENQUEUED',
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: notes.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  async reconcileEndorsementDebitNoteIssuedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message:
          'Accounting module is not enabled for this tenant; no endorsement debit-note events are captured.',
      };
    }

    const notes = await this.prisma.placementNote.findMany({
      where: {
        tenantId: user.tenantId,
        type: PlacementNoteType.ENDORSEMENT_DEBIT_NOTE,
        direction: PlacementNoteDirection.CEDANT_TO_BROKER,
        status: PlacementNoteStatus.ISSUED,
        issuedAt: { not: null },
        endorsementId: { not: null },
        placement: { archivedAt: null },
      },
      include: {
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
          },
        },
        endorsement: {
          select: {
            id: true,
            endorsementNumber: true,
            type: true,
            impactType: true,
            effectiveDate: true,
            status: true,
          },
        },
      },
      orderBy: { issuedAt: 'asc' },
      take: limit,
    });
    const keys = notes.map((note) =>
      this.endorsementDebitNoteIdempotencyKey(note.id),
    );
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      noteId: string;
      noteNumber: string;
      placementId: string;
      endorsementId?: string | null;
      issuedAt: string;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const note of notes) {
      const idempotencyKey = this.endorsementDebitNoteIdempotencyKey(note.id);
      const existingEvent = existingByKey.get(idempotencyKey);
      if (existingEvent) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          endorsementId: note.endorsementId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'PRESENT',
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }

      if (dryRun) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          endorsementId: note.endorsementId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'MISSING',
        });
        continue;
      }

      const issuedAt = note.issuedAt;
      if (!issuedAt) continue;
      const event =
        await this.financialEvents.prepareEndorsementDebitNoteIssued(
          user,
          note,
          issuedAt,
        );
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        noteId: note.id,
        noteNumber: note.noteNumber,
        placementId: note.placementId,
        endorsementId: note.endorsementId,
        issuedAt: issuedAt.toISOString(),
        idempotencyKey,
        status: 'ENQUEUED',
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: notes.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  async reconcileEndorsementCreditNoteIssuedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message:
          'Accounting module is not enabled for this tenant; no endorsement credit-note events are captured.',
      };
    }

    const notes = await this.prisma.placementNote.findMany({
      where: {
        tenantId: user.tenantId,
        type: PlacementNoteType.ENDORSEMENT_CREDIT_NOTE,
        direction: PlacementNoteDirection.BROKER_TO_REINSURER,
        status: PlacementNoteStatus.ISSUED,
        issuedAt: { not: null },
        endorsementId: { not: null },
        endorsementClosingId: { not: null },
        placement: { archivedAt: null },
      },
      include: {
        counterparty: {
          select: {
            id: true,
            type: true,
            name: true,
            registrationNumber: true,
          },
        },
        endorsement: {
          select: {
            id: true,
            endorsementNumber: true,
            type: true,
            impactType: true,
            effectiveDate: true,
            status: true,
          },
        },
        endorsementClosing: {
          select: {
            id: true,
            closingNumber: true,
            endorsementParticipantId: true,
          },
        },
      },
      orderBy: { issuedAt: 'asc' },
      take: limit,
    });
    const keys = notes.map((note) =>
      this.endorsementCreditNoteIdempotencyKey(note.id),
    );
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      noteId: string;
      noteNumber: string;
      placementId: string;
      endorsementId?: string | null;
      endorsementClosingId?: string | null;
      issuedAt: string;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const note of notes) {
      const idempotencyKey = this.endorsementCreditNoteIdempotencyKey(note.id);
      const existingEvent = existingByKey.get(idempotencyKey);
      if (existingEvent) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          endorsementId: note.endorsementId,
          endorsementClosingId: note.endorsementClosingId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'PRESENT',
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }

      if (dryRun) {
        items.push({
          noteId: note.id,
          noteNumber: note.noteNumber,
          placementId: note.placementId,
          endorsementId: note.endorsementId,
          endorsementClosingId: note.endorsementClosingId,
          issuedAt: note.issuedAt?.toISOString() ?? '',
          idempotencyKey,
          status: 'MISSING',
        });
        continue;
      }

      const issuedAt = note.issuedAt;
      if (!issuedAt) continue;
      const event =
        await this.financialEvents.prepareEndorsementCreditNoteIssued(
          user,
          note,
          issuedAt,
        );
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        noteId: note.id,
        noteNumber: note.noteNumber,
        placementId: note.placementId,
        endorsementId: note.endorsementId,
        endorsementClosingId: note.endorsementClosingId,
        issuedAt: issuedAt.toISOString(),
        idempotencyKey,
        status: 'ENQUEUED',
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: notes.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  async reconcilePremiumPaymentReceivedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.reconcilePaymentEvents(user, options, {
      disabledMessage:
        'Accounting module is not enabled for this tenant; no premium payment events are captured in Phase 1.',
      eventType: 'PREMIUM_PAYMENT_RECEIVED',
      idempotencyKey: (paymentId) =>
        this.premiumPaymentReceivedIdempotencyKey(paymentId),
      missingStatus: 'MISSING',
      presentStatus: 'PRESENT',
      enqueuedStatus: 'ENQUEUED',
      where: {
        tenantId: user.tenantId,
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        status: PlacementPaymentStatus.BANK_CONFIRMED,
        reversalOfPaymentId: null,
        placement: { archivedAt: null },
      },
      prepare: (payment) =>
        this.financialEvents.preparePremiumPaymentReceived(user, payment),
    });
  }

  async reconcilePaymentReversedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.reconcilePaymentEvents(user, options, {
      disabledMessage:
        'Accounting module is not enabled for this tenant; no payment reversal events are captured in Phase 1.',
      eventType: 'PAYMENT_REVERSED',
      idempotencyKey: (paymentId) =>
        this.paymentReversedIdempotencyKey(paymentId),
      missingStatus: 'MISSING',
      presentStatus: 'PRESENT',
      enqueuedStatus: 'ENQUEUED',
      where: {
        tenantId: user.tenantId,
        type: PlacementPaymentType.PREMIUM_RECEIVED,
        direction: PlacementPaymentDirection.INBOUND,
        status: PlacementPaymentStatus.RECORDED,
        reversalOfPaymentId: { not: null },
        placement: { archivedAt: null },
      },
      prepare: (payment) =>
        this.financialEvents.preparePaymentReversed(user, payment),
    });
  }

  async reconcileReinsurerDisbursementRecordedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.reconcilePaymentEvents(user, options, {
      disabledMessage:
        'Accounting module is not enabled for this tenant; no reinsurer disbursement events are captured.',
      eventType: 'REINSURER_DISBURSEMENT_RECORDED',
      idempotencyKey: (paymentId) =>
        this.reinsurerDisbursementRecordedIdempotencyKey(paymentId),
      missingStatus: 'MISSING',
      presentStatus: 'PRESENT',
      enqueuedStatus: 'ENQUEUED',
      where: {
        tenantId: user.tenantId,
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        status: PlacementPaymentStatus.BANK_CONFIRMED,
        reversalOfPaymentId: null,
        bankConfirmedAt: { not: null },
        placement: { archivedAt: null },
      },
      prepare: (payment) =>
        this.financialEvents.prepareReinsurerDisbursementRecorded(
          user,
          payment,
        ),
    });
  }

  async reconcileReinsurerDisbursementReversedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.reconcilePaymentEvents(user, options, {
      disabledMessage:
        'Accounting module is not enabled for this tenant; no reinsurer disbursement reversal events are captured.',
      eventType: 'REINSURER_DISBURSEMENT_REVERSED',
      idempotencyKey: (paymentId) =>
        this.reinsurerDisbursementReversedIdempotencyKey(paymentId),
      missingStatus: 'MISSING',
      presentStatus: 'PRESENT',
      enqueuedStatus: 'ENQUEUED',
      where: {
        tenantId: user.tenantId,
        type: PlacementPaymentType.REINSURER_DISBURSEMENT,
        direction: PlacementPaymentDirection.OUTBOUND,
        status: PlacementPaymentStatus.RECORDED,
        reversalOfPaymentId: { not: null },
        placement: { archivedAt: null },
      },
      prepare: (payment) =>
        this.financialEvents.prepareReinsurerDisbursementReversed(
          user,
          payment,
        ),
    });
  }

  async reconcileClaimPayableApprovedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message:
          'Accounting module is not enabled for this tenant; no claim payable approval events are captured.',
      };
    }

    const approvals = await this.prisma.placementClaimPayableApproval.findMany({
      where: {
        tenantId: user.tenantId,
        claim: { placement: { archivedAt: null } },
      },
      orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    const keys = approvals.map((approval) =>
      this.claimPayableApprovedIdempotencyKey(
        approval.claimId,
        approval.approvalVersion,
      ),
    );
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      approvalId: string;
      claimId: string;
      placementId: string;
      approvedAt: string;
      approvalVersion: number;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const approval of approvals) {
      const idempotencyKey = this.claimPayableApprovedIdempotencyKey(
        approval.claimId,
        approval.approvalVersion,
      );
      const existingEvent = existingByKey.get(idempotencyKey);
      if (existingEvent) {
        items.push({
          approvalId: approval.id,
          claimId: approval.claimId,
          placementId: approval.placementId,
          approvedAt: approval.approvedAt.toISOString(),
          approvalVersion: approval.approvalVersion,
          idempotencyKey,
          status: 'PRESENT',
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }

      if (dryRun) {
        items.push({
          approvalId: approval.id,
          claimId: approval.claimId,
          placementId: approval.placementId,
          approvedAt: approval.approvedAt.toISOString(),
          approvalVersion: approval.approvalVersion,
          idempotencyKey,
          status: 'MISSING',
        });
        continue;
      }

      const event = await this.financialEvents.prepareClaimPayableApproved(
        user,
        approval,
      );
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        approvalId: approval.id,
        claimId: approval.claimId,
        placementId: approval.placementId,
        approvedAt: approval.approvedAt.toISOString(),
        approvalVersion: approval.approvalVersion,
        idempotencyKey,
        status: 'ENQUEUED',
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: approvals.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  async reconcileClaimRecoveryApprovedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message:
          'Accounting module is not enabled for this tenant; no claim recovery approval events are captured.',
      };
    }

    const approvals = await this.prisma.placementClaimRecoveryApproval.findMany(
      {
        where: {
          tenantId: user.tenantId,
          claim: { placement: { archivedAt: null } },
        },
        include: {
          counterparty: {
            select: {
              id: true,
              type: true,
              name: true,
              registrationNumber: true,
            },
          },
        },
        orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      },
    );
    const keys = approvals.map((approval) =>
      this.claimRecoveryApprovedIdempotencyKey(approval.id),
    );
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      approvalId: string;
      claimId: string;
      placementId: string;
      allocationId: string;
      approvedAt: string;
      approvalVersion: number;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const approval of approvals) {
      const idempotencyKey = this.claimRecoveryApprovedIdempotencyKey(
        approval.id,
      );
      const existingEvent = existingByKey.get(idempotencyKey);
      if (existingEvent) {
        items.push({
          approvalId: approval.id,
          claimId: approval.claimId,
          placementId: approval.placementId,
          allocationId: approval.allocationId,
          approvedAt: approval.approvedAt.toISOString(),
          approvalVersion: approval.approvalVersion,
          idempotencyKey,
          status: 'PRESENT',
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }

      if (dryRun) {
        items.push({
          approvalId: approval.id,
          claimId: approval.claimId,
          placementId: approval.placementId,
          allocationId: approval.allocationId,
          approvedAt: approval.approvedAt.toISOString(),
          approvalVersion: approval.approvalVersion,
          idempotencyKey,
          status: 'MISSING',
        });
        continue;
      }

      const event = await this.financialEvents.prepareClaimRecoveryApproved(
        user,
        approval,
      );
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        approvalId: approval.id,
        claimId: approval.claimId,
        placementId: approval.placementId,
        allocationId: approval.allocationId,
        approvedAt: approval.approvedAt.toISOString(),
        approvalVersion: approval.approvalVersion,
        idempotencyKey,
        status: 'ENQUEUED',
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: approvals.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  reconcileClaimCedantSettlementPaidEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.reconcileClaimCedantSettlementEvents(user, options, {
      disabledMessage:
        'Accounting module is not enabled for this tenant; no claim cedant settlement events are captured.',
      where: {
        status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
        reversalOfSettlementId: null,
        bankConfirmedAt: { not: null },
      },
      idempotencyKey: (settlementId) =>
        this.claimCedantSettlementPaidIdempotencyKey(settlementId),
      prepare: (settlement) =>
        this.financialEvents.prepareClaimCedantSettlementPaid(user, settlement),
    });
  }

  reconcileClaimCedantSettlementReversedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.reconcileClaimCedantSettlementEvents(user, options, {
      disabledMessage:
        'Accounting module is not enabled for this tenant; no claim cedant settlement reversal events are captured.',
      where: {
        status: PlacementClaimCedantSettlementStatus.BANK_CONFIRMED,
        reversalOfSettlementId: { not: null },
        bankConfirmedAt: { not: null },
      },
      idempotencyKey: (settlementId) =>
        this.claimCedantSettlementReversedIdempotencyKey(settlementId),
      prepare: (settlement) =>
        this.financialEvents.prepareClaimCedantSettlementReversed(
          user,
          settlement,
        ),
    });
  }

  private async reconcileClaimCedantSettlementEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
    config: {
      disabledMessage: string;
      where: Prisma.PlacementClaimCedantSettlementWhereInput;
      idempotencyKey: (settlementId: string) => string;
      prepare: (
        settlement: Prisma.PlacementClaimCedantSettlementGetPayload<{
          include: typeof claimCedantSettlementReconciliationInclude;
        }>,
      ) => Promise<ReinsuranceAccountingEventInput | null>;
    },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message: config.disabledMessage,
      };
    }

    const settlements =
      await this.prisma.placementClaimCedantSettlement.findMany({
        where: {
          tenantId: user.tenantId,
          placement: { archivedAt: null },
          ...config.where,
        },
        include: claimCedantSettlementReconciliationInclude,
        orderBy: [{ bankConfirmedAt: 'asc' }, { id: 'asc' }],
        take: limit,
      });
    const keys = settlements.map((settlement) =>
      config.idempotencyKey(settlement.id),
    );
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      settlementId: string;
      claimId: string;
      placementId: string;
      bankConfirmedAt: string | null;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const settlement of settlements) {
      const idempotencyKey = config.idempotencyKey(settlement.id);
      const existingEvent = existingByKey.get(idempotencyKey);
      const baseItem = {
        settlementId: settlement.id,
        claimId: settlement.claimId,
        placementId: settlement.placementId,
        bankConfirmedAt: settlement.bankConfirmedAt?.toISOString() ?? null,
        idempotencyKey,
      };
      if (existingEvent) {
        items.push({
          ...baseItem,
          status: 'PRESENT',
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }
      if (dryRun) {
        items.push({ ...baseItem, status: 'MISSING' });
        continue;
      }

      const event = await config.prepare(settlement);
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        ...baseItem,
        status: 'ENQUEUED',
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: settlements.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  reconcileClaimRecoveryReceivedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.reconcileClaimRecoveryReceiptEvents(user, options, {
      disabledMessage:
        'Accounting module is not enabled for this tenant; no claim recovery receipt events are captured.',
      where: {
        status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
        reversalOfReceiptId: null,
        bankConfirmedAt: { not: null },
      },
      idempotencyKey: (receiptId) =>
        this.claimRecoveryReceivedIdempotencyKey(receiptId),
      prepare: (receipt) =>
        this.financialEvents.prepareClaimRecoveryReceived(user, receipt),
    });
  }

  reconcileClaimRecoveryReceiptReversedEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
  ) {
    return this.reconcileClaimRecoveryReceiptEvents(user, options, {
      disabledMessage:
        'Accounting module is not enabled for this tenant; no claim recovery receipt reversal events are captured.',
      where: {
        status: PlacementClaimRecoveryReceiptStatus.BANK_CONFIRMED,
        reversalOfReceiptId: { not: null },
        bankConfirmedAt: { not: null },
      },
      idempotencyKey: (receiptId) =>
        this.claimRecoveryReceiptReversedIdempotencyKey(receiptId),
      prepare: (receipt) =>
        this.financialEvents.prepareClaimRecoveryReceiptReversed(user, receipt),
    });
  }

  private async reconcileClaimRecoveryReceiptEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
    config: {
      disabledMessage: string;
      where: Prisma.PlacementClaimRecoveryReceiptWhereInput;
      idempotencyKey: (receiptId: string) => string;
      prepare: (
        receipt: Prisma.PlacementClaimRecoveryReceiptGetPayload<{
          include: typeof claimRecoveryReceiptReconciliationInclude;
        }>,
      ) => Promise<ReinsuranceAccountingEventInput | null>;
    },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message: config.disabledMessage,
      };
    }

    const receipts = await this.prisma.placementClaimRecoveryReceipt.findMany({
      where: {
        tenantId: user.tenantId,
        placement: { archivedAt: null },
        ...config.where,
      },
      include: claimRecoveryReceiptReconciliationInclude,
      orderBy: [{ bankConfirmedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    const keys = receipts.map((receipt) => config.idempotencyKey(receipt.id));
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      receiptId: string;
      claimId: string;
      placementId: string;
      allocationId: string;
      bankConfirmedAt: string | null;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const receipt of receipts) {
      const idempotencyKey = config.idempotencyKey(receipt.id);
      const existingEvent = existingByKey.get(idempotencyKey);
      const baseItem = {
        receiptId: receipt.id,
        claimId: receipt.claimId,
        placementId: receipt.placementId,
        allocationId: receipt.allocationId,
        bankConfirmedAt: receipt.bankConfirmedAt?.toISOString() ?? null,
        idempotencyKey,
      };
      if (existingEvent) {
        items.push({
          ...baseItem,
          status: 'PRESENT',
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }
      if (dryRun) {
        items.push({ ...baseItem, status: 'MISSING' });
        continue;
      }

      const event = await config.prepare(receipt);
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        ...baseItem,
        status: 'ENQUEUED',
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: receipts.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  private debitNoteIdempotencyKey(noteId: string) {
    return `reinsurance:debit-note:${noteId}:issued:v1`;
  }

  private creditNoteIdempotencyKey(noteId: string) {
    return `reinsurance:credit-note:${noteId}:issued:v1`;
  }

  private endorsementDebitNoteIdempotencyKey(noteId: string) {
    return `reinsurance:endorsement-debit-note:${noteId}:issued:v1`;
  }

  private endorsementCreditNoteIdempotencyKey(noteId: string) {
    return `reinsurance:endorsement-credit-note:${noteId}:issued:v1`;
  }

  private premiumPaymentReceivedIdempotencyKey(paymentId: string) {
    return `reinsurance:payment:${paymentId}:recorded:v1`;
  }

  private paymentReversedIdempotencyKey(paymentId: string) {
    return `reinsurance:payment:${paymentId}:reversal:v1`;
  }

  private reinsurerDisbursementRecordedIdempotencyKey(paymentId: string) {
    return `reinsurance:reinsurer-disbursement:${paymentId}:recorded:v1`;
  }

  private reinsurerDisbursementReversedIdempotencyKey(paymentId: string) {
    return `reinsurance:reinsurer-disbursement:${paymentId}:reversal:v1`;
  }

  private claimPayableApprovedIdempotencyKey(
    claimId: string,
    approvalVersion: number,
  ) {
    return `reinsurance:claim:${claimId}:payable-approved:${approvalVersion}:v1`;
  }

  private claimCedantSettlementPaidIdempotencyKey(settlementId: string) {
    return `reinsurance:claim-cedant-settlement:${settlementId}:confirmed:v1`;
  }

  private claimCedantSettlementReversedIdempotencyKey(settlementId: string) {
    return `reinsurance:claim-cedant-settlement:${settlementId}:reversal:v1`;
  }

  private claimRecoveryApprovedIdempotencyKey(approvalId: string) {
    return `reinsurance:claim-recovery:${approvalId}:approved:v1`;
  }

  private claimRecoveryReceivedIdempotencyKey(receiptId: string) {
    return `reinsurance:claim-recovery-receipt:${receiptId}:confirmed:v1`;
  }

  private claimRecoveryReceiptReversedIdempotencyKey(receiptId: string) {
    return `reinsurance:claim-recovery-receipt:${receiptId}:reversal:v1`;
  }

  private async reconcilePaymentEvents(
    user: RequestUser,
    options: { dryRun?: boolean; limit?: number },
    config: {
      disabledMessage: string;
      eventType:
        | 'PREMIUM_PAYMENT_RECEIVED'
        | 'PAYMENT_REVERSED'
        | 'REINSURER_DISBURSEMENT_RECORDED'
        | 'REINSURER_DISBURSEMENT_REVERSED';
      idempotencyKey: (paymentId: string) => string;
      missingStatus: 'MISSING';
      presentStatus: 'PRESENT';
      enqueuedStatus: 'ENQUEUED';
      where: Prisma.PlacementPaymentWhereInput;
      prepare: (
        payment: Prisma.PlacementPaymentGetPayload<{
          include: typeof paymentReconciliationInclude;
        }>,
      ) =>
        | ReinsuranceAccountingEventInput
        | null
        | Promise<ReinsuranceAccountingEventInput | null>;
    },
  ) {
    const accountingEnabled = Boolean(user.moduleConfig?.accounting);
    const dryRun = options.dryRun ?? true;
    const limit = Math.min(options.limit ?? 50, 100);
    if (!accountingEnabled) {
      return {
        accountingEnabled,
        dryRun,
        inspectedCount: 0,
        missingCount: 0,
        enqueuedCount: 0,
        items: [],
        message: config.disabledMessage,
      };
    }

    const payments = await this.prisma.placementPayment.findMany({
      where: config.where,
      include: paymentReconciliationInclude,
      orderBy: { paymentDate: 'asc' },
      take: limit,
    });
    const keys = payments.map((payment) => config.idempotencyKey(payment.id));
    const existing = keys.length
      ? await this.prisma.reinsuranceAccountingOutbox.findMany({
          where: {
            tenantId: user.tenantId,
            idempotencyKey: { in: keys },
          },
          select: {
            id: true,
            idempotencyKey: true,
            status: true,
            accountingSourceEventId: true,
          },
        })
      : [];
    const existingByKey = new Map(
      existing.map((event) => [event.idempotencyKey, event]),
    );

    const items: Array<{
      paymentId: string;
      originalPaymentId?: string | null;
      placementId: string;
      paymentDate: string;
      eventType: string;
      idempotencyKey: string;
      status: 'PRESENT' | 'MISSING' | 'ENQUEUED';
      outboxId?: string;
      outboxStatus?: string;
      accountingSourceEventId?: string | null;
    }> = [];
    let enqueuedCount = 0;

    for (const payment of payments) {
      const idempotencyKey = config.idempotencyKey(payment.id);
      const existingEvent = existingByKey.get(idempotencyKey);
      if (existingEvent) {
        items.push({
          paymentId: payment.id,
          originalPaymentId: payment.reversalOfPaymentId,
          placementId: payment.placementId,
          paymentDate: payment.paymentDate.toISOString(),
          eventType: config.eventType,
          idempotencyKey,
          status: config.presentStatus,
          outboxId: existingEvent.id,
          outboxStatus: existingEvent.status,
          accountingSourceEventId: existingEvent.accountingSourceEventId,
        });
        continue;
      }

      if (dryRun) {
        items.push({
          paymentId: payment.id,
          originalPaymentId: payment.reversalOfPaymentId,
          placementId: payment.placementId,
          paymentDate: payment.paymentDate.toISOString(),
          eventType: config.eventType,
          idempotencyKey,
          status: config.missingStatus,
        });
        continue;
      }

      const event = await config.prepare(payment);
      if (!event) continue;
      const outboxRow = await this.prisma.$transaction((tx) =>
        this.financialEvents.enqueuePreparedEvent(tx, event),
      );
      enqueuedCount += 1;
      items.push({
        paymentId: payment.id,
        originalPaymentId: payment.reversalOfPaymentId,
        placementId: payment.placementId,
        paymentDate: payment.paymentDate.toISOString(),
        eventType: config.eventType,
        idempotencyKey,
        status: config.enqueuedStatus,
        outboxId: outboxRow.id,
        outboxStatus: outboxRow.status,
        accountingSourceEventId: outboxRow.accountingSourceEventId,
      });
    }

    return {
      accountingEnabled,
      dryRun,
      inspectedCount: payments.length,
      missingCount: items.filter((item) => item.status === 'MISSING').length,
      enqueuedCount,
      items,
    };
  }

  private subledgerType(
    counterpartyType: CounterpartyType,
  ): 'CEDANT' | 'REINSURER' | null {
    if (counterpartyType === CounterpartyType.CEDANT) return 'CEDANT';
    if (counterpartyType === CounterpartyType.REINSURER) return 'REINSURER';
    return null;
  }

  private failure(error: unknown): {
    message: string;
    retryable: boolean;
    statusCode?: number;
  } {
    if (error instanceof ReinsuranceAccountingClientError) {
      return {
        message: error.message,
        retryable: error.retryable,
        statusCode: error.statusCode,
      };
    }
    return {
      message:
        error instanceof Error
          ? error.message
          : 'Unexpected Accounting readiness failure',
      retryable: true,
    };
  }
}
