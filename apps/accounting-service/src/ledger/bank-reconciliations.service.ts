import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RequestUser } from '@work-phelo/types';
import {
  BankReconciliationStatus,
  BankStatementLineStatus,
  JournalStatus,
  Prisma,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CompleteBankReconciliationDto,
  QueryBankReconciliationsDto,
} from './dto/bank-reconciliations.dto';

const reconciliationInclude = {
  cashAccount: {
    select: {
      id: true,
      name: true,
      accountKind: true,
      currency: true,
      bankName: true,
      accountNumber: true,
    },
  },
  _count: { select: { statementLines: true, reconciledEntries: true } },
} satisfies Prisma.BankReconciliationInclude;

const matchedJournalLineSelect = {
  id: true,
  description: true,
  baseDebit: true,
  baseCredit: true,
  transactionDebit: true,
  transactionCredit: true,
  journalEntry: {
    select: {
      id: true,
      journalNumber: true,
      transactionDate: true,
      reference: true,
      description: true,
      baseCurrency: true,
      transactionCurrency: true,
    },
  },
} satisfies Prisma.JournalLineSelect;

/** Rounding slack when comparing a bank amount with a ledger amount. */
const AMOUNT_TOLERANCE = new Prisma.Decimal('0.005');

@Injectable()
export class BankReconciliationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: QueryBankReconciliationsDto) {
    const reconciliations = await this.prisma.bankReconciliation.findMany({
      where: {
        tenantId,
        ...(query.cashAccountId ? { cashAccountId: query.cashAccountId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.fromDate || query.toDate
          ? {
              statementEndDate: {
                ...(query.fromDate
                  ? { gte: this.startOfDay(query.fromDate) }
                  : {}),
                ...(query.toDate ? { lte: this.endOfDay(query.toDate) } : {}),
              },
            }
          : {}),
      },
      include: reconciliationInclude,
      orderBy: [{ statementEndDate: 'desc' }, { createdAt: 'desc' }],
    });
    if (reconciliations.length === 0) return [];

    const grouped = await this.prisma.bankStatementLine.groupBy({
      by: ['reconciliationId', 'status'],
      where: {
        tenantId,
        reconciliationId: { in: reconciliations.map((item) => item.id) },
      },
      _count: { _all: true },
    });
    const counts = new Map<string, { matched: number; unmatched: number }>();
    for (const row of grouped) {
      const entry = counts.get(row.reconciliationId) ?? {
        matched: 0,
        unmatched: 0,
      };
      if (row.status === BankStatementLineStatus.MATCHED) {
        entry.matched += row._count._all;
      } else {
        entry.unmatched += row._count._all;
      }
      counts.set(row.reconciliationId, entry);
    }
    return reconciliations.map((item) => ({
      ...item,
      matchedLineCount: counts.get(item.id)?.matched ?? 0,
      unmatchedLineCount: counts.get(item.id)?.unmatched ?? 0,
    }));
  }

  /** Ids of the cash account's ledger lines that a completed reconciliation has already covered. */
  async reconciledJournalLineIds(tenantId: string, cashAccountId: string) {
    const entries = await this.prisma.bankReconciledEntry.findMany({
      where: {
        tenantId,
        reconciliation: {
          cashAccountId,
          status: BankReconciliationStatus.COMPLETED,
        },
      },
      select: { journalLineId: true },
    });
    return { journalLineIds: entries.map((entry) => entry.journalLineId) };
  }

