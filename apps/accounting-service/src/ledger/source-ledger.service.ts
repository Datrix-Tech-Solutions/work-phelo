import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { JournalStatus } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { CashbookService } from './cashbook.service';
import {
  MakeSourceLedgerPaymentDto,
  QuerySourceLedgerDto,
} from './dto/source-ledger.dto';

const ledgerEntryInclude = {
  sourceType: { select: { id: true, module: true, name: true } },
  glAccount: { select: { id: true, code: true, name: true } },
  journalEntry: { select: { id: true, journalNumber: true } },
  allocations: {
    where: { reversedAt: null },
    select: {
      id: true,
      amount: true,
      allocatedAt: true,
      cashbookTransaction: {
        select: {
          id: true,
          reference: true,
          description: true,
          transactionDate: true,
        },
      },
    },
    orderBy: { allocatedAt: 'desc' as const },
  },
};

type LedgerEntryWithRelations = {
  id: string;
  sourceRecordId: string | null;
  description: string;
  amount: { toString(): string };
  currency: string;
  createdAt: Date;
  sourceType: { id: string; module: string; name: string };
  glAccount: { id: string; code: string; name: string };
  journalEntry: { id: string; journalNumber: string };
  allocations: {
    id: string;
    amount: { toString(): string };
    allocatedAt: Date;
    cashbookTransaction: {
      id: string;
      reference: string | null;
      description: string;
      transactionDate: Date;
    };
  }[];
};

export interface CreateSourceLedgerEntryInput {
  tenantId: string;
  sourceTypeId: string;
  glAccountId: string;
  journalEntryId: string;
  sourceRecordId?: string;
  description: string;
  amount: number;
  currency: string;
}

type PaymentState = 'OPEN' | 'PARTIALLY_PAID' | 'PAID';

