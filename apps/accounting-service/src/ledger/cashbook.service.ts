import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingSettlementMethod,
  CashbookDirection,
  CashbookLineKind,
  CashbookTransactionStatus,
  CashbookTransactionType,
  FiscalPeriodStatus,
  GLAccountCategory,
  JournalStatus,
  NormalBalance,
  Prisma,
  RecordStatus,
  TransactionTypeCategory,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCashAccountDto,
  CreateCashbookAdjustmentDto,
  CreateCashbookChargeDto,
  CreateCashbookPaymentDto,
  CreateCashbookReceiptDto,
  CreateCashbookTransferDto,
  QueryCashAccountsDto,
  QueryCashbookDto,
  ReverseCashbookTransactionDto,
  UpdateCashAccountDto,
  CashbookEntryDto,
} from './dto/cashbook.dto';
import {
  CreateJournalDto,
  JournalLineDto,
  VoidEntryDto,
} from './dto/accounting.dto';
import {
  EditPostedCashbookDto,
  RejectDraftDto,
  UpdateCashbookDraftDto,
} from './dto/draft-actions.dto';
import { JournalsService } from './journals.service';
import { netCashAmount, normalizeEntryLines } from './cashbook-lines.util';
import {
  SourceEventsNotifier,
  SourceTransactionEvent,
} from './source-transactions/source-events.notifier';

const cashAccountInclude = {
  glAccount: {
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      normalBalance: true,
    },
  },
} satisfies Prisma.AccountingCashAccountInclude;

const zero = new Prisma.Decimal(0);

const cashbookInclude = {
  cashAccount: {
    select: {
      id: true,
      name: true,
      accountKind: true,
      currency: true,
      glAccountId: true,
      glAccount: { select: { id: true, code: true, name: true } },
    },
  },
  destinationCashAccount: {
    select: {
      id: true,
      name: true,
      accountKind: true,
      currency: true,
      glAccountId: true,
      glAccount: { select: { id: true, code: true, name: true } },
    },
  },
  offsetGlAccount: { select: { id: true, code: true, name: true } },
  lines: {
    orderBy: { sequence: 'asc' as const },
    include: { glAccount: { select: { id: true, code: true, name: true } } },
  },
  offsetSubledgerAccount: {
    select: { id: true, code: true, name: true, type: true },
  },
  postedJournalEntry: {
    select: { id: true, journalNumber: true, status: true, postedAt: true },
  },
  reversalJournalEntry: {
    select: { id: true, journalNumber: true, status: true, postedAt: true },
  },
  reversalOfTransaction: {
    select: { id: true, reference: true, status: true },
  },
  reversalTransaction: { select: { id: true, reference: true, status: true } },
} satisfies Prisma.CashbookTransactionInclude;

type TransactionClient = Prisma.TransactionClient;
type CashbookRecord = Prisma.CashbookTransactionGetPayload<{
  include: typeof cashbookInclude;
}>;
type SourceCashbookDirection = Extract<CashbookDirection, 'INFLOW' | 'OUTFLOW'>;

export type CreateSourceCashbookTransactionInput = {
  sourceEventInboxId: string;
  sourceModule: string;
  sourceEventType: string;
  sourceRecordId: string;
  sourceReference?: string | null;
  cashAccountId: string;
  direction: SourceCashbookDirection;
  amount: number;
  currency: string;
  transactionDate: Date;
  settlementMethod: AccountingSettlementMethod;
  reference?: string | null;
  counterpartyType?: string | null;
  counterpartyId?: string | null;
  description: string;
  exchangeRate?: number;
  counterLines: JournalLineDto[];
};