  /** The reconciliation with every statement row and, for matched rows, the ledger line behind it. */
  async get(tenantId: string, reconciliationId: string) {
    const reconciliation = await this.prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, tenantId },
      include: {
        ...reconciliationInclude,
        statementLines: {
          orderBy: { lineNumber: 'asc' },
        },
        reconciledEntries: {
          orderBy: { createdAt: 'asc' },
          include: { journalLine: { select: matchedJournalLineSelect } },
        },
      },
    });
    if (!reconciliation)
      throw new NotFoundException('Bank reconciliation not found');
    return reconciliation;
  }

  async complete(user: RequestUser, dto: CompleteBankReconciliationDto) {
    const startDate = this.startOfDay(dto.statementStartDate);
    const endDate = this.endOfDay(dto.statementEndDate);
    if (startDate > endDate) {
      throw new BadRequestException(
        'Statement start date must not be after statement end date',
      );
    }

    const cashAccount = await this.prisma.accountingCashAccount.findFirst({
      where: { id: dto.cashAccountId, tenantId: user.tenantId, isActive: true },
      select: {
        id: true,
        currency: true,
        glAccountId: true,
        glAccount: { select: { status: true } },
      },
    });
    if (!cashAccount || cashAccount.glAccount.status !== RecordStatus.ACTIVE) {
      throw new NotFoundException('Active tenant cash account not found');
    }
    if (cashAccount.currency !== dto.currency) {
      throw new BadRequestException(
        'Reconciliation currency must match the selected cash account',
      );
    }
    for (const [index, line] of dto.statementLines.entries()) {
      if (line.currency && line.currency !== dto.currency) {
        throw new BadRequestException(
          `Statement row ${index + 1} is in ${line.currency}, not ${dto.currency}`,
        );
      }
    }

    const entryIds = dto.reconciledJournalLineIds;
    if (new Set(entryIds).size !== entryIds.length) {
      throw new BadRequestException(
        'A ledger entry can only be reconciled once',
      );
    }
    const ledgerLines = await this.loadLedgerLines(
      user.tenantId,
      cashAccount.glAccountId,
      entryIds,
      startDate,
      endDate,
    );
    let ledgerTotal = new Prisma.Decimal(0);
    for (const id of entryIds) {
      const ledgerLine = ledgerLines.get(id);
      if (!ledgerLine) {
        throw new BadRequestException(
          'A reconciled ledger entry is not a posted entry of this account within the statement period',
        );
      }
      const amount = this.ledgerAmount(ledgerLine, dto.currency);
      if (amount === null) {
        throw new BadRequestException(
          `A reconciled ledger entry is not in ${dto.currency}`,
        );
      }
      ledgerTotal = ledgerTotal.plus(amount);
    }
    const bankTotal = dto.statementLines
      .filter((line) => line.reconciled)
      .reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
    if (ledgerTotal.minus(bankTotal).abs().greaterThan(AMOUNT_TOLERANCE)) {
      throw new BadRequestException(
        `The reconciled ledger entries total ${ledgerTotal.toFixed(2)} but the reconciled statement rows total ${bankTotal.toFixed(2)}`,
      );
    }
    if (entryIds.length > 0) {
      const alreadyReconciled = await this.prisma.bankReconciledEntry.count({
        where: { tenantId: user.tenantId, journalLineId: { in: entryIds } },
      });
      if (alreadyReconciled > 0) {
        throw new ConflictException(
          'One or more of these ledger entries have already been reconciled',
        );
      }
    }

    const statementReference =
      dto.statementReference ??
      `REC-${dto.statementStartDate.slice(0, 10)}-${dto.statementEndDate.slice(0, 10)}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const now = new Date();

    try {
      const reconciliation = await this.prisma.$transaction(
        async (tx) => {
          const created = await tx.bankReconciliation.create({
            data: {
              tenantId: user.tenantId,
              cashAccountId: cashAccount.id,
              statementReference,
              statementStartDate: startDate,
              statementEndDate: endDate,
              openingBalance: dto.openingBalance,
              closingBalance: dto.closingBalance,
              currency: dto.currency,
              status: BankReconciliationStatus.COMPLETED,
              createdByUserId: user.id,
              updatedByUserId: user.id,
              completedByUserId: user.id,
              completedAt: now,
            },
          });
          await tx.bankStatementLine.createMany({
            data: dto.statementLines.map((line, index) => ({
              tenantId: user.tenantId,
              reconciliationId: created.id,
              lineNumber: index + 1,
              transactionDate: new Date(line.transactionDate),
              valueDate: line.valueDate ? new Date(line.valueDate) : null,
              amount: line.amount,
              currency: dto.currency,
              description: line.description ?? null,
              bankReference: line.bankReference ?? null,
              counterpartyName: line.counterpartyName ?? null,
              runningBalance: line.runningBalance ?? null,
              status: line.reconciled
                ? BankStatementLineStatus.MATCHED
                : BankStatementLineStatus.UNMATCHED,
              matchedByUserId: line.reconciled ? user.id : null,
              matchedAt: line.reconciled ? now : null,
            })),
          });
          if (entryIds.length > 0) {
            await tx.bankReconciledEntry.createMany({
              data: entryIds.map((journalLineId) => ({
                tenantId: user.tenantId,
                reconciliationId: created.id,
                journalLineId,
              })),
            });
          }
          await tx.accountingAuditLog.create({
            data: {
              tenantId: user.tenantId,
              actorUserId: user.id,
              action: 'BANK_RECONCILIATION_COMPLETE',
              entityType: 'BankReconciliation',
              entityId: created.id,
              changedFields: {
                cashAccountId: created.cashAccountId,
                statementReference: created.statementReference,
                statementStartDate: created.statementStartDate.toISOString(),
                statementEndDate: created.statementEndDate.toISOString(),
                currency: created.currency,
                statementLineCount: dto.statementLines.length,
                reconciledStatementLineCount: dto.statementLines.filter(
                  (line) => line.reconciled,
                ).length,
                reconciledEntryCount: entryIds.length,
              } as Prisma.InputJsonValue,
            },
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.get(user.tenantId, reconciliation.id);
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException(
          'This statement reference is already used for the account, or a ledger entry was reconciled by someone else; refresh and retry',
        );
      }
      throw error;
    }
  }

  /** Posted ledger lines of the cash account's GL account inside the period, keyed by id. */
  private async loadLedgerLines(
    tenantId: string,
    glAccountId: string,
    ids: string[],
    startDate: Date,
    endDate: Date,
  ) {
    if (ids.length === 0) return new Map<string, LedgerLine>();
    const lines = await this.prisma.journalLine.findMany({
      where: {
        tenantId,
        id: { in: ids },
        glAccountId,
        journalEntry: {
          status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
          transactionDate: { gte: startDate, lte: endDate },
        },
      },
      select: matchedJournalLineSelect,
    });
    return new Map(lines.map((line) => [line.id, line]));
  }

  /** Money in is positive. Uses whichever of the entry's two currencies is the account currency. */
  private ledgerAmount(line: LedgerLine, currency: string) {
    if (line.journalEntry.baseCurrency === currency) {
      return line.baseDebit.minus(line.baseCredit);
    }
    if (line.journalEntry.transactionCurrency === currency) {
      return line.transactionDebit.minus(line.transactionCredit);
    }
    return null;
  }

  private startOfDay(value: string) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: string) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private isUniqueConstraint(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}

type LedgerLine = Prisma.JournalLineGetPayload<{
  select: typeof matchedJournalLineSelect;
}>;
