import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  CounterpartyType,
  PlacementNoteDirection,
  PlacementNoteStatus,
  PlacementNoteType,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
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
      activeSourceEvents: accountingEnabled ? ['DEBIT_NOTE_ISSUED'] : [],
      readinessMode:
        'Debit-note source-event capture, counterparty subledger readiness and outbox dispatch.',
      message: accountingEnabled
        ? configuration.configured
          ? 'Accounting integration is configured. DEBIT_NOTE_ISSUED capture is active for issued placement debit notes.'
          : 'Accounting is enabled. DEBIT_NOTE_ISSUED capture is active, but delivery is missing Accounting integration configuration.'
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

  private debitNoteIdempotencyKey(noteId: string) {
    return `reinsurance:debit-note:${noteId}:issued:v1`;
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