@Injectable()
export class CashbookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journals: JournalsService,
    @Optional() private readonly sourceEvents?: SourceEventsNotifier,
  ) {}

  async listCashAccounts(tenantId: string, query: QueryCashAccountsDto) {
    const accounts = await this.prisma.accountingCashAccount.findMany({
      where: {
        tenantId,
        ...(query.accountKind ? { accountKind: query.accountKind } : {}),
        ...(query.currency ? { currency: query.currency } : {}),
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      },
      include: cashAccountInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return this.attachCashBalances(tenantId, accounts);
  }

  async getCashAccount(user: RequestUser, cashAccountId: string) {
    const account = await this.prisma.accountingCashAccount.findFirst({
      where: { id: cashAccountId, tenantId: user.tenantId },
      include: cashAccountInclude,
    });
    if (!account) throw new NotFoundException('Cash account not found');
    const [withBalance] = await this.attachCashBalances(user.tenantId, [
      account,
    ]);
    return withBalance;
  }

  // One grouped aggregate for the whole page instead of a per-account ledger lookup — a
  // cash/bank account's position is just its GL account's running balance (debit normal,
  // like every Asset account), computed from posted (+ reversed, which nets itself out
  // via the reversal's own offsetting lines) journal lines.
  private async attachCashBalances<
    T extends {
      glAccountId: string;
      glAccount: { normalBalance: NormalBalance };
    },
  >(tenantId: string, accounts: T[]) {
    const glAccountIds = Array.from(
      new Set(accounts.map((a) => a.glAccountId)),
    );
    const totalsByGlAccount = new Map<
      string,
      { debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();
    if (glAccountIds.length > 0) {
      const grouped = await this.prisma.journalLine.groupBy({
        by: ['glAccountId'],
        where: {
          tenantId,
          glAccountId: { in: glAccountIds },
          journalEntry: {
            status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
          },
        },
        _sum: { transactionDebit: true, transactionCredit: true },
      });
      for (const row of grouped) {
        totalsByGlAccount.set(row.glAccountId, {
          debit: row._sum.transactionDebit ?? zero,
          credit: row._sum.transactionCredit ?? zero,
        });
      }
    }
    return accounts.map((account) => {
      const totals = totalsByGlAccount.get(account.glAccountId) ?? {
        debit: zero,
        credit: zero,
      };
      const isDebitNormal =
        account.glAccount.normalBalance === NormalBalance.DEBIT;
      const balance = isDebitNormal
        ? totals.debit.minus(totals.credit)
        : totals.credit.minus(totals.debit);
      return { ...account, balance: balance.toFixed(4) };
    });
  }

  async createCashAccount(user: RequestUser, dto: CreateCashAccountDto) {
    await this.assertActiveCurrency(user.tenantId, dto.currency);
    await this.assertCashGlAccount(user.tenantId, dto.glAccountId);

    try {
      const account = await this.prisma.accountingCashAccount.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          accountKind: dto.accountKind,
          currency: dto.currency,
          glAccountId: dto.glAccountId,
          bankName: this.optional(dto.bankName),
          accountNumber: this.optional(dto.accountNumber),
          branch: this.optional(dto.branch),
          description: this.optional(dto.description),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: cashAccountInclude,
      });
      await this.recordAudit(
        user,
        'CASH_ACCOUNT_CREATED',
        'AccountingCashAccount',
        account.id,
        { name: account.name, accountKind: account.accountKind },
      );
      return account;
    } catch (error) {
      this.rethrowCashAccountUnique(error);
    }
  }

  async updateCashAccount(
    user: RequestUser,
    cashAccountId: string,
    dto: UpdateCashAccountDto,
  ) {
    const current = await this.getCashAccount(user, cashAccountId);
    if (dto.currency)
      await this.assertActiveCurrency(user.tenantId, dto.currency);
    if (dto.glAccountId) {
      await this.assertCashGlAccount(user.tenantId, dto.glAccountId);
    }

    try {
      const account = await this.prisma.accountingCashAccount.update({
        where: {
          id_tenantId: { id: current.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.accountKind !== undefined
            ? { accountKind: dto.accountKind }
            : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
          ...(dto.glAccountId !== undefined
            ? { glAccountId: dto.glAccountId }
            : {}),
          ...(dto.bankName !== undefined
            ? { bankName: this.optional(dto.bankName) }
            : {}),
          ...(dto.accountNumber !== undefined
            ? { accountNumber: this.optional(dto.accountNumber) }
            : {}),
          ...(dto.branch !== undefined
            ? { branch: this.optional(dto.branch) }
            : {}),
          ...(dto.description !== undefined
            ? { description: this.optional(dto.description) }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedByUserId: user.id,
        },
        include: cashAccountInclude,
      });
      await this.recordAudit(
        user,
        'CASH_ACCOUNT_UPDATED',
        'AccountingCashAccount',
        account.id,
        dto,
      );
      return account;
    } catch (error) {
      this.rethrowCashAccountUnique(error);
    }
  }

  createReceipt(user: RequestUser, dto: CreateCashbookReceiptDto) {
    return this.createCashbookEntry(user, {
      ...dto,
      transactionType: CashbookTransactionType.RECEIPT,
      direction: CashbookDirection.INFLOW,
    });
  }

  createPayment(user: RequestUser, dto: CreateCashbookPaymentDto) {
    return this.createCashbookEntry(user, {
      ...dto,
      transactionType: CashbookTransactionType.PAYMENT,
      direction: CashbookDirection.OUTFLOW,
    });
  }

  createCharge(user: RequestUser, dto: CreateCashbookChargeDto) {
    return this.createCashbookEntry(user, {
      ...dto,
      transactionType: CashbookTransactionType.CHARGE,
      direction: CashbookDirection.OUTFLOW,
    });
  }

  createAdjustment(user: RequestUser, dto: CreateCashbookAdjustmentDto) {
    return this.createCashbookEntry(user, {
      ...dto,
      transactionType: CashbookTransactionType.ADJUSTMENT,
    });
  }

  async createTransfer(user: RequestUser, dto: CreateCashbookTransferDto) {
    if (dto.cashAccountId === dto.destinationCashAccountId) {
      throw new BadRequestException(
        'Transfer source and destination cash accounts must be different',
      );
    }
    const [source, destination] = await Promise.all([
      this.resolveActiveCashAccount(user.tenantId, dto.cashAccountId),
      this.resolveActiveCashAccount(
        user.tenantId,
        dto.destinationCashAccountId,
      ),
    ]);
    if (source.currency !== dto.currency) {
      throw new BadRequestException(
        'Transfer currency must match the source cash account currency',
      );
    }
    if (source.currency !== destination.currency && !dto.exchangeRate) {
      throw new BadRequestException(
        'Cross-currency transfers require an agreed exchange rate',
      );
    }
    if (dto.chargeAmount && !dto.chargeGlAccountId) {
      throw new BadRequestException(
        'chargeGlAccountId is required when chargeAmount is set',
      );
    }

    const transaction = await this.prisma.cashbookTransaction.create({
      data: {
        tenantId: user.tenantId,
        cashAccountId: source.id,
        destinationCashAccountId: destination.id,
        transactionType: CashbookTransactionType.TRANSFER,
        direction: CashbookDirection.TRANSFER,
        amount: dto.amount,
        currency: dto.currency,
        transactionDate: new Date(dto.transactionDate),
        settlementMethod: AccountingSettlementMethod.INTERNAL_TRANSFER,
        reference: this.optional(dto.reference),
        description: dto.description,
        offsetGlAccountId: this.optional(dto.chargeGlAccountId),
        chargeAmount: dto.chargeAmount,
        sourceModule: this.optional(dto.sourceModule),
        sourceRecordId: this.optional(dto.sourceRecordId),
        exchangeRate: dto.exchangeRate,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
      include: cashbookInclude,
    });
    await this.recordAudit(
      user,
      'CASHBOOK_TRANSFER_CREATED',
      'CashbookTransaction',
      transaction.id,
      { amount: dto.amount, currency: dto.currency },
    );
    return transaction;
  }

  async listCashbook(tenantId: string, query: QueryCashbookDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 25), 100);
    const where: Prisma.CashbookTransactionWhereInput = {
      tenantId,
      ...(query.cashAccountId
        ? {
            OR: [
              { cashAccountId: query.cashAccountId },
              { destinationCashAccountId: query.cashAccountId },
            ],
          }
        : {}),
      ...(query.transactionType
        ? { transactionType: query.transactionType }
        : {}),
      // Voided entries live in the archive; they only show when asked for by status.
      status: query.status ?? { not: CashbookTransactionStatus.VOIDED },
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.counterpartyId ? { counterpartyId: query.counterpartyId } : {}),
      ...(query.fromDate || query.toDate
        ? {
            transactionDate: {
              ...(query.fromDate
                ? { gte: this.startOfDay(query.fromDate) }
                : {}),
              ...(query.toDate ? { lte: this.endOfDay(query.toDate) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.cashbookTransaction.findMany({
        where,
        include: cashbookInclude,
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cashbookTransaction.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getCashbookTransaction(user: RequestUser, transactionId: string) {
    const transaction = await this.prisma.cashbookTransaction.findFirst({
      where: { id: transactionId, tenantId: user.tenantId },
      include: cashbookInclude,
    });
    if (!transaction) {
      throw new NotFoundException('Cashbook transaction not found');
    }
    return transaction;
  }

  async postTransaction(user: RequestUser, transactionId: string) {
    const posted = await this.prisma.$transaction((tx) =>
      this.postTransactionInTransaction(tx, user, transactionId),
    );
    await this.notifySource(user.tenantId, transactionId, 'POSTED');
    return posted;
  }

  /**
   * Completes a draft direct receipt or payment - the date, cash account, settlement method, account
   * and references. Its amount only changes by replacing its lines; the amount becomes their sum.
   */
  async updateDraftTransaction(
    user: RequestUser,
    transactionId: string,
    dto: UpdateCashbookDraftDto,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }
    if (dto.lines && dto.offsetGlAccountId !== undefined) {
      throw new BadRequestException(
        'Send either lines or offsetGlAccountId, not both',
      );
    }
    const transaction = await this.findEditableDraft(
      user.tenantId,
      transactionId,
      'edited',
    );

    const { data, replacementLines } = await this.prepareEntryEdit(
      user,
      transaction,
      dto,
    );

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.cashbookTransaction.updateMany({
        where: {
          id: transaction.id,
          tenantId: user.tenantId,
          status: CashbookTransactionStatus.DRAFT,
        },
        data,
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          'Cashbook transaction was changed by another request',
        );
      }
      if (replacementLines) {
        await tx.cashbookTransactionLine.deleteMany({
          where: { transactionId: transaction.id, tenantId: user.tenantId },
        });
        await tx.cashbookTransactionLine.createMany({
          data: this.lineWrites(replacementLines.lines).map((line) => ({
            ...line,
            tenantId: user.tenantId,
            transactionId: transaction.id,
          })),
        });
      } else if (dto.offsetGlAccountId !== undefined && transaction.lines[0]) {
        // A single-line entry keeps its one line in step with the header's account.
        await tx.cashbookTransactionLine.update({
          where: {
            id_tenantId: {
              id: transaction.lines[0].id,
              tenantId: user.tenantId,
            },
          },
          data: { glAccountId: dto.offsetGlAccountId },
        });
      }
    });
    await this.recordAudit(
      user,
      'CASHBOOK_TRANSACTION_DRAFT_UPDATED',
      'CashbookTransaction',
      transaction.id,
      { changed: Object.keys(dto) },
    );
    return this.getCashbookTransaction(user, transactionId);
  }

  /**
   * Works out what an edit to a direct receipt or payment changes - checking the accounts it
   * names - without writing anything. Shared by draft edits and edits of posted entries.
   */
  private async prepareEntryEdit(
    user: RequestUser,
    transaction: {
      cashAccountId: string;
      currency: string;
      lines: Array<{ id: string }>;
    },
    dto: UpdateCashbookDraftDto & {
      counterpartyType?: string | null;
      counterpartyId?: string | null;
    },
  ) {
    const data: Prisma.CashbookTransactionUncheckedUpdateManyInput = {
      updatedByUserId: user.id,
    };
    if (
      dto.cashAccountId !== undefined &&
      dto.cashAccountId !== transaction.cashAccountId
    ) {
      const cashAccount = await this.resolveActiveCashAccount(
        user.tenantId,
        dto.cashAccountId,
      );
      if (cashAccount.currency !== transaction.currency) {
        throw new BadRequestException(
          'Cashbook transaction currency must match the cash account currency',
        );
      }
      data.cashAccountId = cashAccount.id;
    }
    if (dto.offsetGlAccountId !== undefined) {
      if (transaction.lines.length > 1) {
        throw new BadRequestException(
          'This entry has several lines — edit its lines instead',
        );
      }
      await this.assertPostingOffsetAccount(
        user.tenantId,
        dto.offsetGlAccountId,
      );
      data.offsetGlAccountId = dto.offsetGlAccountId;
    }
    let replacementLines: ReturnType<typeof normalizeEntryLines> | undefined;
    if (dto.lines) {
      replacementLines = normalizeEntryLines({ lines: dto.lines });
      const { lines, total } = replacementLines;
      await Promise.all(
        [...new Set(lines.map((line) => line.glAccountId))].map((glAccountId) =>
          this.assertPostingOffsetAccount(user.tenantId, glAccountId),
        ),
      );
      const cashAccount = await this.prisma.accountingCashAccount.findFirst({
        where: {
          id:
            (data.cashAccountId as string | undefined) ??
            transaction.cashAccountId,
          tenantId: user.tenantId,
        },
        select: { glAccountId: true },
      });
      if (cashAccount) {
        this.assertLinesAvoidCashAccount(lines, cashAccount.glAccountId);
      }
      data.amount = total;
      data.offsetGlAccountId = this.firstItem(lines).glAccountId;
      data.quantity = lines.length === 1 ? (lines[0].quantity ?? null) : null;
      data.unitPrice = lines.length === 1 ? (lines[0].unitPrice ?? null) : null;
    }
    if (dto.transactionDate !== undefined)
      data.transactionDate = new Date(dto.transactionDate);
    if (dto.settlementMethod !== undefined)
      data.settlementMethod = dto.settlementMethod;
    if (dto.exchangeRate !== undefined) data.exchangeRate = dto.exchangeRate;
    if (dto.reference !== undefined)
      data.reference = this.optional(dto.reference);
    if (dto.externalReference !== undefined) {
      data.externalReference = this.optional(dto.externalReference);
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.counterpartyType !== undefined) {
      data.counterpartyType = this.optional(dto.counterpartyType ?? undefined);
    }
    if (dto.counterpartyId !== undefined) {
      data.counterpartyId = this.optional(dto.counterpartyId ?? undefined);
    }
    return { data, replacementLines };
  }

  /** Turns a draft direct receipt or payment down. It keeps its record, never posts, and the reason is stored. */
  async rejectTransaction(
    user: RequestUser,
    transactionId: string,
    dto: RejectDraftDto,
  ) {
    const transaction = await this.findEditableDraft(
      user.tenantId,
      transactionId,
      'rejected',
    );
    const claimed = await this.prisma.cashbookTransaction.updateMany({
      where: {
        id: transaction.id,
        tenantId: user.tenantId,
        status: CashbookTransactionStatus.DRAFT,
      },
      data: {
        status: CashbookTransactionStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedByUserId: user.id,
        rejectionReason: dto.reason,
        updatedByUserId: user.id,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'Cashbook transaction was changed by another request',
      );
    }
    await this.recordAudit(
      user,
      'CASHBOOK_TRANSACTION_REJECTED',
      'CashbookTransaction',
      transaction.id,
      { reason: dto.reason },
    );
    await this.notifySource(user.tenantId, transactionId, 'REJECTED');
    return this.getCashbookTransaction(user, transactionId);
  }

  /**
   * Throws a draft away. A direct receipt/payment raised by another module is rejected instead,
   * so that module hears about it; a draft transfer has no such owner and can simply go.
   */
  async deleteDraftTransaction(user: RequestUser, transactionId: string) {
    const transaction = await this.prisma.cashbookTransaction.findFirst({
      where: { id: transactionId, tenantId: user.tenantId },
      include: {
        receivableReceipt: { select: { id: true } },
        payablePayment: { select: { id: true } },
      },
    });
    if (!transaction)
      throw new NotFoundException('Cashbook transaction not found');
    if (transaction.status !== CashbookTransactionStatus.DRAFT) {
      throw new ConflictException(
        'Only draft cashbook transactions can be deleted',
      );
    }
    if (transaction.receivableReceipt || transaction.payablePayment) {
      throw new ConflictException(
        "This entry belongs to a receipt or payment document - it can't be deleted here",
      );
    }
    if (
      transaction.transactionType !== CashbookTransactionType.RECEIPT &&
      transaction.transactionType !== CashbookTransactionType.PAYMENT &&
      transaction.transactionType !== CashbookTransactionType.TRANSFER
    ) {
      throw new ConflictException(
        'Only direct receipts, payments and transfers can be deleted',
      );
    }
    if (transaction.sourceModule && transaction.sourceModule !== 'ACCOUNTING') {
      throw new ConflictException(
        'This entry was raised by another module - reject it instead',
      );
    }
    try {
      const removed = await this.prisma.cashbookTransaction.deleteMany({
        where: {
          id: transaction.id,
          tenantId: user.tenantId,
          status: CashbookTransactionStatus.DRAFT,
        },
      });
      if (removed.count !== 1) {
        throw new ConflictException(
          'Cashbook transaction was changed by another request',
        );
      }
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ConflictException(
        'This entry is referenced elsewhere and cannot be deleted',
      );
    }
    await this.recordAudit(
      user,
      'CASHBOOK_DRAFT_DELETED',
      'CashbookTransaction',
      transaction.id,
      {
        transactionType: transaction.transactionType,
        transactionNumber: transaction.transactionNumber,
      },
    );
    return { id: transaction.id, deleted: true };
  }

  /** A draft direct receipt/payment. Customer receipts and vendor payments are handled through their own documents. */
  private async findEditableDraft(
    tenantId: string,
    transactionId: string,
    action: 'edited' | 'rejected' | 'deleted',
  ) {
    const transaction = await this.prisma.cashbookTransaction.findFirst({
      where: { id: transactionId, tenantId },
      include: {
        receivableReceipt: { select: { id: true } },
        payablePayment: { select: { id: true } },
        lines: { select: { id: true }, orderBy: { sequence: 'asc' } },
      },
    });
    if (!transaction)
      throw new NotFoundException('Cashbook transaction not found');
    if (transaction.status !== CashbookTransactionStatus.DRAFT) {
      throw new ConflictException(
        `Only draft cashbook transactions can be ${action}`,
      );
    }
    if (transaction.receivableReceipt || transaction.payablePayment) {
      throw new ConflictException(
        `This entry belongs to a receipt or payment document - it can't be ${action} here`,
      );
    }
    if (
      transaction.transactionType !== CashbookTransactionType.RECEIPT &&
      transaction.transactionType !== CashbookTransactionType.PAYMENT
    ) {
      throw new ConflictException(
        `Only direct receipts and payments can be ${action}`,
      );
    }
    return transaction;
  }

  /** Tells the module that raised an entry what happened to it. Never fails the action itself. */
  private async notifySource(
    tenantId: string,
    transactionId: string,
    event: SourceTransactionEvent,
  ) {
    if (!this.sourceEvents) return;
    const transaction = await this.prisma.cashbookTransaction.findFirst({
      where: { id: transactionId, tenantId },
      select: { sourceModule: true },
    });
    await this.sourceEvents.notify({
      tenantId,
      sourceModule: transaction?.sourceModule,
      transactionId,
      event,
    });
  }

  /**
   * Loads a posted or voided entry for a void, edit or restore. Only entries made on the
   * transactions page can change here: a receipt or payment on an invoice or bill changes through
   * that document, and another module's entries through that module. Anything already matched to
   * a bank statement or allocated against a source record is held until it is unmatched.
   */
  private async loadChangeable(
    tx: TransactionClient,
    tenantId: string,
    transactionId: string,
    viaDocument = false,
  ) {
    await tx.$executeRaw`
      SELECT "id" FROM "accounting"."CashbookTransaction"
      WHERE "id" = ${transactionId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;
    const transaction = await tx.cashbookTransaction.findFirst({
      where: { id: transactionId, tenantId },
      include: {
        ...cashbookInclude,
        receivableReceipt: { select: { id: true } },
        payablePayment: { select: { id: true } },
        bankStatementMatches: { select: { id: true } },
        sourceLedgerAllocations: { select: { id: true } },
      },
    });
    if (!transaction) {
      throw new NotFoundException('Cashbook transaction not found');
    }
    if (
      !viaDocument &&
      (transaction.receivableReceipt || transaction.payablePayment)
    ) {
      throw new ConflictException(
        'This entry settles an invoice or bill. Change it from that document.',
      );
    }
    if (transaction.sourceModule && transaction.sourceModule !== 'ACCOUNTING') {
      throw new ConflictException(
        'This entry was raised by another module and changes there.',
      );
    }
    if (transaction.bankStatementMatches.length > 0) {
      throw new ConflictException(
        'This entry is matched to a bank statement. Unmatch it in the reconciliation first.',
      );
    }
    if (transaction.sourceLedgerAllocations.length > 0) {
      throw new ConflictException(
        'This entry has been applied to another record. Undo that first.',
      );
    }
    return transaction;
  }

  private entrySnapshot(transaction: CashbookRecord): Prisma.InputJsonValue {
    return this.jsonSafe({
      transactionNumber: transaction.transactionNumber,
      cashAccountId: transaction.cashAccountId,
      destinationCashAccountId: transaction.destinationCashAccountId,
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      transactionDate: transaction.transactionDate.toISOString(),
      reference: transaction.reference,
      description: transaction.description,
      counterpartyType: transaction.counterpartyType,
      counterpartyId: transaction.counterpartyId,
      chargeAmount: transaction.chargeAmount?.toString() ?? null,
      offsetGlAccountId: transaction.offsetGlAccountId,
      lines: transaction.lines.map((line) => ({
        kind: line.kind,
        glAccountId: line.glAccountId,
        amount: line.amount.toString(),
        description: line.description,
      })),
    });
  }

  /** What an edit changes on a contra transaction - the same checks a new one gets. */
  private async prepareTransferEdit(
    user: RequestUser,
    transaction: CashbookRecord,
    dto: EditPostedCashbookDto,
  ) {
    const sourceId = dto.cashAccountId ?? transaction.cashAccountId;
    const destinationId =
      dto.destinationCashAccountId ?? transaction.destinationCashAccountId;
    if (!destinationId || sourceId === destinationId) {
      throw new BadRequestException(
        'Transfer source and destination cash accounts must be different',
      );
    }
    const [source, destination] = await Promise.all([
      this.resolveActiveCashAccount(user.tenantId, sourceId),
      this.resolveActiveCashAccount(user.tenantId, destinationId),
    ]);
    if (source.currency !== transaction.currency) {
      throw new BadRequestException(
        'Transfer currency must match the source cash account currency',
      );
    }
    const exchangeRate =
      dto.exchangeRate ??
      (transaction.exchangeRate
        ? Number(transaction.exchangeRate.toString())
        : undefined);
    if (source.currency !== destination.currency && !exchangeRate) {
      throw new BadRequestException(
        'Cross-currency transfers require an agreed exchange rate',
      );
    }
    const chargeAmount =
      dto.chargeAmount === undefined
        ? transaction.chargeAmount
          ? Number(transaction.chargeAmount.toString())
          : null
        : dto.chargeAmount;
    const chargeGlAccountId =
      dto.chargeGlAccountId === undefined
        ? transaction.offsetGlAccountId
        : dto.chargeGlAccountId;
    if (chargeAmount && !chargeGlAccountId) {
      throw new BadRequestException(
        'chargeGlAccountId is required when chargeAmount is set',
      );
    }
    const data: Prisma.CashbookTransactionUncheckedUpdateManyInput = {
      updatedByUserId: user.id,
      cashAccountId: source.id,
      destinationCashAccountId: destination.id,
      chargeAmount: chargeAmount || null,
      offsetGlAccountId: chargeAmount ? chargeGlAccountId : null,
    };
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.transactionDate !== undefined) {
      data.transactionDate = new Date(dto.transactionDate);
    }
    if (dto.exchangeRate !== undefined) data.exchangeRate = dto.exchangeRate;
    if (dto.reference !== undefined) {
      data.reference = this.optional(dto.reference);
    }
    if (dto.description !== undefined) data.description = dto.description;
    return data;
  }

  /** Rewrites the entry's posted journal from its current fields, keeping the journal's number. */
  private async rewriteJournal(
    tx: TransactionClient,
    user: RequestUser,
    transactionId: string,
  ) {
    const fresh = await this.findTransactionForUpdate(
      tx,
      user.tenantId,
      transactionId,
    );
    if (!fresh.postedJournalEntryId) {
      throw new ConflictException('This entry has no posted journal');
    }
    await this.journals.rewriteSystemJournalInTransaction(
      tx,
      user,
      fresh.postedJournalEntryId,
      await this.buildJournalDto(tx, user.tenantId, fresh),
    );
  }

  /** Writes an edit to a receipt, payment or contra transaction, lines included. */
  private async applyEntryEdit(
    tx: TransactionClient,
    user: RequestUser,
    transaction: CashbookRecord,
    dto: EditPostedCashbookDto,
  ) {
    const { reason: _reason, ...changes } = dto;
    void _reason;
    if (transaction.reversalOfTransactionId) {
      throw new ConflictException('A reversal cannot be edited');
    }
    if (transaction.transactionType === CashbookTransactionType.TRANSFER) {
      const data = await this.prepareTransferEdit(user, transaction, dto);
      await tx.cashbookTransaction.updateMany({
        where: { id: transaction.id, tenantId: user.tenantId },
        data,
      });
      return;
    }
    if (
      transaction.transactionType !== CashbookTransactionType.RECEIPT &&
      transaction.transactionType !== CashbookTransactionType.PAYMENT
    ) {
      throw new ConflictException(
        'Only direct receipts, payments and contra transactions can be edited',
      );
    }
    const { data, replacementLines } = await this.prepareEntryEdit(
      user,
      transaction,
      changes,
    );
    await tx.cashbookTransaction.updateMany({
      where: { id: transaction.id, tenantId: user.tenantId },
      data,
    });
    if (replacementLines) {
      await tx.cashbookTransactionLine.deleteMany({
        where: { transactionId: transaction.id, tenantId: user.tenantId },
      });
      await tx.cashbookTransactionLine.createMany({
        data: this.lineWrites(replacementLines.lines).map((line) => ({
          ...line,
          tenantId: user.tenantId,
          transactionId: transaction.id,
        })),
      });
    } else if (dto.offsetGlAccountId !== undefined && transaction.lines[0]) {
      await tx.cashbookTransactionLine.update({
        where: {
          id_tenantId: {
            id: transaction.lines[0].id,
            tenantId: user.tenantId,
          },
        },
        data: { glAccountId: dto.offsetGlAccountId },
      });
    }
  }

  /** Edits a posted entry in place while its period is open. It keeps its number; its journal is rewritten. */
  async editPostedTransaction(
    user: RequestUser,
    transactionId: string,
    dto: EditPostedCashbookDto,
  ) {
    await this.prisma.$transaction((tx) =>
      this.editInTransaction(tx, user, transactionId, dto),
    );
    return this.getCashbookTransaction(user, transactionId);
  }

  /** The edit itself, for a receipt or payment document running it inside its own transaction. */
  async editInTransaction(
    tx: TransactionClient,
    user: RequestUser,
    transactionId: string,
    dto: EditPostedCashbookDto,
    viaDocument = false,
  ) {
    const transaction = await this.loadChangeable(
      tx,
      user.tenantId,
      transactionId,
      viaDocument,
    );
    if (transaction.status !== CashbookTransactionStatus.POSTED) {
      throw new ConflictException(
        transaction.status === CashbookTransactionStatus.REVERSED
          ? 'This entry has been reversed. Void the reversal first.'
          : 'Only posted entries can be edited',
      );
    }
    await this.applyEntryEdit(tx, user, transaction, dto);
    await this.rewriteJournal(tx, user, transaction.id);
    await tx.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'CASHBOOK_TRANSACTION_POSTED_EDITED',
        entityType: 'CashbookTransaction',
        entityId: transaction.id,
        changedFields: {
          reason: dto.reason ?? null,
          before: this.entrySnapshot(transaction),
        },
      },
    });
  }

  /**
   * Takes a posted entry out of the books together with its journal. A reversed entry is undone
   * in order: void the reversal first, which also puts the original back as posted.
   */
  async voidPostedTransaction(
    user: RequestUser,
    transactionId: string,
    dto: VoidEntryDto,
  ) {
    await this.prisma.$transaction((tx) =>
      this.voidInTransaction(tx, user, transactionId, dto),
    );
    return this.getCashbookTransaction(user, transactionId);
  }

  /** The void itself, for callers (a receipt or payment document) that run it inside their own transaction. */
  async voidInTransaction(
    tx: TransactionClient,
    user: RequestUser,
    transactionId: string,
    dto: VoidEntryDto,
    viaDocument = false,
  ) {
    const transaction = await this.loadChangeable(
      tx,
      user.tenantId,
      transactionId,
      viaDocument,
    );
    if (transaction.status === CashbookTransactionStatus.REVERSED) {
      throw new ConflictException(
        'This entry has been reversed. Void the reversal first.',
      );
    }
    if (transaction.status !== CashbookTransactionStatus.POSTED) {
      throw new ConflictException('Only posted entries can be voided');
    }
    if (!transaction.postedJournalEntryId) {
      throw new ConflictException('This entry has no posted journal');
    }
    await this.journals.voidSystemJournalInTransaction(
      tx,
      user,
      transaction.postedJournalEntryId,
      dto.reason,
    );
    const originalId = transaction.reversalOfTransactionId;
    await tx.cashbookTransaction.updateMany({
      where: { id: transaction.id, tenantId: user.tenantId },
      data: {
        status: CashbookTransactionStatus.VOIDED,
        voidedAt: new Date(),
        voidedByUserId: user.id,
        voidReason: dto.reason,
        updatedByUserId: user.id,
        // The original gets its reversal slot back; the link is kept for a restore.
        ...(originalId
          ? {
              reversalOfTransactionId: null,
              voidedReversalOfTransactionId: originalId,
            }
          : {}),
      },
    });
    if (originalId) {
      const original = await tx.cashbookTransaction.findFirst({
        where: { id: originalId, tenantId: user.tenantId },
        select: { postedJournalEntryId: true },
      });
      await tx.cashbookTransaction.updateMany({
        where: {
          id: originalId,
          tenantId: user.tenantId,
          status: CashbookTransactionStatus.REVERSED,
        },
        data: {
          status: CashbookTransactionStatus.POSTED,
          reversedAt: null,
          reversedByUserId: null,
          reversalJournalEntryId: null,
          updatedByUserId: user.id,
        },
      });
      if (original?.postedJournalEntryId) {
        await this.journals.setReversedInTransaction(
          tx,
          user,
          original.postedJournalEntryId,
          false,
        );
      }
    }
    await tx.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'CASHBOOK_TRANSACTION_VOIDED',
        entityType: 'CashbookTransaction',
        entityId: transaction.id,
        changedFields: {
          reason: dto.reason,
          transactionNumber: transaction.transactionNumber,
        },
      },
    });
  }

  /**
   * Puts a voided entry back in the books under its own number, with any corrections the
   * re-submitted form carries. A voided reversal comes back as it was, and only while its
   * original is still posted.
   */
  async restoreVoidedTransaction(
    user: RequestUser,
    transactionId: string,
    dto: EditPostedCashbookDto,
  ) {
    await this.prisma.$transaction((tx) =>
      this.restoreInTransaction(tx, user, transactionId, dto),
    );
    return this.getCashbookTransaction(user, transactionId);
  }

  /** The restore itself, for a receipt or payment document running it inside its own transaction. */
  async restoreInTransaction(
    tx: TransactionClient,
    user: RequestUser,
    transactionId: string,
    dto: EditPostedCashbookDto,
    viaDocument = false,
  ) {
    const transaction = await this.loadChangeable(
      tx,
      user.tenantId,
      transactionId,
      viaDocument,
    );
    if (transaction.status !== CashbookTransactionStatus.VOIDED) {
      throw new ConflictException('Only voided entries can be restored');
    }
    if (!transaction.postedJournalEntryId) {
      throw new ConflictException('This entry has no posted journal');
    }
    const originalId = transaction.voidedReversalOfTransactionId;
    if (originalId) {
      const hasEdits = Object.keys(dto).some((key) => key !== 'reason');
      if (hasEdits) {
        throw new ConflictException(
          'A reversal is restored as it was; it cannot be edited',
        );
      }
      const original = await this.findTransactionForUpdate(
        tx,
        user.tenantId,
        originalId,
      );
      if (
        original.status !== CashbookTransactionStatus.POSTED ||
        original.reversalTransaction
      ) {
        throw new ConflictException(
          'Restore the original entry before its reversal',
        );
      }
      await this.journals.reinstateSystemJournalInTransaction(
        tx,
        user,
        transaction.postedJournalEntryId,
      );
      await tx.cashbookTransaction.updateMany({
        where: { id: originalId, tenantId: user.tenantId },
        data: {
          status: CashbookTransactionStatus.REVERSED,
          reversedAt: new Date(),
          reversedByUserId: user.id,
          reversalJournalEntryId: transaction.postedJournalEntryId,
          updatedByUserId: user.id,
        },
      });
      if (original.postedJournalEntryId) {
        await this.journals.setReversedInTransaction(
          tx,
          user,
          original.postedJournalEntryId,
          true,
        );
      }
    } else {
      if (Object.keys(dto).some((key) => key !== 'reason')) {
        await this.applyEntryEdit(tx, user, transaction, dto);
        await this.rewriteJournal(tx, user, transaction.id);
      }
      await this.journals.reinstateSystemJournalInTransaction(
        tx,
        user,
        transaction.postedJournalEntryId,
      );
    }
    await tx.cashbookTransaction.updateMany({
      where: { id: transaction.id, tenantId: user.tenantId },
      data: {
        status: CashbookTransactionStatus.POSTED,
        voidedAt: null,
        voidedByUserId: null,
        voidReason: null,
        updatedByUserId: user.id,
        ...(originalId
          ? {
              reversalOfTransactionId: originalId,
              voidedReversalOfTransactionId: null,
            }
          : {}),
      },
    });
    await tx.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'CASHBOOK_TRANSACTION_RESTORED',
        entityType: 'CashbookTransaction',
        entityId: transaction.id,
        changedFields: { before: this.entrySnapshot(transaction) },
      },
    });
  }

  async postTransactionInTransaction(
    tx: TransactionClient,
    user: RequestUser,
    transactionId: string,
  ) {
    const transaction = await this.findTransactionForUpdate(
      tx,
      user.tenantId,
      transactionId,
    );
    if (transaction.status !== CashbookTransactionStatus.DRAFT) {
      throw new ConflictException(
        'Only draft cashbook transactions can be posted',
      );
    }

    const journal = await this.journals.createPostedInTransaction(
      tx,
      user,
      await this.buildJournalDto(tx, user.tenantId, transaction),
    );
    const claimed = await tx.cashbookTransaction.updateMany({
      where: {
        id: transaction.id,
        tenantId: user.tenantId,
        status: CashbookTransactionStatus.DRAFT,
      },
      data: {
        status: CashbookTransactionStatus.POSTED,
        postedAt: new Date(),
        postedByUserId: user.id,
        postedJournalEntryId: journal.id,
        updatedByUserId: user.id,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'Cashbook transaction was changed by another request',
      );
    }
    await tx.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'CASHBOOK_TRANSACTION_POSTED',
        entityType: 'CashbookTransaction',
        entityId: transaction.id,
        changedFields: {
          journalEntryId: journal.id,
          journalNumber: journal.journalNumber,
        },
      },
    });
    return tx.cashbookTransaction.findUniqueOrThrow({
      where: { id_tenantId: { id: transaction.id, tenantId: user.tenantId } },
      include: cashbookInclude,
    });
  }

  async createPostedSourceEventTransactionInTransaction(
    tx: TransactionClient,
    user: RequestUser,
    input: CreateSourceCashbookTransactionInput,
  ) {
    const cashAccount = await this.resolveActiveCashAccountInTransaction(
      tx,
      user.tenantId,
      input.cashAccountId,
    );
    if (cashAccount.currency !== input.currency) {
      throw new BadRequestException(
        'Source cash event currency must match the Accounting cash account currency',
      );
    }
    if (input.counterLines.length < 1) {
      throw new BadRequestException(
        'Source cash events require at least one posting-rule counter line',
      );
    }

    const transactionType =
      input.direction === CashbookDirection.INFLOW
        ? CashbookTransactionType.RECEIPT
        : CashbookTransactionType.PAYMENT;
    const cashLine: JournalLineDto =
      input.direction === CashbookDirection.INFLOW
        ? {
            glAccountId: cashAccount.glAccountId,
            description: input.description,
            debit: input.amount,
            credit: 0,
          }
        : {
            glAccountId: cashAccount.glAccountId,
            description: input.description,
            debit: 0,
            credit: input.amount,
          };
    const lines =
      input.direction === CashbookDirection.INFLOW
        ? [cashLine, ...input.counterLines]
        : [...input.counterLines, cashLine];

    const period = await this.resolveOpenPeriod(
      tx,
      user.tenantId,
      input.transactionDate,
    );
    const journal = await this.journals.createPostedInTransaction(tx, user, {
      transactionDate: input.transactionDate.toISOString(),
      fiscalPeriodId: period.id,
      transactionCurrency: input.currency,
      exchangeRate: input.exchangeRate,
      reference:
        input.reference ?? input.sourceReference ?? input.sourceRecordId,
      description: input.description,
      idempotencyKey: `source-event:${input.sourceEventInboxId}`,
      sourceModule: input.sourceModule,
      sourceRecordType: input.sourceEventType,
      sourceRecordId: input.sourceRecordId,
      lines,
    });

    const firstCounterLine = input.counterLines[0];
    const transaction = await tx.cashbookTransaction.create({
      data: {
        tenantId: user.tenantId,
        cashAccountId: cashAccount.id,
        transactionType,
        direction: input.direction,
        amount: input.amount,
        currency: input.currency,
        transactionDate: input.transactionDate,
        settlementMethod: input.settlementMethod,
        reference: this.optional(input.reference ?? undefined),
        counterpartyType: this.optional(input.counterpartyType ?? undefined),
        counterpartyId: this.optional(input.counterpartyId ?? undefined),
        externalReference: this.optional(input.sourceReference ?? undefined),
        description: input.description,
        offsetGlAccountId: firstCounterLine.glAccountId,
        offsetSubledgerAccountId: firstCounterLine.subledgerAccountId,
        sourceEventInboxId: input.sourceEventInboxId,
        sourceModule: input.sourceModule,
        sourceEventType: input.sourceEventType,
        sourceRecordId: input.sourceRecordId,
        sourceReference: this.optional(input.sourceReference ?? undefined),
        exchangeRate: input.exchangeRate,
        status: CashbookTransactionStatus.POSTED,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        postedByUserId: user.id,
        postedAt: new Date(),
        postedJournalEntryId: journal.id,
      },
      include: cashbookInclude,
    });

    await tx.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'SOURCE_CASHBOOK_TRANSACTION_POSTED',
        entityType: 'CashbookTransaction',
        entityId: transaction.id,
        changedFields: {
          sourceEventInboxId: input.sourceEventInboxId,
          sourceModule: input.sourceModule,
          sourceEventType: input.sourceEventType,
          sourceRecordId: input.sourceRecordId,
          journalEntryId: journal.id,
        },
      },
    });

    return { transaction, journal };
  }

  async reverseTransaction(
    user: RequestUser,
    transactionId: string,
    dto: ReverseCashbookTransactionDto,
  ) {
    const reversed = await this.prisma.$transaction((tx) =>
      this.reverseTransactionInTransaction(tx, user, transactionId, dto),
    );
    await this.notifySource(user.tenantId, transactionId, 'REVERSED');
    return reversed;
  }

  async reverseTransactionInTransaction(
    tx: TransactionClient,
    user: RequestUser,
    transactionId: string,
    dto: ReverseCashbookTransactionDto,
  ) {
    const transaction = await this.findTransactionForUpdate(
      tx,
      user.tenantId,
      transactionId,
    );
    if (transaction.status !== CashbookTransactionStatus.POSTED) {
      throw new ConflictException(
        'Only posted cashbook transactions can be reversed',
      );
    }
    if (!transaction.postedJournalEntryId || !transaction.postedJournalEntry) {
      throw new ConflictException(
        'Posted cashbook transaction is missing its posted journal',
      );
    }
    if (transaction.reversalTransaction) {
      return tx.cashbookTransaction.findUniqueOrThrow({
        where: {
          id_tenantId: {
            id: transaction.reversalTransaction.id,
            tenantId: user.tenantId,
          },
        },
        include: cashbookInclude,
      });
    }

    const reversalDate = new Date(dto.reversalDate);
    const period = await this.resolveOpenPeriod(
      tx,
      user.tenantId,
      reversalDate,
    );
    const originalJournal = await tx.journalEntry.findFirst({
      where: {
        id: transaction.postedJournalEntryId,
        tenantId: user.tenantId,
        status: JournalStatus.POSTED,
      },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    });
    if (!originalJournal) {
      throw new ConflictException(
        'Original posted journal is not available for reversal',
      );
    }

    const reversalJournal = await this.journals.createPostedInTransaction(
      tx,
      user,
      {
        transactionDate: reversalDate.toISOString(),
        fiscalPeriodId: period.id,
        transactionCurrency: originalJournal.transactionCurrency,
        exchangeRate: Number(originalJournal.exchangeRate.toString()),
        reference: `REVERSAL-${transaction.reference ?? transaction.transactionNumber ?? transaction.id}`,
        description: `Cashbook reversal of ${transaction.reference ?? transaction.transactionNumber ?? transaction.id}: ${dto.reason}`,
        idempotencyKey: `cashbook:${transaction.id}:reversal:v1`,
        sourceModule: 'ACCOUNTING',
        sourceRecordType: 'CASHBOOK_REVERSAL',
        sourceRecordId: transaction.id,
        lines: originalJournal.lines.map((line) => ({
          glAccountId: line.glAccountId,
          subledgerAccountId: line.subledgerAccountId ?? undefined,
          costCentreId: line.costCentreId ?? undefined,
          description: line.description ?? undefined,
          debit: Number(line.transactionCredit.toString()),
          credit: Number(line.transactionDebit.toString()),
        })),
      },
    );

    const journalClaimed = await tx.journalEntry.updateMany({
      where: {
        id: originalJournal.id,
        tenantId: user.tenantId,
        status: JournalStatus.POSTED,
      },
      data: {
        status: JournalStatus.REVERSED,
        reversedAt: new Date(),
        reversedByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    if (journalClaimed.count !== 1) {
      throw new ConflictException(
        'Original journal was changed by another request',
      );
    }

    const reversal = await tx.cashbookTransaction.create({
      data: {
        tenantId: user.tenantId,
        cashAccountId: this.reversalCashAccountId(transaction),
        destinationCashAccountId:
          this.reversalDestinationCashAccountId(transaction),
        transactionType: transaction.transactionType,
        direction: this.reversalDirection(transaction.direction),
        amount: transaction.amount,
        currency: transaction.currency,
        transactionDate: reversalDate,
        settlementMethod: transaction.settlementMethod,
        reference: `REVERSAL-${transaction.reference ?? transaction.transactionNumber ?? transaction.id}`,
        counterpartyType: transaction.counterpartyType,
        counterpartyId: transaction.counterpartyId,
        externalReference: transaction.externalReference,
        description: `Reversal: ${dto.reason}`,
        offsetGlAccountId: transaction.offsetGlAccountId,
        offsetSubledgerAccountId: transaction.offsetSubledgerAccountId,
        sourceModule: transaction.sourceModule,
        sourceRecordId: transaction.sourceRecordId,
        exchangeRate: transaction.exchangeRate,
        status: CashbookTransactionStatus.POSTED,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        postedByUserId: user.id,
        postedAt: new Date(),
        postedJournalEntryId: reversalJournal.id,
        reversalOfTransactionId: transaction.id,
        lines: {
          create: this.lineWrites(
            (transaction.lines ?? []).map((line) => ({
              kind: line.kind,
              glAccountId: line.glAccountId,
              amount: line.amount,
              quantity: line.quantity ? Number(line.quantity.toString()) : null,
              unitPrice: line.unitPrice
                ? Number(line.unitPrice.toString())
                : null,
              description: line.description,
            })),
          ),
        },
      },
      include: cashbookInclude,
    });

    const claimed = await tx.cashbookTransaction.updateMany({
      where: {
        id: transaction.id,
        tenantId: user.tenantId,
        status: CashbookTransactionStatus.POSTED,
      },
      data: {
        status: CashbookTransactionStatus.REVERSED,
        reversedAt: new Date(),
        reversedByUserId: user.id,
        reversalJournalEntryId: reversalJournal.id,
        updatedByUserId: user.id,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'Cashbook transaction was changed by another request',
      );
    }
    await tx.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'CASHBOOK_TRANSACTION_REVERSED',
        entityType: 'CashbookTransaction',
        entityId: transaction.id,
        changedFields: {
          reversalTransactionId: reversal.id,
          reversalJournalEntryId: reversalJournal.id,
          reason: dto.reason,
        },
      },
    });
    return reversal;
  }

  /** The Transaction Type a direct entry is made under must be a cashbook-posting
   *  Receivable (for a receipt) or Payable (for a payment) type of this tenant. */
  private async resolveDirectTransactionTypeCode(
    tenantId: string,
    transactionTypeId: string,
    cashbookType: CashbookTransactionType,
  ) {
    const type = await this.prisma.transactionType.findFirst({
      where: { id: transactionTypeId, tenantId },
    });
    if (!type) throw new NotFoundException('Transaction type not found');
    const expected =
      cashbookType === CashbookTransactionType.RECEIPT
        ? TransactionTypeCategory.RECEIVABLE
        : cashbookType === CashbookTransactionType.PAYMENT
          ? TransactionTypeCategory.PAYABLE
          : null;
    if (!type.postsToCashbook || type.category !== expected) {
      throw new BadRequestException(
        `${type.name} cannot be used for a direct cashbook ${cashbookType.toLowerCase()}`,
      );
    }
    return type.code;
  }

  /** <TransactionType code><YY>-<00001>, e.g. RCPT26-00001 — resets each calendar year per
   *  type. Uses the same gapless counter table as journal numbers (key namespaced with
   *  `TXN-` so it can't collide with a journal key); the counter row stays locked until the
   *  surrounding transaction commits, so concurrent creates are serialised. */
  private async nextTransactionNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    transactionTypeCode: string,
  ) {
    const prefix = `${transactionTypeCode}${String(new Date().getUTCFullYear()).slice(-2)}`;
    const rows = await tx.$queryRaw<Array<{ lastNumber: number }>>`
      INSERT INTO "accounting"."JournalNumberSequence"
        ("id", "tenantId", "key", "lastNumber", "updatedAt")
      VALUES (${randomUUID()}, ${tenantId}, ${'TXN-' + prefix}, 1, NOW())
      ON CONFLICT ("tenantId", "key") DO UPDATE
        SET "lastNumber" = "JournalNumberSequence"."lastNumber" + 1,
            "updatedAt" = NOW()
      RETURNING "lastNumber"
    `;
    return `${prefix}-${String(rows[0].lastNumber).padStart(5, '0')}`;
  }

  private async createCashbookEntry(
    user: RequestUser,
    dto: CashbookEntryDto & {
      transactionType: CashbookTransactionType;
      direction: CashbookDirection;
    },
  ) {
    const { lines, total } = normalizeEntryLines(dto);
    const [cashAccount] = await Promise.all([
      this.resolveActiveCashAccount(user.tenantId, dto.cashAccountId),
      ...[...new Set(lines.map((line) => line.glAccountId))].map(
        (glAccountId) =>
          this.assertPostingOffsetAccount(user.tenantId, glAccountId),
      ),
    ]);
    this.assertLinesAvoidCashAccount(lines, cashAccount.glAccountId);
    if (cashAccount.currency !== dto.currency) {
      throw new BadRequestException(
        'Cashbook transaction currency must match the cash account currency',
      );
    }
    const transactionTypeCode = dto.transactionTypeId
      ? await this.resolveDirectTransactionTypeCode(
          user.tenantId,
          dto.transactionTypeId,
          dto.transactionType,
        )
      : null;
    // The number is drawn in the same DB transaction as the insert, so a failed create
    // frees it again instead of leaving a gap.
    const transaction = await this.prisma.$transaction(async (tx) => {
      const transactionNumber = transactionTypeCode
        ? await this.nextTransactionNumber(
            tx,
            user.tenantId,
            transactionTypeCode,
          )
        : null;
      return tx.cashbookTransaction.create({
        data: {
          tenantId: user.tenantId,
          cashAccountId: cashAccount.id,
          transactionType: dto.transactionType,
          direction: dto.direction,
          transactionNumber,
          amount: total,
          // A single-account entry keeps its quantity × price on the header too; with
          // several lines each carries its own.
          quantity: lines.length === 1 ? lines[0].quantity : undefined,
          unitPrice: lines.length === 1 ? lines[0].unitPrice : undefined,
          currency: dto.currency,
          transactionDate: new Date(dto.transactionDate),
          settlementMethod: dto.settlementMethod,
          reference: this.optional(dto.reference),
          counterpartyType: this.optional(dto.counterpartyType),
          counterpartyId: this.optional(dto.counterpartyId),
          externalReference: this.optional(dto.externalReference),
          description: dto.description,
          offsetGlAccountId: this.firstItem(lines).glAccountId,
          offsetSubledgerAccountId: dto.offsetSubledgerAccountId,
          sourceModule: this.optional(dto.sourceModule),
          sourceRecordId: this.optional(dto.sourceRecordId),
          exchangeRate: dto.exchangeRate,
          createdByUserId: user.id,
          updatedByUserId: user.id,
          lines: { create: this.lineWrites(lines) },
        },
        include: cashbookInclude,
      });
    });
    await this.recordAudit(
      user,
      'CASHBOOK_TRANSACTION_CREATED',
      'CashbookTransaction',
      transaction.id,
      {
        transactionType: transaction.transactionType,
        transactionNumber: transaction.transactionNumber,
        amount: total.toString(),
        lineCount: lines.length,
        currency: dto.currency,
      },
    );
    return transaction;
  }

  private async buildJournalDto(
    tx: TransactionClient,
    tenantId: string,
    transaction: CashbookRecord,
  ): Promise<CreateJournalDto> {
    const period = await this.resolveOpenPeriod(
      tx,
      tenantId,
      transaction.transactionDate,
    );
    const lines = this.journalLines(transaction);
    return {
      transactionDate: transaction.transactionDate.toISOString(),
      fiscalPeriodId: period.id,
      transactionCurrency: transaction.currency,
      exchangeRate: transaction.exchangeRate
        ? Number(transaction.exchangeRate.toString())
        : undefined,
      reference:
        transaction.reference ??
        transaction.transactionNumber ??
        transaction.id,
      description: transaction.description,
      idempotencyKey: `cashbook:${transaction.id}:posted:v1`,
      sourceModule: transaction.sourceModule ?? 'ACCOUNTING',
      sourceRecordType: 'CASHBOOK_TRANSACTION',
      sourceRecordId: transaction.sourceRecordId ?? transaction.id,
      lines,
    };
  }

  private journalLines(transaction: CashbookRecord): JournalLineDto[] {
    const amount = Number(transaction.amount.toString());
    const cashLine = {
      glAccountId: transaction.cashAccount.glAccountId,
      description: transaction.description,
    };
    const offsetLine = transaction.offsetGlAccountId
      ? {
          glAccountId: transaction.offsetGlAccountId,
          subledgerAccountId: transaction.offsetSubledgerAccountId ?? undefined,
          description: transaction.description,
        }
      : null;

    if (transaction.transactionType === CashbookTransactionType.TRANSFER) {
      if (!transaction.destinationCashAccount) {
        throw new ConflictException(
          'Transfer is missing destination cash account',
        );
      }
      const chargeAmount = transaction.chargeAmount
        ? Number(transaction.chargeAmount.toString())
        : 0;
      if (chargeAmount > 0 && !offsetLine) {
        throw new ConflictException(
          'Transfer charge is missing a charges account',
        );
      }
      return [
        {
          glAccountId: transaction.destinationCashAccount.glAccountId,
          description: transaction.description,
          debit: amount,
          credit: 0,
        },
        ...(chargeAmount > 0
          ? [{ ...offsetLine!, debit: chargeAmount, credit: 0 }]
          : []),
        { ...cashLine, debit: 0, credit: amount + chargeAmount },
      ];
    }

    // An entry made before lines existed has none: its header offset account and amount
    // are its one item.
    const entryLines = transaction.lines ?? [];
    const offsets =
      entryLines.length > 0
        ? entryLines.map((line, index) => ({
            kind: line.kind,
            glAccountId: line.glAccountId,
            subledgerAccountId:
              index === 0
                ? (transaction.offsetSubledgerAccountId ?? undefined)
                : undefined,
            description: line.description ?? transaction.description,
            amount: Number(line.amount.toString()),
          }))
        : offsetLine
          ? [{ kind: CashbookLineKind.ITEM, ...offsetLine, amount }]
          : [];
    if (offsets.length === 0) {
      throw new ConflictException(
        'Cashbook transaction is missing offset account',
      );
    }
    const net = netCashAmount(
      offsets.map((line) => ({
        kind: line.kind,
        amount: new Prisma.Decimal(line.amount),
      })),
    );
    if (!net.equals(new Prisma.Decimal(amount))) {
      throw new ConflictException(
        'Cashbook transaction lines do not add up to its amount',
      );
    }

    // An item or charge goes on the same side as the offset account always did (a payment
    // debits it, a receipt credits it); a deduction goes on the other side. The cash line is
    // the net of all of them.
    const isInflow = transaction.direction === CashbookDirection.INFLOW;
    const lineJournal = offsets.map(({ kind, amount: lineAmount, ...line }) => {
      const addsToEntry = kind !== CashbookLineKind.DEDUCTION;
      const onCreditSide = addsToEntry ? isInflow : !isInflow;
      return {
        ...line,
        debit: onCreditSide ? 0 : lineAmount,
        credit: onCreditSide ? lineAmount : 0,
      };
    });
    return isInflow
      ? [{ ...cashLine, debit: amount, credit: 0 }, ...lineJournal]
      : [...lineJournal, { ...cashLine, debit: 0, credit: amount }];
  }

  // Nested under `lines: { create: [...] }` — tenantId comes from the parent entry through the
  // composite FK, so it must not be passed here.
  private lineWrites(
    lines: {
      kind?: CashbookLineKind;
      glAccountId: string;
      amount: Prisma.Decimal;
      quantity?: number | null;
      unitPrice?: number | null;
      description?: string | null;
    }[],
  ) {
    return lines.map((line, index) => ({
      sequence: index + 1,
      kind: line.kind ?? CashbookLineKind.ITEM,
      glAccountId: line.glAccountId,
      amount: line.amount,
      quantity: line.quantity ?? null,
      unitPrice: line.unitPrice ?? null,
      description: this.optional(line.description ?? undefined) ?? null,
    }));
  }

  /** The header's offset account mirrors the first item (a request needs at least one). */
  private firstItem<T extends { kind: CashbookLineKind }>(lines: T[]): T {
    return (
      lines.find((line) => line.kind === CashbookLineKind.ITEM) ?? lines[0]
    );
  }

  /** A line that posts to the entry's own cash account would just cancel itself out. */
  private assertLinesAvoidCashAccount(
    lines: { glAccountId: string }[],
    cashGlAccountId: string,
  ) {
    if (lines.some((line) => line.glAccountId === cashGlAccountId)) {
      throw new BadRequestException(
        "A line cannot post to the entry's own cash account",
      );
    }
  }

  private async findTransactionForUpdate(
    tx: TransactionClient,
    tenantId: string,
    transactionId: string,
  ) {
    const transaction = await tx.cashbookTransaction.findFirst({
      where: { id: transactionId, tenantId },
      include: cashbookInclude,
    });
    if (!transaction) {
      throw new NotFoundException('Cashbook transaction not found');
    }
    return transaction;
  }

  private async resolveActiveCashAccount(tenantId: string, id: string) {
    return this.resolveActiveCashAccountInTransaction(
      this.prisma,
      tenantId,
      id,
    );
  }

  private async resolveActiveCashAccountInTransaction(
    client: TransactionClient | PrismaService,
    tenantId: string,
    id: string,
  ) {
    const account = await client.accountingCashAccount.findFirst({
      where: { id, tenantId },
      include: cashAccountInclude,
    });
    if (!account) throw new NotFoundException('Cash account not found');
    if (!account.isActive) {
      throw new ConflictException(
        'Inactive cash accounts cannot receive new cashbook transactions',
      );
    }
    return account;
  }

  private async assertActiveCurrency(tenantId: string, code: string) {
    const currency = await this.prisma.accountingCurrency.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!currency || !currency.isActive) {
      throw new BadRequestException('Accounting currency is not active');
    }
  }

  private async assertCashGlAccount(tenantId: string, glAccountId: string) {
    const account = await this.prisma.gLAccount.findFirst({
      where: { id: glAccountId, tenantId },
    });
    if (!account) throw new BadRequestException('GL account not found');
    if (
      account.status !== RecordStatus.ACTIVE ||
      !account.allowPosting ||
      account.category !== GLAccountCategory.ASSET
    ) {
      throw new BadRequestException(
        'Cash accounts require an active, posting-enabled asset GL account',
      );
    }
  }

  private async assertPostingOffsetAccount(
    tenantId: string,
    glAccountId: string,
  ) {
    const account = await this.prisma.gLAccount.findFirst({
      where: { id: glAccountId, tenantId },
    });
    if (!account) throw new BadRequestException('Offset GL account not found');
    if (account.status !== RecordStatus.ACTIVE || !account.allowPosting) {
      throw new BadRequestException(
        'Offset GL account must be active and posting-enabled',
      );
    }
  }

  private async resolveOpenPeriod(
    tx: TransactionClient,
    tenantId: string,
    transactionDate: Date,
  ) {
    const period = await tx.fiscalPeriod.findFirst({
      where: {
        tenantId,
        startDate: { lte: transactionDate },
        endDate: { gte: transactionDate },
      },
      orderBy: { startDate: 'desc' },
    });
    if (!period) {
      throw new BadRequestException(
        'No fiscal period contains the cashbook transaction date',
      );
    }
    if (period.status !== FiscalPeriodStatus.OPEN) {
      throw new ConflictException(
        `Cannot post cashbook transaction into a ${period.status.toLowerCase().replace('_', ' ')} fiscal period`,
      );
    }
    return period;
  }

  private reversalDirection(direction: CashbookDirection) {
    if (direction === CashbookDirection.INFLOW)
      return CashbookDirection.OUTFLOW;
    if (direction === CashbookDirection.OUTFLOW)
      return CashbookDirection.INFLOW;
    return CashbookDirection.TRANSFER;
  }

  private reversalCashAccountId(transaction: CashbookRecord) {
    return transaction.transactionType === CashbookTransactionType.TRANSFER &&
      transaction.destinationCashAccountId
      ? transaction.destinationCashAccountId
      : transaction.cashAccountId;
  }

  private reversalDestinationCashAccountId(transaction: CashbookRecord) {
    return transaction.transactionType === CashbookTransactionType.TRANSFER
      ? transaction.cashAccountId
      : null;
  }

  private async recordAudit(
    user: RequestUser,
    action: string,
    entityType: string,
    entityId: string,
    changedFields: unknown,
  ) {
    await this.prisma.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action,
        entityType,
        entityId,
        changedFields: this.jsonSafe(changedFields),
      },
    });
  }

  private jsonSafe(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private optional(value: string | undefined): string | null | undefined {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
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

  private rethrowCashAccountUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A cash account with this name or account identifier already exists',
      );
    }
    throw error;
  }
}
