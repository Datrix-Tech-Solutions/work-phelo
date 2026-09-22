import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RequestUser } from '@work-phelo/types';
import {
  AdjustmentCategory,
  FiscalPeriodStatus,
  JournalEntryType,
  JournalStatus,
  Prisma,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateJournalDto,
  JournalLineDto,
  QueryJournalsDto,
  ReverseJournalDto,
  UpdateDraftJournalDto,
} from './dto/accounting.dto';
import { JournalPolicy } from './journal.policy';

/** Three-letter code identifying the journal type inside its number (JE-STN2609-0000). */
const JOURNAL_TYPE_CODES: Record<JournalEntryType, string> = {
  STANDARD: 'STN',
  ADJUSTING: 'ADJ',
  REVERSING: 'RVS',
  CLOSING: 'CLS',
  OPENING: 'OPN',
  RECURRING: 'RCR',
};

const journalInclude = {
  fiscalPeriod: true,
  // Links both ways, so a journal can say it was reversed (and by what) without being edited.
  reversalJournal: {
    select: { id: true, journalNumber: true, transactionDate: true },
  },
  reversalOfJournal: { select: { id: true, journalNumber: true } },
  lines: {
    include: {
      glAccount: { select: { id: true, code: true, name: true } },
      subledgerAccount: { select: { id: true, code: true, name: true } },
      costCentre: { select: { id: true, code: true, name: true } },
    },
    orderBy: { lineNumber: 'asc' as const },
  },
} satisfies Prisma.JournalEntryInclude;

/** What a journal came from, so the ledger can show its originating transaction. */
const journalSourceInclude = {
  receivablePostedDocument: {
    select: { id: true, documentType: true, documentNumber: true },
  },
  receivableReversalDocument: {
    select: { id: true, documentType: true, documentNumber: true },
  },
  payablePostedDocument: {
    select: { id: true, documentType: true, documentNumber: true },
  },
  payableReversalDocument: {
    select: { id: true, documentType: true, documentNumber: true },
  },
  cashbookPostedTransaction: {
    select: {
      id: true,
      transactionType: true,
      reference: true,
      receivableReceipt: { select: { id: true, receiptNumber: true } },
      payablePayment: { select: { id: true, paymentNumber: true } },
    },
  },
  cashbookReversalTransaction: {
    select: {
      id: true,
      transactionType: true,
      reference: true,
      receivableReceipt: { select: { id: true, receiptNumber: true } },
      payablePayment: { select: { id: true, paymentNumber: true } },
    },
  },
  sourceEvent: {
    select: { id: true, sourceModule: true, sourceEventType: true },
  },
} satisfies Prisma.JournalEntryInclude;

const journalListInclude = {
  ...journalInclude,
  ...journalSourceInclude,
} satisfies Prisma.JournalEntryInclude;

export type JournalSourceCategory =
  | 'RECEIVABLE'
  | 'PAYABLE'
  | 'CASH_AND_BANK'
  | 'INTEGRATION'
  | 'MANUAL';

export interface JournalSource {
  category: JournalSourceCategory;
  /** Human label for the kind of transaction, e.g. "Invoice", "Receipt", "Transfer". */
  kind: string;
  /** The originating transaction's own number, when it has one. */
  number: string | null;
}

const DOCUMENT_KIND: Record<string, string> = {
  INVOICE: 'Invoice',
  BILL: 'Bill',
  CREDIT_NOTE: 'Credit note',
};

const CASHBOOK_KIND: Record<string, string> = {
  RECEIPT: 'Receipt',
  PAYMENT: 'Payment',
  TRANSFER: 'Transfer',
  CHARGE: 'Charge',
  ADJUSTMENT: 'Adjustment',
};

type JournalWithSource = Prisma.JournalEntryGetPayload<{
  include: typeof journalListInclude;
}>;

interface ResolvedJournalDraft {
  entryType: JournalEntryType;
  adjustmentCategory: AdjustmentCategory | null;
  transactionDate: Date;
  fiscalPeriodId: string;
  transactionCurrency: string;
  baseCurrency: string;
  exchangeRate: Prisma.Decimal;
  reference?: string | null;
  description: string;
  lines: JournalLineDto[];
  decimalPlaces: number;
}