@Injectable()
export class SourceLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashbook: CashbookService,
  ) {}

  /** Called by any module integration's own posting logic (e.g. payroll's accrual) right
   *  after it creates a journal — never generates a journal itself, just links to the one
   *  the caller already made. */
  async createEntry(input: CreateSourceLedgerEntryInput) {
    return this.prisma.sourceLedgerEntry.create({
      data: {
        tenantId: input.tenantId,
        sourceTypeId: input.sourceTypeId,
        glAccountId: input.glAccountId,
        journalEntryId: input.journalEntryId,
        sourceRecordId: input.sourceRecordId,
        description: input.description,
        amount: input.amount,
        currency: input.currency,
      },
    });
  }

  /** Only entries whose linked journal has actually been POSTED are shown — an unreviewed
   *  DRAFT accrual hasn't hit the ledger yet, so nothing should be payable against it.
   *  Status/date filtering and paymentDate sorting can't be pushed into SQL (paymentState
   *  and last-payment-date are computed from allocations, not stored columns), so they're
   *  applied here after the fetch — fine at this ledger's expected volume. */
  async list(user: RequestUser, query: QuerySourceLedgerDto) {
    const entries = await this.prisma.sourceLedgerEntry.findMany({
      where: {
        tenantId: user.tenantId,
        ...(query.sourceTypeId ? { sourceTypeId: query.sourceTypeId } : {}),
        ...(query.dateFrom || query.dateTo
          ? {
              createdAt: {
                ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                ...(query.dateTo ? { lte: this.endOfDay(query.dateTo) } : {}),
              },
            }
          : {}),
        journalEntry: { status: JournalStatus.POSTED },
      },
      include: ledgerEntryInclude,
    });

    let dtos = entries.map((entry) => this.toDto(entry));

    if (query.status && query.status !== 'ALL') {
      dtos = dtos.filter((dto) =>
        query.status === 'PAID'
          ? dto.paymentState === 'PAID'
          : dto.paymentState !== 'PAID',
      );
    }

    const sortDir = query.sortDir === 'asc' ? 1 : -1;
    if (query.sortBy === 'paymentDate') {
      dtos.sort((a, b) => {
        if (!a.lastPaymentAt && !b.lastPaymentAt) return 0;
        if (!a.lastPaymentAt) return 1;
        if (!b.lastPaymentAt) return -1;
        return (
          sortDir *
          (new Date(a.lastPaymentAt).getTime() -
            new Date(b.lastPaymentAt).getTime())
        );
      });
    } else {
      dtos.sort(
        (a, b) =>
          sortDir *
          (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      );
    }

    return query.limit ? dtos.slice(0, query.limit) : dtos;
  }

  /** Always the full unfiltered picture for this source type, independent of whatever
   *  filters the entry list is currently applying — the summary shouldn't shift under the
   *  tenant just because they narrowed the list below it. */
  async getSourceTypeSummary(tenantId: string, sourceTypeId: string) {
    const entries = await this.prisma.sourceLedgerEntry.findMany({
      where: {
        tenantId,
        sourceTypeId,
        journalEntry: { status: JournalStatus.POSTED },
      },
      select: {
        amount: true,
        allocations: { where: { reversedAt: null }, select: { amount: true } },
      },
    });

    let totalAmount = 0;
    let totalOutstanding = 0;
    let paidCount = 0;
    for (const entry of entries) {
      const amount = Number(entry.amount.toString());
      const outstanding = this.outstanding(entry);
      totalAmount += amount;
      totalOutstanding += Math.max(outstanding, 0);
      if (outstanding <= 0) paidCount += 1;
    }

    return {
      entryCount: entries.length,
      paidCount,
      totalAmount: this.round2(totalAmount),
      totalOutstanding: this.round2(totalOutstanding),
    };
  }

  /** Per-source-type entry/paid counts, for the Source Types list's at-a-glance columns —
   *  "how many entries this source has, and how many of those are fully paid". */
  async getSettlementSummary(
    tenantId: string,
  ): Promise<Map<string, { entryCount: number; paidCount: number }>> {
    const entries = await this.prisma.sourceLedgerEntry.findMany({
      where: { tenantId, journalEntry: { status: JournalStatus.POSTED } },
      select: {
        sourceTypeId: true,
        amount: true,
        allocations: { where: { reversedAt: null }, select: { amount: true } },
      },
    });

    const summary = new Map<
      string,
      { entryCount: number; paidCount: number }
    >();
    for (const entry of entries) {
      const current = summary.get(entry.sourceTypeId) ?? {
        entryCount: 0,
        paidCount: 0,
      };
      current.entryCount += 1;
      if (this.outstanding(entry) <= 0) current.paidCount += 1;
      summary.set(entry.sourceTypeId, current);
    }
    return summary;
  }

  /** All entries tied to one source record (e.g. a payroll run's accrual) — used by a
   *  module integration to check whether every liability line it created has settled. */
  async listBySourceRecord(tenantId: string, sourceRecordId: string) {
    const entries = await this.prisma.sourceLedgerEntry.findMany({
      where: {
        tenantId,
        sourceRecordId,
        journalEntry: { status: JournalStatus.POSTED },
      },
      include: ledgerEntryInclude,
    });
    return entries.map((entry) => this.toDto(entry));
  }

  async makePayment(
    user: RequestUser,
    entryId: string,
    dto: MakeSourceLedgerPaymentDto,
  ) {
    const entry = await this.findPostedEntry(user.tenantId, entryId);
    const outstanding = this.outstanding(entry);
    if (dto.amount > outstanding) {
      throw new BadRequestException(
        `Amount exceeds the outstanding balance (${outstanding.toFixed(2)} ${entry.currency})`,
      );
    }

    const draft = await this.cashbook.createPayment(user, {
      cashAccountId: dto.cashAccountId,
      amount: dto.amount,
      currency: entry.currency,
      transactionDate: dto.transactionDate,
      settlementMethod: dto.settlementMethod,
      description: dto.description?.trim() || `Payment: ${entry.description}`,
      offsetGlAccountId: entry.glAccountId,
    });
    const posted = await this.cashbook.postTransaction(user, draft.id);

    await this.prisma.sourceLedgerAllocation.create({
      data: {
        tenantId: user.tenantId,
        sourceLedgerEntryId: entry.id,
        cashbookTransactionId: posted.id,
        amount: dto.amount,
        allocatedByUserId: user.id,
      },
    });

    const updated = await this.findPostedEntry(user.tenantId, entryId);
    return this.toDto(updated);
  }

  private async findPostedEntry(tenantId: string, entryId: string) {
    const entry = await this.prisma.sourceLedgerEntry.findFirst({
      where: {
        id: entryId,
        tenantId,
        journalEntry: { status: JournalStatus.POSTED },
      },
      include: ledgerEntryInclude,
    });
    if (!entry) throw new NotFoundException('Source ledger entry not found');
    return entry;
  }

  private endOfDay(dateOnly: string): Date {
    return new Date(`${dateOnly}T23:59:59.999Z`);
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private outstanding(entry: {
    amount: { toString(): string };
    allocations: { amount: { toString(): string } }[];
  }): number {
    const allocated = entry.allocations.reduce(
      (sum, allocation) => sum + Number(allocation.amount.toString()),
      0,
    );
    return Number(entry.amount.toString()) - allocated;
  }

  private paymentState(amount: number, outstanding: number): PaymentState {
    if (outstanding <= 0) return 'PAID';
    if (outstanding < amount) return 'PARTIALLY_PAID';
    return 'OPEN';
  }

  private toDto(entry: LedgerEntryWithRelations) {
    const amount = Number(entry.amount.toString());
    const outstanding = this.outstanding(entry);
    const lastPaymentAt = entry.allocations.reduce<Date | null>(
      (latest, allocation) =>
        !latest || allocation.allocatedAt > latest
          ? allocation.allocatedAt
          : latest,
      null,
    );
    return {
      id: entry.id,
      sourceRecordId: entry.sourceRecordId,
      description: entry.description,
      amount,
      outstandingAmount: outstanding,
      currency: entry.currency,
      createdAt: entry.createdAt.toISOString(),
      lastPaymentAt: lastPaymentAt ? lastPaymentAt.toISOString() : null,
      sourceType: entry.sourceType,
      glAccount: entry.glAccount,
      journalEntry: entry.journalEntry,
      paymentState: this.paymentState(amount, outstanding),
      allocations: entry.allocations.map((allocation) => ({
        id: allocation.id,
        amount: Number(allocation.amount.toString()),
        allocatedAt: allocation.allocatedAt.toISOString(),
        cashbookTransaction: {
          id: allocation.cashbookTransaction.id,
          reference: allocation.cashbookTransaction.reference,
          description: allocation.cashbookTransaction.description,
          transactionDate:
            allocation.cashbookTransaction.transactionDate.toISOString(),
        },
      })),
    };
  }
}
