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
   *  DRAFT accrual hasn't hit the ledger yet, so nothing should be payable against it. */
  async list(user: RequestUser, query: QuerySourceLedgerDto) {
    const entries = await this.prisma.sourceLedgerEntry.findMany({
      where: {
        tenantId: user.tenantId,
        ...(query.sourceTypeId ? { sourceTypeId: query.sourceTypeId } : {}),
        journalEntry: { status: JournalStatus.POSTED },
      },
      include: {
        sourceType: { select: { id: true, module: true, name: true } },
        glAccount: { select: { id: true, code: true, name: true } },
        allocations: { where: { reversedAt: null }, select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
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
      include: {
        sourceType: { select: { id: true, module: true, name: true } },
        glAccount: { select: { id: true, code: true, name: true } },
        allocations: { where: { reversedAt: null }, select: { amount: true } },
      },
    });
    if (!entry) throw new NotFoundException('Source ledger entry not found');
    return entry;
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

  private toDto(entry: {
    id: string;
    description: string;
    amount: { toString(): string };
    currency: string;
    createdAt: Date;
    sourceType: { id: string; module: string; name: string };
    glAccount: { id: string; code: string; name: string };
    allocations: { amount: { toString(): string } }[];
  }) {
    const amount = Number(entry.amount.toString());
    const outstanding = this.outstanding(entry);
    return {
      id: entry.id,
      description: entry.description,
      amount,
      outstandingAmount: outstanding,
      currency: entry.currency,
      createdAt: entry.createdAt.toISOString(),
      sourceType: entry.sourceType,
      glAccount: entry.glAccount,
      paymentState: this.paymentState(amount, outstanding),
    };
  }
}