@Injectable()
export class JournalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: JournalPolicy,
  ) {}

  async create(
    user: RequestUser,
    dto: CreateJournalDto,
    /** Set by the recurring-entry generator: which template and run date this journal is for. */
    recurring?: { recurringJournalId: string; recurringRunDate: Date },
  ) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.journalEntry.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: user.tenantId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
        include: journalInclude,
      });
      if (existing) return existing;
    }

    try {
      // The number comes from a counter row locked until commit, so a failed create rolls the
      // number back and the sequence stays gapless.
      return await this.prisma.$transaction(async (tx) => {
        const draft = await this.resolveDraft(tx, user.tenantId, dto);
        const journalNumber = await this.nextJournalNumber(
          tx,
          user.tenantId,
          draft.entryType,
          draft.transactionDate,
        );
        return tx.journalEntry.create({
          data: {
            journalNumber,
            entryType: draft.entryType,
            adjustmentCategory: draft.adjustmentCategory,
            ...(recurring
              ? {
                  recurringJournal: {
                    connect: {
                      id_tenantId: {
                        id: recurring.recurringJournalId,
                        tenantId: user.tenantId,
                      },
                    },
                  },
                  recurringRunDate: recurring.recurringRunDate,
                }
              : {}),
            transactionDate: draft.transactionDate,
            fiscalPeriod: {
              connect: {
                id_tenantId: {
                  id: draft.fiscalPeriodId,
                  tenantId: user.tenantId,
                },
              },
            },
            transactionCurrency: draft.transactionCurrency,
            baseCurrency: draft.baseCurrency,
            exchangeRate: draft.exchangeRate,
            reference: this.optional(dto.reference),
            description: dto.description,
            idempotencyKey: this.optional(dto.idempotencyKey),
            sourceModule: this.optional(dto.sourceModule),
            sourceRecordType: this.optional(dto.sourceRecordType),
            sourceRecordId: this.optional(dto.sourceRecordId),
            createdByUserId: user.id,
            updatedByUserId: user.id,
            lines: {
              create: this.lineCreateData(
                user.tenantId,
                draft.lines,
                draft.exchangeRate,
                draft.decimalPlaces,
              ),
            },
          },
          include: journalInclude,
        });
      });
    } catch (error) {
      if (
        dto.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.journalEntry.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: user.tenantId,
              idempotencyKey: dto.idempotencyKey,
            },
          },
          include: journalInclude,
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async createPostedInTransaction(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    dto: CreateJournalDto,
  ) {
    if (dto.idempotencyKey) {
      const existing = await tx.journalEntry.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: user.tenantId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
        include: journalInclude,
      });
      if (existing?.status === JournalStatus.POSTED) return existing;
      if (existing) {
        throw new ConflictException(
          'Journal idempotency key already belongs to an unposted journal',
        );
      }
    }

    const draft = await this.resolveDraft(tx, user.tenantId, dto);
    await this.lockFiscalPeriod(tx, user.tenantId, draft.fiscalPeriodId);
    await this.assertOpenPeriod(
      tx,
      user.tenantId,
      draft.fiscalPeriodId,
      draft.transactionDate,
    );

    const now = new Date();
    return tx.journalEntry.create({
      data: {
        journalNumber: await this.nextJournalNumber(
          tx,
          user.tenantId,
          JournalEntryType.STANDARD,
          draft.transactionDate,
          'AUT',
        ),
        entryType: JournalEntryType.STANDARD,
        status: JournalStatus.POSTED,
        transactionDate: draft.transactionDate,
        postingDate: now,
        fiscalPeriod: {
          connect: {
            id_tenantId: {
              id: draft.fiscalPeriodId,
              tenantId: user.tenantId,
            },
          },
        },
        transactionCurrency: draft.transactionCurrency,
        baseCurrency: draft.baseCurrency,
        exchangeRate: draft.exchangeRate,
        reference: this.optional(dto.reference),
        description: dto.description,
        idempotencyKey: this.optional(dto.idempotencyKey),
        sourceModule: this.optional(dto.sourceModule),
        sourceRecordType: this.optional(dto.sourceRecordType),
        sourceRecordId: this.optional(dto.sourceRecordId),
        createdByUserId: user.id,
        updatedByUserId: user.id,
        postedByUserId: user.id,
        postedAt: now,
        lines: {
          create: this.lineCreateData(
            user.tenantId,
            draft.lines,
            draft.exchangeRate,
            draft.decimalPlaces,
          ),
        },
      },
      include: journalInclude,
    });
  }

  async list(tenantId: string, query: QueryJournalsDto) {
    const journals = await this.prisma.journalEntry.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.from || query.to
          ? {
              transactionDate: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: journalListInclude,
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      ...(query.limit !== undefined ? { take: query.limit } : {}),
      ...(query.offset !== undefined ? { skip: query.offset } : {}),
    });
    return journals.map((journal) => this.withSource(journal));
  }

  async findOne(tenantId: string, journalId: string) {
    const journal = await this.prisma.journalEntry.findFirst({
      where: { id: journalId, tenantId },
      include: journalListInclude,
    });
    if (!journal) throw new NotFoundException('Journal entry not found');
    return this.withSource(journal);
  }

  async updateDraft(
    user: RequestUser,
    journalId: string,
    dto: UpdateDraftJournalDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Lock the journal row so a concurrent post cannot slip between the status check and the
      // rewrite; whichever transaction gets the lock second sees the other's result.
      await this.lockJournal(tx, user.tenantId, journalId);
      const current = await tx.journalEntry.findFirst({
        where: { id: journalId, tenantId: user.tenantId },
        include: journalInclude,
      });
      if (!current) throw new NotFoundException('Journal entry not found');
      if (current.status !== JournalStatus.DRAFT) {
        throw new ConflictException(
          'Posted or reversed journals are immutable',
        );
      }

      const shouldReuseExchangeRate =
        dto.exchangeRate === undefined &&
        dto.transactionDate === undefined &&
        dto.transactionCurrency === undefined;
      const draft = await this.resolveDraft(tx, user.tenantId, {
        transactionDate:
          dto.transactionDate ?? current.transactionDate.toISOString(),
        fiscalPeriodId: dto.fiscalPeriodId ?? current.fiscalPeriodId,
        transactionCurrency:
          dto.transactionCurrency ?? current.transactionCurrency,
        exchangeRate:
          dto.exchangeRate ??
          (shouldReuseExchangeRate
            ? Number(current.exchangeRate.toString())
            : undefined),
        // An explicit empty reference clears it; leaving it out keeps the current one.
        reference:
          dto.reference !== undefined
            ? dto.reference
            : (current.reference ?? undefined),
        description: dto.description ?? current.description,
        lines:
          dto.lines ??
          current.lines.map((line) => ({
            glAccountId: line.glAccountId,
            subledgerAccountId: line.subledgerAccountId ?? undefined,
            costCentreId: line.costCentreId ?? undefined,
            description: line.description ?? undefined,
            debit: Number(line.transactionDebit.toString()),
            credit: Number(line.transactionCredit.toString()),
          })),
      });

      return tx.journalEntry.update({
        where: {
          id_tenantId: { id: current.id, tenantId: user.tenantId },
        },
        data: {
          transactionDate: draft.transactionDate,
          fiscalPeriod: {
            connect: {
              id_tenantId: {
                id: draft.fiscalPeriodId,
                tenantId: user.tenantId,
              },
            },
          },
          transactionCurrency: draft.transactionCurrency,
          baseCurrency: draft.baseCurrency,
          exchangeRate: draft.exchangeRate,
          ...(dto.reference !== undefined
            ? { reference: this.optional(dto.reference) }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          updatedByUserId: user.id,
          lines: {
            deleteMany: {},
            create: this.lineCreateData(
              user.tenantId,
              draft.lines,
              draft.exchangeRate,
              draft.decimalPlaces,
            ),
          },
        },
        include: journalInclude,
      });
    });
  }

  async post(user: RequestUser, journalId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockJournal(tx, user.tenantId, journalId);
      const journal = await tx.journalEntry.findFirst({
        where: { id: journalId, tenantId: user.tenantId },
        include: journalInclude,
      });
      if (!journal) throw new NotFoundException('Journal entry not found');
      if (journal.status === JournalStatus.POSTED) return journal;
      if (journal.status !== JournalStatus.DRAFT) {
        throw new ConflictException('Only draft journals can be posted');
      }

      await this.lockFiscalPeriod(tx, user.tenantId, journal.fiscalPeriodId);
      await this.assertOpenPeriod(
        tx,
        user.tenantId,
        journal.fiscalPeriodId,
        journal.transactionDate,
      );
      this.policy.validateBalanced(
        journal.lines.map((line) => ({
          debit: line.transactionDebit,
          credit: line.transactionCredit,
        })),
      );
      this.policy.validateBalanced(
        journal.lines.map((line) => ({
          debit: line.baseDebit,
          credit: line.baseCredit,
        })),
      );
      const postLines = journal.lines.map((line) => ({
        glAccountId: line.glAccountId,
        subledgerAccountId: line.subledgerAccountId ?? undefined,
        costCentreId: line.costCentreId ?? undefined,
        debit: Number(line.transactionDebit.toString()),
        credit: Number(line.transactionCredit.toString()),
      }));
      await this.assertLineReferences(
        tx,
        user.tenantId,
        postLines,
        journal.transactionCurrency,
      );

      const claimed = await tx.journalEntry.updateMany({
        where: {
          id: journal.id,
          tenantId: user.tenantId,
          status: JournalStatus.DRAFT,
        },
        data: {
          status: JournalStatus.POSTED,
          postingDate: new Date(),
          postedAt: new Date(),
          postedByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Journal was changed by another request');
      }

      return tx.journalEntry.findUniqueOrThrow({
        where: {
          id_tenantId: { id: journal.id, tenantId: user.tenantId },
        },
        include: journalInclude,
      });
    });
  }

  /**
   * Reverses a posted journal by posting a second, linked journal with every debit and credit
   * swapped. The original is never modified — its status, lines and dates stay as posted — so
   * both entries remain in the books; "reversed" is read from the link the reversal carries.
   * The original's row is locked so two concurrent reversals cannot both go through (the unique
   * reversal link is the backstop).
   */
  async reverse(user: RequestUser, journalId: string, dto: ReverseJournalDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockJournal(tx, user.tenantId, journalId);
      const original = await tx.journalEntry.findFirst({
        where: { id: journalId, tenantId: user.tenantId },
        include: {
          ...journalInclude,
          reversalJournal: { include: journalInclude },
        },
      });
      if (!original) throw new NotFoundException('Journal entry not found');
      if (original.reversalJournal) return original.reversalJournal;
      if (original.reversalOfJournalId) {
        throw new ConflictException(
          'Reversal journals cannot be reversed; create a new correcting journal',
        );
      }
      if (original.status !== JournalStatus.POSTED) {
        throw new ConflictException('Only posted journals can be reversed');
      }
      this.policy.validateBalanced(
        original.lines.map((line) => ({
          debit: line.transactionDebit,
          credit: line.transactionCredit,
        })),
      );
      this.policy.validateBalanced(
        original.lines.map((line) => ({
          debit: line.baseDebit,
          credit: line.baseCredit,
        })),
      );

      const reversalDate = new Date(dto.reversalDate);
      if (reversalDate < original.transactionDate) {
        throw new BadRequestException(
          'Reversal date cannot be before the date of the journal being reversed',
        );
      }
      const period = await tx.fiscalPeriod.findFirst({
        where: {
          tenantId: user.tenantId,
          status: FiscalPeriodStatus.OPEN,
          startDate: { lte: reversalDate },
          endDate: { gte: reversalDate },
        },
      });
      if (!period) {
        throw new BadRequestException(
          'An open fiscal period is required for the reversal date',
        );
      }
      await this.lockFiscalPeriod(tx, user.tenantId, period.id);
      await this.assertOpenPeriod(tx, user.tenantId, period.id, reversalDate);

      return tx.journalEntry.create({
        data: {
          journalNumber: await this.nextJournalNumber(
            tx,
            user.tenantId,
            JournalEntryType.REVERSING,
            reversalDate,
          ),
          entryType: JournalEntryType.REVERSING,
          status: JournalStatus.POSTED,
          transactionDate: reversalDate,
          postingDate: new Date(),
          fiscalPeriod: {
            connect: {
              id_tenantId: {
                id: period.id,
                tenantId: user.tenantId,
              },
            },
          },
          transactionCurrency: original.transactionCurrency,
          baseCurrency: original.baseCurrency,
          exchangeRate: original.exchangeRate,
          reference: `REVERSAL-${original.journalNumber}`,
          description: `Reversal of ${original.journalNumber}: ${dto.reason}`,
          sourceModule: original.sourceModule,
          sourceRecordType: original.sourceRecordType,
          sourceRecordId: original.sourceRecordId,
          reversalOfJournal: {
            connect: {
              id_tenantId: {
                id: original.id,
                tenantId: user.tenantId,
              },
            },
          },
          createdByUserId: user.id,
          updatedByUserId: user.id,
          postedByUserId: user.id,
          postedAt: new Date(),
          lines: {
            create: original.lines.map((line, index) => ({
              lineNumber: index + 1,
              glAccount: {
                connect: {
                  id_tenantId: {
                    id: line.glAccountId,
                    tenantId: user.tenantId,
                  },
                },
              },
              ...(line.subledgerAccountId
                ? {
                    subledgerAccount: {
                      connect: {
                        id_tenantId: {
                          id: line.subledgerAccountId,
                          tenantId: user.tenantId,
                        },
                      },
                    },
                  }
                : {}),
              ...(line.costCentreId
                ? {
                    costCentre: {
                      connect: {
                        id_tenantId: {
                          id: line.costCentreId,
                          tenantId: user.tenantId,
                        },
                      },
                    },
                  }
                : {}),
              description: line.description,
              transactionDebit: line.transactionCredit,
              transactionCredit: line.transactionDebit,
              baseDebit: line.baseCredit,
              baseCredit: line.baseDebit,
            })),
          },
        },
        include: journalInclude,
      });
    });
  }

  async accountLedger(tenantId: string, accountId: string) {
    const account = await this.prisma.gLAccount.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) throw new NotFoundException('GL account not found');

    const lines = await this.prisma.journalLine.findMany({
      where: {
        tenantId,
        glAccountId: accountId,
        journalEntry: {
          status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
        },
      },
      include: {
        journalEntry: {
          select: {
            id: true,
            journalNumber: true,
            status: true,
            transactionDate: true,
            postingDate: true,
            reference: true,
            description: true,
            transactionCurrency: true,
            baseCurrency: true,
          },
        },
        subledgerAccount: { select: { id: true, code: true, name: true } },
        costCentre: { select: { id: true, code: true, name: true } },
      },
      orderBy: [
        { journalEntry: { transactionDate: 'asc' } },
        { lineNumber: 'asc' },
      ],
    });

    let runningBalance = new Prisma.Decimal(0);
    const entries = lines.map((line) => {
      const movement =
        account.normalBalance === 'DEBIT'
          ? line.baseDebit.minus(line.baseCredit)
          : line.baseCredit.minus(line.baseDebit);
      runningBalance = runningBalance.plus(movement);
      return { ...line, runningBalance: runningBalance.toFixed(2) };
    });
    return { account, entries, closingBalance: runningBalance.toFixed(2) };
  }

  private async resolveDraft(
    client: PrismaService | Prisma.TransactionClient,
    tenantId: string,
    dto: Omit<CreateJournalDto, 'idempotencyKey'> &
      Partial<Pick<CreateJournalDto, 'idempotencyKey'>>,
  ): Promise<ResolvedJournalDraft> {
    const entryType = dto.entryType ?? JournalEntryType.STANDARD;
    if (entryType === JournalEntryType.ADJUSTING && !dto.adjustmentCategory) {
      throw new BadRequestException(
        'An adjustment category is required for an adjusting entry',
      );
    }
    if (entryType !== JournalEntryType.ADJUSTING && dto.adjustmentCategory) {
      throw new BadRequestException(
        'An adjustment category can only be set on an adjusting entry',
      );
    }
    this.policy.validateBalanced(dto.lines);
    const transactionDate = new Date(dto.transactionDate);
    const period = await client.fiscalPeriod.findFirst({
      where: { id: dto.fiscalPeriodId, tenantId },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');
    if (period.status !== FiscalPeriodStatus.OPEN) {
      throw new ConflictException(
        'Draft journals require an open fiscal period',
      );
    }
    if (
      transactionDate < period.startDate ||
      transactionDate > period.endDate
    ) {
      throw new BadRequestException(
        'Transaction date must fall inside the selected fiscal period',
      );
    }

    const config = await this.configOrThrow(client, tenantId);
    const [transactionCurrency] = await Promise.all([
      this.assertActiveCurrency(client, tenantId, dto.transactionCurrency),
      this.assertActiveCurrency(client, tenantId, config.baseCurrency),
    ]);
    this.policy.validateCurrencyPrecision(
      dto.lines,
      transactionCurrency.code,
      transactionCurrency.decimalPlaces,
    );
    const exchangeRate = await this.resolveExchangeRate(
      client,
      tenantId,
      dto.transactionCurrency,
      config.baseCurrency,
      transactionDate,
      dto.exchangeRate,
    );
    this.policy.validateBalanced(
      this.policy.allocateBaseAmounts(
        dto.lines,
        exchangeRate,
        config.decimalPlaces,
      ),
    );
    await this.assertLineReferences(
      client,
      tenantId,
      dto.lines,
      dto.transactionCurrency,
    );

    return {
      entryType,
      adjustmentCategory: dto.adjustmentCategory ?? null,
      transactionDate,
      fiscalPeriodId: period.id,
      transactionCurrency: dto.transactionCurrency,
      baseCurrency: config.baseCurrency,
      exchangeRate,
      reference: this.optional(dto.reference),
      description: dto.description,
      lines: dto.lines,
      decimalPlaces: config.decimalPlaces,
    };
  }

  private async resolveExchangeRate(
    client: PrismaService | Prisma.TransactionClient,
    tenantId: string,
    transactionCurrency: string,
    baseCurrency: string,
    transactionDate: Date,
    suppliedRate?: number,
  ) {
    if (transactionCurrency === baseCurrency) {
      if (suppliedRate !== undefined && suppliedRate !== 1) {
        throw new BadRequestException(
          'Base currency journals must use an exchange rate of 1',
        );
      }
      return new Prisma.Decimal(1);
    }
    if (suppliedRate !== undefined) return new Prisma.Decimal(suppliedRate);

    const rate = await client.exchangeRate.findFirst({
      where: {
        tenantId,
        fromCurrency: transactionCurrency,
        toCurrency: baseCurrency,
        isActive: true,
        effectiveAt: { lte: transactionDate },
      },
      orderBy: { effectiveAt: 'desc' },
    });
    if (!rate) {
      throw new BadRequestException(
        `Exchange rate ${transactionCurrency}/${baseCurrency} is required`,
      );
    }
    return rate.rate;
  }

  private async assertOpenPeriod(
    tx: Prisma.TransactionClient,
    tenantId: string,
    fiscalPeriodId: string,
    transactionDate: Date,
  ) {
    const period = await tx.fiscalPeriod.findFirst({
      where: { id: fiscalPeriodId, tenantId },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');
    if (period.status !== FiscalPeriodStatus.OPEN) {
      throw new ConflictException(
        `Cannot post into a ${period.status.toLowerCase().replace('_', ' ')} fiscal period`,
      );
    }
    if (
      transactionDate < period.startDate ||
      transactionDate > period.endDate
    ) {
      throw new BadRequestException(
        'Transaction date must fall inside the selected fiscal period',
      );
    }
  }

  private async assertLineReferences(
    client: PrismaService | Prisma.TransactionClient,
    tenantId: string,
    lines: JournalLineDto[],
    transactionCurrency: string,
  ) {
    const accountIds = [...new Set(lines.map((line) => line.glAccountId))];
    const subledgerIds = [
      ...new Set(
        lines
          .map((line) => line.subledgerAccountId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const costCentreIds = [
      ...new Set(
        lines
          .map((line) => line.costCentreId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [accounts, subledgers, costCentres] = await Promise.all([
      client.gLAccount.findMany({
        where: { tenantId, id: { in: accountIds } },
        include: {
          _count: { select: { childAccounts: true } },
        },
      }),
      client.subledgerAccount.findMany({
        where: { tenantId, id: { in: subledgerIds } },
      }),
      client.costCentre.findMany({
        where: { tenantId, id: { in: costCentreIds } },
      }),
    ]);
    if (accounts.length !== accountIds.length) {
      throw new BadRequestException(
        'One or more GL accounts do not belong to this tenant',
      );
    }
    if (
      accounts.some(
        (account) =>
          account.status !== RecordStatus.ACTIVE ||
          !account.allowPosting ||
          account._count.childAccounts > 0,
      )
    ) {
      throw new BadRequestException(
        'Journal lines require active leaf posting-enabled GL accounts',
      );
    }
    if (subledgers.length !== subledgerIds.length) {
      throw new BadRequestException(
        'One or more subledger accounts do not belong to this tenant',
      );
    }
    if (
      subledgers.some(
        (subledger) =>
          subledger.status !== RecordStatus.ACTIVE ||
          (subledger.currency && subledger.currency !== transactionCurrency),
      )
    ) {
      throw new BadRequestException(
        'Subledger accounts must be active and match the journal currency',
      );
    }
    if (
      costCentres.length !== costCentreIds.length ||
      costCentres.some(
        (costCentre) => costCentre.status !== RecordStatus.ACTIVE,
      )
    ) {
      throw new BadRequestException(
        'Cost centres must be active and belong to this tenant',
      );
    }
  }

  private async configOrThrow(
    client: PrismaService | Prisma.TransactionClient,
    tenantId: string,
  ) {
    const config = await client.accountingTenantConfig.findUnique({
      where: { tenantId },
    });
    if (!config) {
      throw new BadRequestException(
        'Accounting tenant configuration is required before creating journals',
      );
    }
    return config;
  }

  private async assertActiveCurrency(
    client: PrismaService | Prisma.TransactionClient,
    tenantId: string,
    code: string,
  ) {
    const currency = await client.accountingCurrency.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!currency?.isActive) {
      throw new BadRequestException(
        `Active accounting currency ${code} not found`,
      );
    }
    return currency;
  }

  private async lockFiscalPeriod(
    tx: Prisma.TransactionClient,
    tenantId: string,
    periodId: string,
  ) {
    await tx.$executeRaw`
      SELECT "id"
      FROM "accounting"."FiscalPeriod"
      WHERE "id" = ${periodId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;
  }

  private lineCreateData(
    tenantId: string,
    lines: JournalLineDto[],
    exchangeRate: Prisma.Decimal,
    decimalPlaces: number,
  ): Prisma.JournalLineCreateWithoutJournalEntryInput[] {
    const baseAmounts = this.policy.allocateBaseAmounts(
      lines,
      exchangeRate,
      decimalPlaces,
    );
    return lines.map((line, index) => {
      const debit = new Prisma.Decimal(line.debit ?? 0);
      const credit = new Prisma.Decimal(line.credit ?? 0);
      return {
        lineNumber: index + 1,
        glAccount: {
          connect: {
            id_tenantId: {
              id: line.glAccountId,
              tenantId,
            },
          },
        },
        ...(line.subledgerAccountId
          ? {
              subledgerAccount: {
                connect: {
                  id_tenantId: {
                    id: line.subledgerAccountId,
                    tenantId,
                  },
                },
              },
            }
          : {}),
        ...(line.costCentreId
          ? {
              costCentre: {
                connect: {
                  id_tenantId: {
                    id: line.costCentreId,
                    tenantId,
                  },
                },
              },
            }
          : {}),
        description: this.optional(line.description),
        transactionDebit: debit,
        transactionCredit: credit,
        baseDebit: baseAmounts[index].debit,
        baseCredit: baseAmounts[index].credit,
      };
    });
  }

  /** Adds `source` and drops the raw source relations from the response. */
  private withSource(journal: JournalWithSource) {
    const {
      receivablePostedDocument,
      receivableReversalDocument,
      payablePostedDocument,
      payableReversalDocument,
      cashbookPostedTransaction,
      cashbookReversalTransaction,
      sourceEvent,
      ...rest
    } = journal;
    return {
      ...rest,
      source: this.describeSource({
        receivableDocument:
          receivablePostedDocument ?? receivableReversalDocument,
        payableDocument: payablePostedDocument ?? payableReversalDocument,
        cashbookTransaction:
          cashbookPostedTransaction ?? cashbookReversalTransaction,
        sourceEvent,
      }),
    };
  }

  private describeSource(links: {
    receivableDocument: JournalWithSource['receivablePostedDocument'];
    payableDocument: JournalWithSource['payablePostedDocument'];
    cashbookTransaction: JournalWithSource['cashbookPostedTransaction'];
    sourceEvent: JournalWithSource['sourceEvent'];
  }): JournalSource {
    const { receivableDocument, payableDocument, cashbookTransaction } = links;
    if (receivableDocument) {
      return {
        category: 'RECEIVABLE',
        kind: DOCUMENT_KIND[receivableDocument.documentType] ?? 'Document',
        number: receivableDocument.documentNumber,
      };
    }
    if (payableDocument) {
      return {
        category: 'PAYABLE',
        kind: DOCUMENT_KIND[payableDocument.documentType] ?? 'Document',
        number: payableDocument.documentNumber,
      };
    }
    if (cashbookTransaction) {
      // Receipts and payments settle a customer invoice or supplier bill, so they belong to
      // receivables/payables even though they move through Cash & Bank.
      if (cashbookTransaction.receivableReceipt) {
        return {
          category: 'RECEIVABLE',
          kind: 'Receipt',
          number: cashbookTransaction.receivableReceipt.receiptNumber,
        };
      }
      if (cashbookTransaction.payablePayment) {
        return {
          category: 'PAYABLE',
          kind: 'Payment',
          number: cashbookTransaction.payablePayment.paymentNumber,
        };
      }
      return {
        category: 'CASH_AND_BANK',
        kind:
          CASHBOOK_KIND[cashbookTransaction.transactionType] ?? 'Transaction',
        number: cashbookTransaction.reference,
      };
    }
    if (links.sourceEvent) {
      return {
        category: 'INTEGRATION',
        kind: links.sourceEvent.sourceEventType,
        number: null,
      };
    }
    return { category: 'MANUAL', kind: 'Journal entry', number: null };
  }

  /**
   * Next journal number: JE-<code><yymm>-<n>, e.g. JE-STN2609-0000. The code is the entry type's,
   * or `AUT` for journals posted automatically from a transaction or integration event. Each type
   * has its own sequence per month (the type code and month are part of the number, so the
   * streams never collide and a gap in one is easy to spot). It starts at 0 and grows past four
   * digits when it has to. The counter row stays locked until the surrounding transaction
   * commits, so concurrent creates are serialised and a rolled-back create frees its number.
   */
  private async nextJournalNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    entryType: JournalEntryType,
    transactionDate: Date,
    codeOverride?: string,
  ) {
    const yy = String(transactionDate.getUTCFullYear()).slice(-2);
    const mm = String(transactionDate.getUTCMonth() + 1).padStart(2, '0');
    const key = `${codeOverride ?? JOURNAL_TYPE_CODES[entryType]}${yy}${mm}`;
    const rows = await tx.$queryRaw<Array<{ lastNumber: number }>>`
      INSERT INTO "accounting"."JournalNumberSequence"
        ("id", "tenantId", "key", "lastNumber", "updatedAt")
      VALUES (${randomUUID()}, ${tenantId}, ${key}, 0, NOW())
      ON CONFLICT ("tenantId", "key") DO UPDATE
        SET "lastNumber" = "JournalNumberSequence"."lastNumber" + 1,
            "updatedAt" = NOW()
      RETURNING "lastNumber"
    `;
    return `JE-${key}-${String(rows[0].lastNumber).padStart(4, '0')}`;
  }

  private async lockJournal(
    tx: Prisma.TransactionClient,
    tenantId: string,
    journalId: string,
  ) {
    await tx.$executeRaw`
      SELECT "id"
      FROM "accounting"."JournalEntry"
      WHERE "id" = ${journalId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;
  }

  private optional(
    value: string | null | undefined,
  ): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return value.trim() || null;
  }
}
