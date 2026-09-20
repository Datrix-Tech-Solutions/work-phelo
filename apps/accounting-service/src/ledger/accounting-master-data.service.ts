import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { RequestUser } from '@work-phelo/types';
import {
  FiscalPeriodStatus,
  GLAccountCategory,
  JournalStatus,
  NormalBalance,
  Prisma,
  RecordStatus,
  TransactionTypeCategory,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { runFiscalPeriodCloseChecks } from './fiscal-period-close-check';
import { fiscalYearName, summarizeFiscalYear } from './fiscal-year';
import {
  CreateAccountClassificationDto,
  CreateAccountGroupDto,
  CreateAccountingCurrencyDto,
  CreateCostCentreDto,
  CreateExchangeRateDto,
  CreateFiscalPeriodDto,
  CreateGLAccountDto,
  CreateSubledgerAccountDto,
  CreateTransactionTypeDto,
  EnsureInternalSubledgerDto,
  QueryAccountGroupsDto,
  QueryAccountHierarchyDto,
  QueryFiscalPeriodsDto,
  QueryGLAccountsDto,
  QuerySubledgerAccountsDto,
  UpdateAccountClassificationDto,
  UpdateAccountGroupDto,
  UpdateAccountingCurrencyDto,
  UpdateAccountingTenantConfigDto,
  UpdateCostCentreDto,
  UpdateExchangeRateDto,
  UpdateGLAccountDto,
  UpdateSubledgerAccountDto,
  UpdateTransactionTypeDto,
} from './dto/accounting.dto';

export enum FinancialStatement {
  BALANCE_SHEET = 'BALANCE_SHEET',
  INCOME_STATEMENT = 'INCOME_STATEMENT',
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const ACCOUNT_CATEGORIES = [
  {
    code: GLAccountCategory.ASSET,
    name: 'Assets',
    normalBalance: NormalBalance.DEBIT,
    financialStatement: FinancialStatement.BALANCE_SHEET,
    displayOrder: 10,
  },
  {
    code: GLAccountCategory.LIABILITY,
    name: 'Liabilities',
    normalBalance: NormalBalance.CREDIT,
    financialStatement: FinancialStatement.BALANCE_SHEET,
    displayOrder: 20,
  },
  {
    code: GLAccountCategory.EQUITY,
    name: 'Equity',
    normalBalance: NormalBalance.CREDIT,
    financialStatement: FinancialStatement.BALANCE_SHEET,
    displayOrder: 30,
  },
  {
    code: GLAccountCategory.REVENUE,
    name: 'Revenue',
    normalBalance: NormalBalance.CREDIT,
    financialStatement: FinancialStatement.INCOME_STATEMENT,
    displayOrder: 40,
  },
  {
    code: GLAccountCategory.EXPENSE,
    name: 'Expenses',
    normalBalance: NormalBalance.DEBIT,
    financialStatement: FinancialStatement.INCOME_STATEMENT,
    displayOrder: 50,
  },
] as const;

const NORMAL_BALANCE_BY_CATEGORY: Record<GLAccountCategory, NormalBalance> = {
  [GLAccountCategory.ASSET]: NormalBalance.DEBIT,
  [GLAccountCategory.LIABILITY]: NormalBalance.CREDIT,
  [GLAccountCategory.EQUITY]: NormalBalance.CREDIT,
  [GLAccountCategory.REVENUE]: NormalBalance.CREDIT,
  [GLAccountCategory.EXPENSE]: NormalBalance.DEBIT,
};

// The numbering blocks every classification/group/GL account code must fall inside,
// keyed by GL account category. Mirrors STANDARD_ACCOUNT_HIERARCHY above.
const CATEGORY_CODE_RANGES: Record<
  GLAccountCategory,
  { min: number; max: number }
> = {
  [GLAccountCategory.ASSET]: { min: 1000, max: 1999 },
  [GLAccountCategory.LIABILITY]: { min: 2000, max: 2999 },
  [GLAccountCategory.EQUITY]: { min: 3000, max: 3999 },
  [GLAccountCategory.REVENUE]: { min: 4000, max: 4999 },
  [GLAccountCategory.EXPENSE]: { min: 5000, max: 5999 },
};

// Trimmed to exactly what every tenant structurally needs — one group per category
// that a Cash Account, Transaction Type Rule, or Bill/Invoice offset line must be able
// to point at. Nothing here is looked up by code elsewhere in the app (forms all pick
// GL accounts by category, never by classification/group), so this is just enough
// default organization to avoid ad hoc groups like a one-off "Bank Account" group that
// don't match the intended Cash and Bank / Accounts Receivable / Accounts Payable setup.
// Sub-numbered within each category's reserved thousand-block (Asset 1000s, Liability
// 2000s, Equity 3000s — unused here, Revenue 4000s, Expense 5000s): x100 for the
// classification, x110/x120/... for its groups.
const STANDARD_ACCOUNT_HIERARCHY = [
  {
    code: '1100',
    name: 'Current Assets',
    category: GLAccountCategory.ASSET,
    displayOrder: 10,
    groups: [
      { code: '1110', name: 'Cash and Bank', displayOrder: 10 },
      {
        code: '1120',
        name: 'Accounts Receivable',
        displayOrder: 20,
      },
    ],
  },
  {
    code: '2100',
    name: 'Current Liabilities',
    category: GLAccountCategory.LIABILITY,
    displayOrder: 20,
    groups: [
      {
        code: '2110',
        name: 'Accounts Payable',
        displayOrder: 10,
      },
    ],
  },
  {
    code: '4100',
    name: 'Revenue',
    category: GLAccountCategory.REVENUE,
    displayOrder: 30,
    groups: [{ code: '4110', name: 'Revenue', displayOrder: 10 }],
  },
  {
    code: '5100',
    name: 'Expenses',
    category: GLAccountCategory.EXPENSE,
    displayOrder: 40,
    groups: [{ code: '5110', name: 'Expenses', displayOrder: 10 }],
  },
] as const;

/** The cashbook transaction types every tenant starts with — mirrors the codes still
 *  hardcoded into CashbookService's dedicated posting paths, so `code` must not change. */
const transactionTypeRuleCountInclude = {
  rule: { include: { lines: { select: { id: true } } } },
} satisfies Prisma.TransactionTypeInclude;

const STANDARD_TRANSACTION_TYPES = [
  {
    code: 'RCPT',
    name: 'Receipt',
    category: TransactionTypeCategory.RECEIVABLE,
    description: 'Money received into a cash/bank account.',
  },
  {
    code: 'PMNT',
    name: 'Payment',
    category: TransactionTypeCategory.PAYABLE,
    description: 'Money paid out of a cash/bank account.',
  },
  {
    code: 'TRNSF',
    name: 'Transfer',
    category: TransactionTypeCategory.NEUTRAL,
    description: 'Move funds between two cash/bank accounts.',
  },
  {
    code: 'CHRG',
    name: 'Bank Charge',
    category: TransactionTypeCategory.NEUTRAL,
    description: 'A bank fee against a cash/bank account.',
  },
  {
    code: 'ADJST',
    name: 'Adjustment',
    category: TransactionTypeCategory.NONE,
    description: 'Manual correction to a cash/bank account.',
  },
] as const;

/** Which current statuses may move to each target status, and the error when they can't. */
const FISCAL_PERIOD_TRANSITIONS: Record<
  FiscalPeriodStatus,
  { from: FiscalPeriodStatus[]; message: string }
> = {
  [FiscalPeriodStatus.OPEN]: {
    from: [FiscalPeriodStatus.SOFT_CLOSED, FiscalPeriodStatus.CLOSED],
    message: 'Only a soft-closed or closed fiscal period can be reopened',
  },
  [FiscalPeriodStatus.SOFT_CLOSED]: {
    from: [FiscalPeriodStatus.OPEN],
    message: 'Only an open fiscal period can be soft closed',
  },
  [FiscalPeriodStatus.CLOSED]: {
    from: [FiscalPeriodStatus.OPEN, FiscalPeriodStatus.SOFT_CLOSED],
    message: 'Only an open or soft-closed fiscal period can be closed',
  },
  [FiscalPeriodStatus.LOCKED]: {
    from: [FiscalPeriodStatus.CLOSED],
    message: 'Only a closed fiscal period can be locked',
  },
};

@Injectable()
export class AccountingMasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  listAccountCategories() {
    return ACCOUNT_CATEGORIES;
  }

  async getConfig(tenantId: string) {
    const config = await this.prisma.accountingTenantConfig.findUnique({
      where: { tenantId },
    });
    return (
      config ?? {
        tenantId,
        baseCurrency: null,
        fiscalYearStartMonth: 1,
        decimalPlaces: 2,
        isConfigured: false,
        createdAt: null,
        updatedAt: null,
      }
    );
  }

  async updateConfig(user: RequestUser, dto: UpdateAccountingTenantConfigDto) {
    if (dto.baseCurrency) {
      await this.assertActiveCurrency(user.tenantId, dto.baseCurrency);
    }

    const existing = await this.prisma.accountingTenantConfig.findUnique({
      where: { tenantId: user.tenantId },
    });
    if (
      existing &&
      dto.baseCurrency &&
      dto.baseCurrency !== existing.baseCurrency
    ) {
      const journalCount = await this.prisma.journalEntry.count({
        where: { tenantId: user.tenantId },
      });
      if (journalCount > 0) {
        throw new ConflictException(
          'Base currency cannot change after journals have been created',
        );
      }
    }
    const baseCurrency = dto.baseCurrency ?? existing?.baseCurrency;
    if (!baseCurrency) {
      throw new BadRequestException(
        'baseCurrency is required when configuring Accounting for the first time',
      );
    }

    return this.prisma.accountingTenantConfig.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        baseCurrency,
        fiscalYearStartMonth: dto.fiscalYearStartMonth ?? 1,
        decimalPlaces: dto.decimalPlaces ?? 2,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
      update: {
        ...(dto.baseCurrency ? { baseCurrency: dto.baseCurrency } : {}),
        ...(dto.fiscalYearStartMonth
          ? { fiscalYearStartMonth: dto.fiscalYearStartMonth }
          : {}),
        ...(dto.decimalPlaces !== undefined
          ? { decimalPlaces: dto.decimalPlaces }
          : {}),
        updatedByUserId: user.id,
      },
    });
  }

  listCurrencies(tenantId: string) {
    return this.prisma.accountingCurrency.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
  }

  async createCurrency(user: RequestUser, dto: CreateAccountingCurrencyDto) {
    try {
      return await this.prisma.accountingCurrency.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          symbol: this.optional(dto.symbol),
          decimalPlaces: dto.decimalPlaces ?? 2,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Currency code already exists');
    }
  }

  async updateCurrency(
    user: RequestUser,
    currencyId: string,
    dto: UpdateAccountingCurrencyDto,
  ) {
    const currency = await this.findCurrency(user.tenantId, currencyId);
    const config = await this.prisma.accountingTenantConfig.findUnique({
      where: { tenantId: user.tenantId },
    });
    const isBase = config?.baseCurrency === currency.code;
    if (isBase && dto.isActive === false) {
      throw new ConflictException(
        'The configured base currency cannot be deactivated',
      );
    }
    if (isBase && dto.code && dto.code !== currency.code) {
      throw new ConflictException(
        'Change the tenant base currency before renaming this currency',
      );
    }

    try {
      return await this.prisma.accountingCurrency.update({
        where: {
          id_tenantId: { id: currency.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.symbol !== undefined
            ? { symbol: this.optional(dto.symbol) }
            : {}),
          ...(dto.decimalPlaces !== undefined
            ? { decimalPlaces: dto.decimalPlaces }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Currency code already exists');
    }
  }

  listExchangeRates(tenantId: string) {
    return this.prisma.exchangeRate.findMany({
      where: { tenantId },
      orderBy: { effectiveAt: 'desc' },
    });
  }

  async createExchangeRate(user: RequestUser, dto: CreateExchangeRateDto) {
    if (dto.fromCurrency === dto.toCurrency) {
      throw new BadRequestException(
        'Exchange rate currencies must be different',
      );
    }
    await Promise.all([
      this.assertActiveCurrency(user.tenantId, dto.fromCurrency),
      this.assertActiveCurrency(user.tenantId, dto.toCurrency),
    ]);

    try {
      return await this.prisma.exchangeRate.create({
        data: {
          tenantId: user.tenantId,
          fromCurrency: dto.fromCurrency,
          toCurrency: dto.toCurrency,
          rate: dto.rate,
          effectiveAt: new Date(dto.effectiveAt),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(
        error,
        'An exchange rate already exists for this currency pair and effective date',
      );
    }
  }

  async updateExchangeRate(
    user: RequestUser,
    rateId: string,
    dto: UpdateExchangeRateDto,
  ) {
    const rate = await this.prisma.exchangeRate.findFirst({
      where: { id: rateId, tenantId: user.tenantId },
    });
    if (!rate) throw new NotFoundException('Exchange rate not found');

    try {
      return await this.prisma.exchangeRate.update({
        where: {
          id_tenantId: { id: rate.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.rate !== undefined ? { rate: dto.rate } : {}),
          ...(dto.effectiveAt
            ? { effectiveAt: new Date(dto.effectiveAt) }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(
        error,
        'An exchange rate already exists for this currency pair and effective date',
      );
    }
  }

  listFiscalPeriods(tenantId: string, query: QueryFiscalPeriodsDto) {
    return this.prisma.fiscalPeriod.findMany({
      where: { tenantId, ...(query.status ? { status: query.status } : {}) },
      orderBy: { startDate: 'desc' },
    });
  }

  async createFiscalPeriod(user: RequestUser, dto: CreateFiscalPeriodDto) {
    if (dto.generateYear !== undefined) {
      return (await this.generateFiscalYear(user, dto.generateYear)).periods;
    }
    if (!dto.name || !dto.startDate || !dto.endDate) {
      throw new BadRequestException(
        'name, startDate and endDate are required unless generateYear is set',
      );
    }
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate > endDate) {
      throw new BadRequestException(
        'Fiscal period endDate must follow startDate',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${'accounting-period:' + user.tenantId})
        )
      `;
      const overlap = await tx.fiscalPeriod.findFirst({
        where: {
          tenantId: user.tenantId,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true, name: true },
      });
      if (overlap) {
        throw new ConflictException(
          `Fiscal period overlaps with ${overlap.name}`,
        );
      }

      // Every period belongs to a fiscal year, so a one-off period must fall inside one.
      const year = await tx.fiscalYear.findFirst({
        where: {
          tenantId: user.tenantId,
          startDate: { lte: startDate },
          endDate: { gte: endDate },
        },
        select: { id: true },
      });
      if (!year) {
        throw new BadRequestException(
          'A fiscal period must fall inside an existing fiscal year — generate the year first',
        );
      }

      try {
        return await tx.fiscalPeriod.create({
          data: {
            tenantId: user.tenantId,
            fiscalYearId: year.id,
            name: dto.name!,
            startDate,
            endDate,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
        });
      } catch (error) {
        this.rethrowUnique(error, 'Fiscal period name already exists');
      }
    });
  }

  async listFiscalYears(tenantId: string) {
    const years = await this.prisma.fiscalYear.findMany({
      where: { tenantId },
      include: { periods: { select: { status: true } } },
      orderBy: { startDate: 'desc' },
    });
    return years.map((year) => summarizeFiscalYear(year, year.periods));
  }

  /** One fiscal year with its periods in calendar order. */
  async getFiscalYear(tenantId: string, yearId: string) {
    const year = await this.prisma.fiscalYear.findFirst({
      where: { id: yearId, tenantId },
      include: { periods: { orderBy: { startDate: 'asc' } } },
    });
    if (!year) throw new NotFoundException('Fiscal year not found');
    return {
      ...summarizeFiscalYear(year, year.periods),
      periods: year.periods,
    };
  }

  /** Creates the fiscal year record and its 12 monthly periods for the year starting in
   *  `calendarYear`, beginning in `startMonthOverride` or else the tenant's configured
   *  fiscalYearStartMonth (e.g. a July start makes 2026 produce FY2026/27: Jul 2026 –
   *  Jun 2027). Same overlap-check/advisory-lock
   *  transaction as a single createFiscalPeriod. */
  async generateFiscalYear(
    user: RequestUser,
    calendarYear: number,
    startMonthOverride?: number,
  ) {
    const startMonth =
      startMonthOverride ??
      (await this.getConfig(user.tenantId)).fiscalYearStartMonth ??
      1;

    const periods = Array.from({ length: 12 }, (_, i) => {
      const monthOffset = startMonth - 1 + i;
      const year = calendarYear + Math.floor(monthOffset / 12);
      const month = monthOffset % 12;
      const startDate = new Date(Date.UTC(year, month, 1));
      const endDate = new Date(Date.UTC(year, month + 1, 0));
      return { name: `${MONTH_NAMES[month]} ${year}`, startDate, endDate };
    });
    const rangeStart = periods[0].startDate;
    const rangeEnd = periods[periods.length - 1].endDate;

    const yearId = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${'accounting-period:' + user.tenantId})
        )
      `;
      const overlap = await tx.fiscalPeriod.findFirst({
        where: {
          tenantId: user.tenantId,
          startDate: { lte: rangeEnd },
          endDate: { gte: rangeStart },
        },
        select: { id: true, name: true },
      });
      if (overlap) {
        throw new ConflictException(
          `Fiscal year overlaps with existing period ${overlap.name}`,
        );
      }

      try {
        const year = await tx.fiscalYear.create({
          data: {
            tenantId: user.tenantId,
            name: fiscalYearName(calendarYear, startMonth),
            startDate: rangeStart,
            endDate: rangeEnd,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
        });
        await tx.fiscalPeriod.createMany({
          data: periods.map((period) => ({
            tenantId: user.tenantId,
            fiscalYearId: year.id,
            name: period.name,
            startDate: period.startDate,
            endDate: period.endDate,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          })),
        });
        return year.id;
      } catch (error) {
        this.rethrowUnique(
          error,
          'A fiscal year or period with a generated name already exists',
        );
      }
    });

    return this.getFiscalYear(user.tenantId, yearId);
  }

  /** What still needs attention before an open period can be soft closed or closed. */
  async fiscalPeriodCloseCheck(tenantId: string, periodId: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id: periodId, tenantId },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');
    return runFiscalPeriodCloseChecks(this.prisma, tenantId, period);
  }

  async changeFiscalPeriodStatus(
    user: RequestUser,
    periodId: string,
    nextStatus: FiscalPeriodStatus,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockFiscalPeriod(tx, user.tenantId, periodId);
      const period = await tx.fiscalPeriod.findFirst({
        where: { id: periodId, tenantId: user.tenantId },
      });
      if (!period) throw new NotFoundException('Fiscal period not found');
      if (period.status === nextStatus) return period;
      if (period.status === FiscalPeriodStatus.LOCKED) {
        throw new ConflictException('Locked fiscal periods are immutable');
      }

      const rule = FISCAL_PERIOD_TRANSITIONS[nextStatus];
      if (!rule.from.includes(period.status)) {
        throw new BadRequestException(rule.message);
      }

      // Leaving OPEN is the point of no return for postings, so anything still unposted in
      // the period has to be dealt with first.
      if (
        period.status === FiscalPeriodStatus.OPEN &&
        (nextStatus === FiscalPeriodStatus.SOFT_CLOSED ||
          nextStatus === FiscalPeriodStatus.CLOSED)
      ) {
        const check = await runFiscalPeriodCloseChecks(
          tx,
          user.tenantId,
          period,
        );
        if (!check.canClose) {
          throw new ConflictException({
            message: `${period.name} cannot be closed yet: ${check.blockers
              .map((blocker) => blocker.message)
              .join('; ')}`,
            blockers: check.blockers,
            warnings: check.warnings,
          });
        }
      }

      const now = new Date();
      const changed = await tx.fiscalPeriod.updateMany({
        where: {
          id: period.id,
          tenantId: user.tenantId,
          status: period.status,
        },
        data: {
          status: nextStatus,
          ...(nextStatus === FiscalPeriodStatus.OPEN
            ? {
                softClosedAt: null,
                softClosedByUserId: null,
                closedAt: null,
                closedByUserId: null,
              }
            : {}),
          ...(nextStatus === FiscalPeriodStatus.SOFT_CLOSED
            ? { softClosedAt: now, softClosedByUserId: user.id }
            : {}),
          ...(nextStatus === FiscalPeriodStatus.CLOSED
            ? { closedAt: now, closedByUserId: user.id }
            : {}),
          ...(nextStatus === FiscalPeriodStatus.LOCKED
            ? { lockedAt: now, lockedByUserId: user.id }
            : {}),
          updatedByUserId: user.id,
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'Fiscal period was changed by another request',
        );
      }
      return tx.fiscalPeriod.findUniqueOrThrow({
        where: {
          id_tenantId: { id: period.id, tenantId: user.tenantId },
        },
      });
    });
  }

  listGLAccounts(tenantId: string, query: QueryGLAccountsDto) {
    return this.prisma.gLAccount
      .findMany({
        where: {
          tenantId,
          ...(query.category ? { category: query.category } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.accountGroupId
            ? { accountGroupId: query.accountGroupId }
            : {}),
          ...(query.classificationId
            ? {
                OR: [
                  { classificationId: query.classificationId },
                  {
                    accountGroup: { classificationId: query.classificationId },
                  },
                ],
              }
            : {}),
        },
        include: this.glAccountHierarchyInclude(),
        orderBy: { code: 'asc' },
      })
      .then((accounts) =>
        accounts.map((account) => this.withAccountHierarchy(account)),
      );
  }

  async createGLAccount(user: RequestUser, dto: CreateGLAccountDto) {
    const hierarchy = await this.resolveAccountHierarchyForCreate(
      user.tenantId,
      dto,
    );
    this.assertCodeInCategoryRange(dto.code, hierarchy.category, 'GL account');
    if (hierarchy.bandCode) {
      this.assertCodeWithinBand(dto.code, hierarchy.bandCode, 'GL account');
    }
    await this.assertParentAccount(
      user.tenantId,
      undefined,
      dto.parentAccountId,
      hierarchy.category,
      dto.accountGroupId ?? null,
      hierarchy.classificationId,
      dto.code,
    );
    try {
      const account = await this.prisma.gLAccount.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          category: hierarchy.category,
          normalBalance: hierarchy.normalBalance,
          classificationId: hierarchy.classificationId,
          accountGroupId: dto.accountGroupId,
          parentAccountId: dto.parentAccountId,
          allowPosting: dto.allowPosting ?? true,
          description: this.optional(dto.description),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: this.glAccountHierarchyInclude(),
      });
      await this.recordAudit(
        user,
        'GL_ACCOUNT_CREATE',
        'GLAccount',
        account.id,
        {
          code: account.code,
          classificationId: account.classificationId,
          accountGroupId: account.accountGroupId,
        },
      );
      return this.withAccountHierarchy(account);
    } catch (error) {
      this.rethrowUnique(error, 'GL account code already exists');
    }
  }

  async updateGLAccount(
    user: RequestUser,
    accountId: string,
    dto: UpdateGLAccountDto,
  ) {
    const account = await this.findGLAccount(user.tenantId, accountId);
    const hierarchy = await this.resolveAccountHierarchyForUpdate(
      user.tenantId,
      account,
      dto,
    );
    const nextCategory = hierarchy.category;
    const nextAccountGroupId =
      dto.accountGroupId !== undefined
        ? dto.accountGroupId || null
        : account.accountGroupId;
    const nextCode = dto.code ?? account.code;
    this.assertCodeInCategoryRange(nextCode, nextCategory, 'GL account');
    if (hierarchy.bandCode) {
      this.assertCodeWithinBand(nextCode, hierarchy.bandCode, 'GL account');
    }
    await this.assertParentAccount(
      user.tenantId,
      account.id,
      dto.parentAccountId ?? account.parentAccountId ?? undefined,
      nextCategory,
      nextAccountGroupId,
      hierarchy.classificationId,
      nextCode,
    );
    if (dto.allowPosting === true) {
      const childCount = await this.prisma.gLAccount.count({
        where: { tenantId: user.tenantId, parentAccountId: account.id },
      });
      if (childCount > 0) {
        throw new ConflictException(
          'Summary accounts with child accounts cannot accept postings',
        );
      }
    }

    const changesStructure =
      (dto.code !== undefined && dto.code !== account.code) ||
      (dto.category !== undefined && dto.category !== account.category) ||
      (dto.normalBalance !== undefined &&
        dto.normalBalance !== account.normalBalance) ||
      (dto.accountGroupId !== undefined &&
        (dto.accountGroupId || null) !== account.accountGroupId) ||
      hierarchy.classificationId !== account.classificationId ||
      (dto.parentAccountId !== undefined &&
        dto.parentAccountId !== account.parentAccountId);
    if (changesStructure) {
      const postedUse = await this.prisma.journalLine.count({
        where: {
          tenantId: user.tenantId,
          glAccountId: account.id,
          journalEntry: { status: { in: ['POSTED', 'REVERSED'] } },
        },
      });
      if (postedUse > 0) {
        throw new ConflictException(
          'Posted GL accounts cannot change code, category, normal balance, classification, account group or parent',
        );
      }
    }

    try {
      const updated = await this.prisma.gLAccount.update({
        where: {
          id_tenantId: { id: account.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          category: hierarchy.category,
          normalBalance: hierarchy.normalBalance,
          classificationId: hierarchy.classificationId,
          ...(dto.accountGroupId !== undefined
            ? { accountGroupId: dto.accountGroupId || null }
            : {}),
          ...(dto.parentAccountId !== undefined
            ? { parentAccountId: dto.parentAccountId || null }
            : {}),
          ...(dto.allowPosting !== undefined
            ? { allowPosting: dto.allowPosting }
            : {}),
          ...(dto.description !== undefined
            ? { description: this.optional(dto.description) }
            : {}),
          updatedByUserId: user.id,
        },
        include: this.glAccountHierarchyInclude(),
      });
      if (changesStructure) {
        await this.recordAudit(
          user,
          'GL_ACCOUNT_HIERARCHY_UPDATE',
          'GLAccount',
          updated.id,
          {
            classificationId: updated.classificationId,
            accountGroupId: updated.accountGroupId,
            parentAccountId: updated.parentAccountId,
            category: updated.category,
            normalBalance: updated.normalBalance,
          },
        );
      }
      return this.withAccountHierarchy(updated);
    } catch (error) {
      this.rethrowUnique(error, 'GL account code already exists');
    }
  }

  async listAccountClassifications(
    user: RequestUser,
    query: QueryAccountHierarchyDto,
  ) {
    const tenantId = user.tenantId;
    // Seed the standard hierarchy the first time a tenant has none of it yet — same
    // lazy pattern as listTransactionTypes, checked by isSystemTemplate rather than an
    // empty table, so a tenant that already created their own classifications still
    // gets the standard ones too. Fully editable/deletable afterwards either way.
    const hasSeeded = await this.prisma.accountClassification.findFirst({
      where: { tenantId, isSystemTemplate: true },
      select: { id: true },
    });
    if (!hasSeeded) {
      await this.seedStandardAccountHierarchy(user);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Prisma.AccountClassificationWhereInput = {
      tenantId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy = {
      [query.sortBy ?? 'displayOrder']: query.sortOrder ?? 'asc',
    } as Prisma.AccountClassificationOrderByWithRelationInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.accountClassification.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountClassification.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createAccountClassification(
    user: RequestUser,
    dto: CreateAccountClassificationDto,
  ) {
    this.assertCodeInCategoryRange(
      dto.code,
      dto.category,
      'Account classification',
    );
    try {
      const classification = await this.prisma.accountClassification.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          category: dto.category,
          displayOrder: dto.displayOrder ?? 0,
          isSystemTemplate: dto.isSystemTemplate ?? false,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      await this.recordAudit(
        user,
        'ACCOUNT_CLASSIFICATION_CREATE',
        'AccountClassification',
        classification.id,
        { code: classification.code, category: classification.category },
      );
      return classification;
    } catch (error) {
      this.rethrowUnique(error, 'Account classification code already exists');
    }
  }

  async getAccountClassification(user: RequestUser, classificationId: string) {
    return this.findAccountClassification(user.tenantId, classificationId);
  }

  async updateAccountClassification(
    user: RequestUser,
    classificationId: string,
    dto: UpdateAccountClassificationDto,
  ) {
    const classification = await this.findAccountClassification(
      user.tenantId,
      classificationId,
    );
    if (dto.category && dto.category !== classification.category) {
      const [groupCount, accountCount] = await Promise.all([
        this.prisma.accountGroup.count({
          where: { tenantId: user.tenantId, classificationId },
        }),
        this.prisma.gLAccount.count({
          where: { tenantId: user.tenantId, classificationId },
        }),
      ]);
      if (groupCount + accountCount > 0) {
        throw new ConflictException(
          'Classification category cannot change after groups or accounts are linked',
        );
      }
    }
    this.assertCodeInCategoryRange(
      dto.code ?? classification.code,
      dto.category ?? classification.category,
      'Account classification',
    );
    try {
      const updated = await this.prisma.accountClassification.update({
        where: {
          id_tenantId: { id: classification.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.category ? { category: dto.category } : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
          ...(dto.isSystemTemplate !== undefined
            ? { isSystemTemplate: dto.isSystemTemplate }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedByUserId: user.id,
        },
      });
      await this.recordAudit(
        user,
        'ACCOUNT_CLASSIFICATION_UPDATE',
        'AccountClassification',
        updated.id,
        dto,
      );
      return updated;
    } catch (error) {
      this.rethrowUnique(error, 'Account classification code already exists');
    }
  }

  async activateAccountClassification(
    user: RequestUser,
    classificationId: string,
  ) {
    return this.setAccountClassificationActive(
      user,
      classificationId,
      true,
      'ACCOUNT_CLASSIFICATION_ACTIVATE',
    );
  }

  async deactivateAccountClassification(
    user: RequestUser,
    classificationId: string,
  ) {
    return this.setAccountClassificationActive(
      user,
      classificationId,
      false,
      'ACCOUNT_CLASSIFICATION_DEACTIVATE',
    );
  }

  async listAccountGroups(tenantId: string, query: QueryAccountGroupsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Prisma.AccountGroupWhereInput = {
      tenantId,
      ...(query.classificationId
        ? { classificationId: query.classificationId }
        : {}),
      ...(query.category
        ? { classification: { category: query.category } }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy = {
      [query.sortBy ?? 'displayOrder']: query.sortOrder ?? 'asc',
    } as Prisma.AccountGroupOrderByWithRelationInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.accountGroup.findMany({
        where,
        include: {
          classification: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountGroup.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createAccountGroup(user: RequestUser, dto: CreateAccountGroupDto) {
    const classification = await this.assertActiveClassification(
      user.tenantId,
      dto.classificationId,
    );
    this.assertCodeWithinBand(dto.code, classification.code, 'Account group');
    try {
      const group = await this.prisma.accountGroup.create({
        data: {
          tenantId: user.tenantId,
          classificationId: dto.classificationId,
          code: dto.code,
          name: dto.name,
          displayOrder: dto.displayOrder ?? 0,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: {
          classification: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
      });
      await this.recordAudit(
        user,
        'ACCOUNT_GROUP_CREATE',
        'AccountGroup',
        group.id,
        {
          code: group.code,
          classificationId: group.classificationId,
        },
      );
      return group;
    } catch (error) {
      this.rethrowUnique(error, 'Account group code already exists');
    }
  }

  async getAccountGroup(user: RequestUser, groupId: string) {
    return this.findAccountGroup(user.tenantId, groupId);
  }

  async updateAccountGroup(
    user: RequestUser,
    groupId: string,
    dto: UpdateAccountGroupDto,
  ) {
    const group = await this.findAccountGroup(user.tenantId, groupId);
    let targetClassification = group.classification;
    if (
      dto.classificationId &&
      dto.classificationId !== group.classificationId
    ) {
      targetClassification = await this.assertActiveClassification(
        user.tenantId,
        dto.classificationId,
      );
      const linkedAccounts = await this.prisma.gLAccount.count({
        where: { tenantId: user.tenantId, accountGroupId: group.id },
      });
      if (linkedAccounts > 0) {
        throw new ConflictException(
          'Account group classification cannot change after accounts are linked',
        );
      }
    }
    this.assertCodeWithinBand(
      dto.code ?? group.code,
      targetClassification.code,
      'Account group',
    );
    try {
      const updated = await this.prisma.accountGroup.update({
        where: { id_tenantId: { id: group.id, tenantId: user.tenantId } },
        data: {
          ...(dto.classificationId
            ? { classificationId: dto.classificationId }
            : {}),
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          updatedByUserId: user.id,
        },
        include: {
          classification: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
      });
      await this.recordAudit(
        user,
        'ACCOUNT_GROUP_UPDATE',
        'AccountGroup',
        updated.id,
        dto,
      );
      return updated;
    } catch (error) {
      this.rethrowUnique(error, 'Account group code already exists');
    }
  }

  async activateAccountGroup(user: RequestUser, groupId: string) {
    return this.setAccountGroupActive(
      user,
      groupId,
      true,
      'ACCOUNT_GROUP_ACTIVATE',
    );
  }

  async deactivateAccountGroup(user: RequestUser, groupId: string) {
    return this.setAccountGroupActive(
      user,
      groupId,
      false,
      'ACCOUNT_GROUP_DEACTIVATE',
    );
  }

  async seedStandardAccountHierarchy(user: RequestUser) {
    let classificationsCreated = 0;
    let classificationsSkipped = 0;
    let groupsCreated = 0;
    let groupsSkipped = 0;

    for (const template of STANDARD_ACCOUNT_HIERARCHY) {
      const classificationResult = await this.findOrCreateSeedClassification(
        user,
        template,
      );
      const classification = classificationResult.classification;
      if (classificationResult.created) {
        classificationsCreated += 1;
        await this.recordAudit(
          user,
          'ACCOUNT_CLASSIFICATION_SEED',
          'AccountClassification',
          classification.id,
          { code: classification.code, category: classification.category },
        );
      } else {
        classificationsSkipped += 1;
      }

      for (const groupTemplate of template.groups) {
        const groupResult = await this.findOrCreateSeedGroup(
          user,
          classification.id,
          groupTemplate,
        );
        if (groupResult.created) {
          groupsCreated += 1;
          await this.recordAudit(
            user,
            'ACCOUNT_GROUP_SEED',
            'AccountGroup',
            groupResult.group.id,
            {
              code: groupResult.group.code,
              classificationId: groupResult.group.classificationId,
            },
          );
        } else {
          groupsSkipped += 1;
        }
      }
    }

    return {
      classificationsCreated,
      classificationsSkipped,
      groupsCreated,
      groupsSkipped,
    };
  }

  async listTransactionTypes(user: RequestUser) {
    let transactionTypes = await this.prisma.transactionType.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: 'asc' },
      include: transactionTypeRuleCountInclude,
    });
    // Seed the standard set the first time a tenant has none of them yet —
    // checked by isSystemDefault, not by an empty table, so a tenant that
    // already created their own custom type still gets the defaults too.
    // Fully editable/deletable afterwards, same as any user-created type.
    if (!transactionTypes.some((type) => type.isSystemDefault)) {
      await this.seedStandardTransactionTypes(user);
      transactionTypes = await this.prisma.transactionType.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { name: 'asc' },
        include: transactionTypeRuleCountInclude,
      });
    }
    return transactionTypes.map((type) =>
      this.toTransactionTypeDefinition(type),
    );
  }

  async createTransactionType(
    user: RequestUser,
    dto: CreateTransactionTypeDto,
  ) {
    try {
      const transactionType = await this.prisma.transactionType.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          category: dto.category,
          businessRoles: dto.businessRoles ?? [],
          allowedDocument: this.optional(dto.allowedDocument),
          source: this.optional(dto.source),
          description: this.optional(dto.description),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      await this.recordAudit(
        user,
        'TRANSACTION_TYPE_CREATE',
        'TransactionType',
        transactionType.id,
        { code: transactionType.code, category: transactionType.category },
      );
      return this.toTransactionTypeDefinition(transactionType);
    } catch (error) {
      this.rethrowUnique(error, 'Transaction type code already exists');
    }
  }

  async updateTransactionType(
    user: RequestUser,
    transactionTypeId: string,
    dto: UpdateTransactionTypeDto,
  ) {
    const transactionType = await this.findTransactionType(
      user.tenantId,
      transactionTypeId,
    );
    try {
      const updated = await this.prisma.transactionType.update({
        where: {
          id_tenantId: { id: transactionType.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.category ? { category: dto.category } : {}),
          ...(dto.businessRoles !== undefined
            ? { businessRoles: dto.businessRoles }
            : {}),
          ...(dto.allowedDocument !== undefined
            ? { allowedDocument: this.optional(dto.allowedDocument) }
            : {}),
          ...(dto.source !== undefined
            ? { source: this.optional(dto.source) }
            : {}),
          ...(dto.description !== undefined
            ? { description: this.optional(dto.description) }
            : {}),
          updatedByUserId: user.id,
        },
      });
      await this.recordAudit(
        user,
        'TRANSACTION_TYPE_UPDATE',
        'TransactionType',
        updated.id,
        { code: updated.code, category: updated.category },
      );
      return this.toTransactionTypeDefinition(updated);
    } catch (error) {
      this.rethrowUnique(error, 'Transaction type code already exists');
    }
  }

  async deleteTransactionType(user: RequestUser, transactionTypeId: string) {
    const transactionType = await this.findTransactionType(
      user.tenantId,
      transactionTypeId,
    );
    await this.prisma.transactionType.delete({
      where: {
        id_tenantId: { id: transactionType.id, tenantId: user.tenantId },
      },
    });
    await this.recordAudit(
      user,
      'TRANSACTION_TYPE_DELETE',
      'TransactionType',
      transactionType.id,
      { code: transactionType.code },
    );
  }

  private async findTransactionType(tenantId: string, id: string) {
    const transactionType = await this.prisma.transactionType.findFirst({
      where: { id, tenantId },
    });
    if (!transactionType)
      throw new NotFoundException('Transaction type not found');
    return transactionType;
  }

  private toTransactionTypeDefinition(transactionType: {
    id: string;
    name: string;
    code: string;
    category: TransactionTypeCategory;
    businessRoles: string[];
    allowedDocument: string | null;
    source: string | null;
    description: string | null;
    rule?: { lines: unknown[] } | null;
  }) {
    return {
      id: transactionType.id,
      name: transactionType.name,
      code: transactionType.code,
      category: transactionType.category,
      businessRoles: transactionType.businessRoles,
      allowedDocument: transactionType.allowedDocument,
      source: transactionType.source,
      description: transactionType.description,
      rulesCount: transactionType.rule?.lines.length ?? 0,
    };
  }

  async seedStandardTransactionTypes(user: RequestUser) {
    let created = 0;
    let skipped = 0;

    for (const template of STANDARD_TRANSACTION_TYPES) {
      const result = await this.findOrCreateSeedTransactionType(user, template);
      if (result.created) {
        created += 1;
        await this.recordAudit(
          user,
          'TRANSACTION_TYPE_SEED',
          'TransactionType',
          result.transactionType.id,
          {
            code: result.transactionType.code,
            category: result.transactionType.category,
          },
        );
      } else {
        skipped += 1;
      }
    }

    return { created, skipped };
  }

  private async findOrCreateSeedTransactionType(
    user: RequestUser,
    template: (typeof STANDARD_TRANSACTION_TYPES)[number],
  ) {
    const existing = await this.prisma.transactionType.findUnique({
      where: {
        tenantId_code: { tenantId: user.tenantId, code: template.code },
      },
    });
    if (existing) return { transactionType: existing, created: false };

    try {
      const transactionType = await this.prisma.transactionType.create({
        data: {
          tenantId: user.tenantId,
          code: template.code,
          name: template.name,
          category: template.category,
          description: template.description,
          isSystemDefault: true,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      return { transactionType, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const transactionType =
          await this.prisma.transactionType.findUniqueOrThrow({
            where: {
              tenantId_code: { tenantId: user.tenantId, code: template.code },
            },
          });
        return { transactionType, created: false };
      }
      throw error;
    }
  }

  private async setAccountClassificationActive(
    user: RequestUser,
    classificationId: string,
    isActive: boolean,
    action: string,
  ) {
    const classification = await this.findAccountClassification(
      user.tenantId,
      classificationId,
    );
    const updated = await this.prisma.accountClassification.update({
      where: {
        id_tenantId: { id: classification.id, tenantId: user.tenantId },
      },
      data: { isActive, updatedByUserId: user.id },
    });
    await this.recordAudit(user, action, 'AccountClassification', updated.id, {
      isActive,
    });
    return updated;
  }

  private async setAccountGroupActive(
    user: RequestUser,
    groupId: string,
    isActive: boolean,
    action: string,
  ) {
    const group = await this.findAccountGroup(user.tenantId, groupId);
    const updated = await this.prisma.accountGroup.update({
      where: { id_tenantId: { id: group.id, tenantId: user.tenantId } },
      data: { isActive, updatedByUserId: user.id },
      include: {
        classification: {
          select: { id: true, code: true, name: true, category: true },
        },
      },
    });
    await this.recordAudit(user, action, 'AccountGroup', updated.id, {
      isActive,
    });
    return updated;
  }

  private async findOrCreateSeedClassification(
    user: RequestUser,
    template: (typeof STANDARD_ACCOUNT_HIERARCHY)[number],
  ) {
    const existing = await this.prisma.accountClassification.findUnique({
      where: {
        tenantId_code: { tenantId: user.tenantId, code: template.code },
      },
    });
    if (existing) return { classification: existing, created: false };

    try {
      const classification = await this.prisma.accountClassification.create({
        data: {
          tenantId: user.tenantId,
          code: template.code,
          name: template.name,
          category: template.category,
          displayOrder: template.displayOrder,
          isSystemTemplate: true,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      return { classification, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const classification =
          await this.prisma.accountClassification.findUniqueOrThrow({
            where: {
              tenantId_code: {
                tenantId: user.tenantId,
                code: template.code,
              },
            },
          });
        return { classification, created: false };
      }
      throw error;
    }
  }

  private async findOrCreateSeedGroup(
    user: RequestUser,
    classificationId: string,
    groupTemplate: (typeof STANDARD_ACCOUNT_HIERARCHY)[number]['groups'][number],
  ) {
    const existing = await this.prisma.accountGroup.findUnique({
      where: {
        tenantId_code: { tenantId: user.tenantId, code: groupTemplate.code },
      },
    });
    if (existing) return { group: existing, created: false };

    try {
      const group = await this.prisma.accountGroup.create({
        data: {
          tenantId: user.tenantId,
          classificationId,
          code: groupTemplate.code,
          name: groupTemplate.name,
          displayOrder: groupTemplate.displayOrder,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      return { group, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const group = await this.prisma.accountGroup.findUniqueOrThrow({
          where: {
            tenantId_code: {
              tenantId: user.tenantId,
              code: groupTemplate.code,
            },
          },
        });
        return { group, created: false };
      }
      throw error;
    }
  }

  async deactivateGLAccount(user: RequestUser, accountId: string) {
    const account = await this.findGLAccount(user.tenantId, accountId);
    const activeChildren = await this.prisma.gLAccount.count({
      where: {
        tenantId: user.tenantId,
        parentAccountId: account.id,
        status: RecordStatus.ACTIVE,
      },
    });
    if (activeChildren > 0) {
      throw new ConflictException(
        'Deactivate child accounts before deactivating this account',
      );
    }
    const updated = await this.prisma.gLAccount.update({
      where: {
        id_tenantId: { id: account.id, tenantId: user.tenantId },
      },
      data: {
        status: RecordStatus.INACTIVE,
        allowPosting: false,
        updatedByUserId: user.id,
      },
    });
    await this.recordAudit(
      user,
      'GL_ACCOUNT_DEACTIVATE',
      'GLAccount',
      updated.id,
      { status: updated.status, allowPosting: updated.allowPosting },
    );
    return updated;
  }

  listCostCentres(tenantId: string) {
    return this.prisma.costCentre.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
  }

  async createCostCentre(user: RequestUser, dto: CreateCostCentreDto) {
    try {
      return await this.prisma.costCentre.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          description: this.optional(dto.description),
          externalRef: this.optional(dto.externalRef),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Cost centre code already exists');
    }
  }

  async updateCostCentre(
    user: RequestUser,
    costCentreId: string,
    dto: UpdateCostCentreDto,
  ) {
    const costCentre = await this.findCostCentre(user.tenantId, costCentreId);
    try {
      return await this.prisma.costCentre.update({
        where: {
          id_tenantId: { id: costCentre.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.description !== undefined
            ? { description: this.optional(dto.description) }
            : {}),
          ...(dto.externalRef !== undefined
            ? { externalRef: this.optional(dto.externalRef) }
            : {}),
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Cost centre code already exists');
    }
  }

  async deactivateCostCentre(user: RequestUser, costCentreId: string) {
    const costCentre = await this.findCostCentre(user.tenantId, costCentreId);
    return this.prisma.costCentre.update({
      where: {
        id_tenantId: { id: costCentre.id, tenantId: user.tenantId },
      },
      data: { status: RecordStatus.INACTIVE, updatedByUserId: user.id },
    });
  }

  async listSubledgerAccounts(
    tenantId: string,
    query: QuerySubledgerAccountsDto = {},
  ) {
    const items = await this.prisma.subledgerAccount.findMany({
      where: {
        tenantId,
        ...(query.type ? { type: query.type } : {}),
        ...(query.externalRef ? { externalRef: query.externalRef } : {}),
        ...(query.controlAccountId
          ? { controlAccountId: query.controlAccountId }
          : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        controlAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            normalBalance: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });
    const balances = await this.calculateSubledgerBalances(
      tenantId,
      items.map((item) => item.id),
    );
    return items.map((item) => ({
      ...item,
      balance: balances.get(item.id) ?? this.emptyBalance(),
    }));
  }

  async getSubledgerAccount(tenantId: string, subledgerId: string) {
    const item = await this.prisma.subledgerAccount.findFirst({
      where: { id: subledgerId, tenantId },
      include: {
        controlAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            normalBalance: true,
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Subledger account not found');
    const balances = await this.calculateSubledgerBalances(tenantId, [item.id]);
    return { ...item, balance: balances.get(item.id) ?? this.emptyBalance() };
  }

  async createSubledgerAccount(
    user: RequestUser,
    dto: CreateSubledgerAccountDto,
  ) {
    await this.assertEntityType(user.tenantId, dto.type);
    if (dto.controlAccountId) {
      await this.assertControlAccount(user.tenantId, dto.controlAccountId);
    }
    if (dto.currency) {
      await this.assertActiveCurrency(user.tenantId, dto.currency);
    }
    try {
      return await this.prisma.subledgerAccount.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          type: dto.type,
          externalRef: this.optional(dto.externalRef),
          controlAccountId: dto.controlAccountId,
          currency: dto.currency,
          contactName: this.optional(dto.contactName),
          address: this.optional(dto.address),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Subledger account already exists');
    }
  }

  /** `type` is validated against the tenant's own Entity Types list (Settings > Entities >
   *  Types), not a fixed enum — any type a tenant creates there works here. Entities carry
   *  no control account by default: which GL account a document affects is decided by the
   *  Transaction Type Rule used to create it, not by anything fixed on the entity. */
  private async assertEntityType(tenantId: string, type: string) {
    const entityType = await this.prisma.entityType.findFirst({
      where: { tenantId, name: { equals: type, mode: 'insensitive' } },
    });
    if (!entityType) {
      throw new BadRequestException(
        `"${type}" is not a configured Entity Type — create it first under Entities > Types`,
      );
    }
    return entityType;
  }

  async updateSubledgerAccount(
    user: RequestUser,
    subledgerId: string,
    dto: UpdateSubledgerAccountDto,
  ) {
    const subledger = await this.findSubledger(user.tenantId, subledgerId);
    if (dto.controlAccountId) {
      await this.assertControlAccount(user.tenantId, dto.controlAccountId);
    }
    if (dto.currency) {
      await this.assertActiveCurrency(user.tenantId, dto.currency);
    }
    try {
      return await this.prisma.subledgerAccount.update({
        where: {
          id_tenantId: { id: subledger.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.type ? { type: dto.type } : {}),
          ...(dto.externalRef !== undefined
            ? { externalRef: this.optional(dto.externalRef) }
            : {}),
          ...(dto.controlAccountId
            ? { controlAccountId: dto.controlAccountId }
            : {}),
          ...(dto.currency !== undefined
            ? { currency: dto.currency || null }
            : {}),
          ...(dto.contactName !== undefined
            ? { contactName: this.optional(dto.contactName) }
            : {}),
          ...(dto.address !== undefined
            ? { address: this.optional(dto.address) }
            : {}),
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Subledger account already exists');
    }
  }

  async deactivateSubledgerAccount(user: RequestUser, subledgerId: string) {
    const subledger = await this.findSubledger(user.tenantId, subledgerId);
    return this.prisma.subledgerAccount.update({
      where: {
        id_tenantId: { id: subledger.id, tenantId: user.tenantId },
      },
      data: { status: RecordStatus.INACTIVE, updatedByUserId: user.id },
    });
  }

  async activateSubledgerAccount(user: RequestUser, subledgerId: string) {
    const subledger = await this.findSubledger(user.tenantId, subledgerId);
    return this.prisma.subledgerAccount.update({
      where: {
        id_tenantId: { id: subledger.id, tenantId: user.tenantId },
      },
      data: { status: RecordStatus.ACTIVE, updatedByUserId: user.id },
    });
  }

  /** Called by other services (e.g. Reinsurance) to get-or-create a subledger for one of
   *  their own counterparties. `dto.type` is not a fixed value — it must name an Entity
   *  Type the tenant has already created (Settings > Entities > Types), exactly like a
   *  human creating an entity manually. Accounting has no built-in knowledge of what a
   *  "Cedant" or "Reinsurer" is; it only knows Entity Types. No control account is
   *  resolved or required — which GL account eventually gets affected is decided entirely
   *  by whichever Transaction Type Rule is used when a document is created for this entity. */
  async ensureInternalInsuranceSubledger(
    callingService: string,
    dto: EnsureInternalSubledgerDto,
  ) {
    const externalRef = this.requiredExternalRef(dto.externalRef);
    const name = this.requiredName(dto.name);
    await this.assertEntityType(dto.tenantId, dto.type);

    const existing = await this.prisma.subledgerAccount.findFirst({
      where: { tenantId: dto.tenantId, type: dto.type, externalRef },
    });

    if (existing) {
      if (existing.status !== RecordStatus.ACTIVE) {
        throw new ConflictException(
          `${dto.type} subledger is inactive and must be reactivated in Accounting before source-module posting can use it`,
        );
      }
      if (
        dto.currency &&
        existing.currency &&
        existing.currency !== dto.currency
      ) {
        throw new ConflictException(
          `${dto.type} subledger currency does not match the source counterparty currency`,
        );
      }
      return this.prisma.subledgerAccount.update({
        where: {
          id_tenantId: { id: existing.id, tenantId: dto.tenantId },
        },
        data: {
          name,
          ...(dto.currency && !existing.currency
            ? { currency: dto.currency }
            : {}),
          updatedByUserId: this.internalActor(callingService),
        },
      });
    }

    if (dto.currency) {
      await this.assertActiveCurrency(dto.tenantId, dto.currency);
    }

    try {
      return await this.prisma.subledgerAccount.create({
        data: {
          tenantId: dto.tenantId,
          code: this.integrationSubledgerCode(dto.type, externalRef),
          name,
          type: dto.type,
          externalRef,
          currency: dto.currency,
          createdByUserId: this.internalActor(callingService),
          updatedByUserId: this.internalActor(callingService),
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Subledger account already exists');
    }
  }

  async findFiscalPeriod(tenantId: string, id: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id, tenantId },
    });
    if (!period) throw new NotFoundException('Fiscal period not found');
    return period;
  }

  async findGLAccount(tenantId: string, id: string) {
    const account = await this.prisma.gLAccount.findFirst({
      where: { id, tenantId },
    });
    if (!account) throw new NotFoundException('GL account not found');
    return account;
  }

  private glAccountHierarchyInclude() {
    return {
      parentAccount: { select: { id: true, code: true, name: true } },
      classification: {
        select: { id: true, code: true, name: true, category: true },
      },
      accountGroup: {
        select: {
          id: true,
          code: true,
          name: true,
          classification: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
      },
    } as const;
  }

  private withAccountHierarchy<
    T extends {
      category: GLAccountCategory;
      classification?: {
        id: string;
        code: string;
        name: string;
        category: GLAccountCategory;
      } | null;
      accountGroup?: {
        id: string;
        code: string;
        name: string;
        classification: {
          id: string;
          code: string;
          name: string;
          category: GLAccountCategory;
        };
      } | null;
    },
  >(account: T) {
    // The account's own classification wins; grouped accounts fall back to their group's.
    const classification =
      account.classification ?? account.accountGroup?.classification ?? null;
    const accountGroup = account.accountGroup
      ? {
          id: account.accountGroup.id,
          code: account.accountGroup.code,
          name: account.accountGroup.name,
        }
      : null;
    const unclassified = {
      id: null,
      code: 'UNCLASSIFIED',
      name: 'Unclassified',
      category: account.category,
    };
    return {
      ...account,
      classification: classification ?? unclassified,
      accountGroup,
      hierarchyPath: [
        account.category,
        classification?.name ?? 'Unclassified',
        accountGroup?.name,
        'name' in account ? account.name : undefined,
      ].filter(Boolean),
      // No classification at all — an account with a classification but no group is fine.
      isLegacyUnclassified: !classification,
    };
  }

  private async findAccountClassification(tenantId: string, id: string) {
    const classification = await this.prisma.accountClassification.findFirst({
      where: { id, tenantId },
    });
    if (!classification) {
      throw new NotFoundException('Account classification not found');
    }
    return classification;
  }

  private async findAccountGroup(tenantId: string, id: string) {
    const group = await this.prisma.accountGroup.findFirst({
      where: { id, tenantId },
      include: {
        classification: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            isActive: true,
          },
        },
      },
    });
    if (!group) throw new NotFoundException('Account group not found');
    return group;
  }

  private async assertActiveClassification(
    tenantId: string,
    classificationId: string,
  ) {
    const classification = await this.findAccountClassification(
      tenantId,
      classificationId,
    );
    if (!classification.isActive) {
      throw new BadRequestException('Account classification must be active');
    }
    return classification;
  }

  private async assertActiveAccountGroup(tenantId: string, groupId: string) {
    const group = await this.findAccountGroup(tenantId, groupId);
    if (!group.isActive) {
      throw new BadRequestException('Account group must be active');
    }
    if (!group.classification.isActive) {
      throw new BadRequestException(
        'Account group classification must be active',
      );
    }
    return group;
  }

  /** Category and normal balance for an account placed directly under a classification. */
  private classificationHierarchy(
    classification: {
      id: string;
      code: string;
      category: GLAccountCategory;
    },
    dto: { category?: GLAccountCategory; normalBalance?: NormalBalance },
  ) {
    const category = classification.category;
    const normalBalance = NORMAL_BALANCE_BY_CATEGORY[category];
    if (dto.category && dto.category !== category) {
      throw new BadRequestException(
        'GL account category must match the selected classification',
      );
    }
    if (dto.normalBalance && dto.normalBalance !== normalBalance) {
      throw new BadRequestException(
        'GL account normal balance must match the selected classification category',
      );
    }
    return {
      category,
      normalBalance,
      bandCode: classification.code as string | null,
      classificationId: classification.id as string | null,
    };
  }

  private async resolveAccountHierarchyForCreate(
    tenantId: string,
    dto: CreateGLAccountDto,
  ) {
    if (dto.accountGroupId) {
      const group = await this.assertActiveAccountGroup(
        tenantId,
        dto.accountGroupId,
      );
      if (
        dto.classificationId &&
        dto.classificationId !== group.classificationId
      ) {
        throw new BadRequestException(
          'The selected account group does not belong to the selected classification',
        );
      }
      const category = group.classification.category;
      const normalBalance = NORMAL_BALANCE_BY_CATEGORY[category];
      if (dto.category && dto.category !== category) {
        throw new BadRequestException(
          'GL account category must match the selected account group classification',
        );
      }
      if (dto.normalBalance && dto.normalBalance !== normalBalance) {
        throw new BadRequestException(
          'GL account normal balance must match the selected account group category',
        );
      }
      return {
        category,
        normalBalance,
        bandCode: group.code as string | null,
        classificationId: group.classificationId as string | null,
      };
    }

    // No group: the account sits directly under a classification.
    if (dto.classificationId) {
      const classification = await this.assertActiveClassification(
        tenantId,
        dto.classificationId,
      );
      return this.classificationHierarchy(classification, dto);
    }

    if (!dto.category) {
      throw new BadRequestException(
        'GL account category is required when neither accountGroupId nor classificationId is provided',
      );
    }
    const normalBalance = NORMAL_BALANCE_BY_CATEGORY[dto.category];
    if (dto.normalBalance && dto.normalBalance !== normalBalance) {
      throw new BadRequestException(
        'GL account normal balance must match the account category',
      );
    }
    return {
      category: dto.category,
      normalBalance,
      bandCode: null as string | null,
      classificationId: null as string | null,
    };
  }

  private async resolveAccountHierarchyForUpdate(
    tenantId: string,
    account: {
      category: GLAccountCategory;
      normalBalance: NormalBalance;
      classificationId: string | null;
      accountGroupId: string | null;
    },
    dto: UpdateGLAccountDto,
  ) {
    if (dto.accountGroupId !== undefined && dto.accountGroupId) {
      const group = await this.assertActiveAccountGroup(
        tenantId,
        dto.accountGroupId,
      );
      if (
        dto.classificationId &&
        dto.classificationId !== group.classificationId
      ) {
        throw new BadRequestException(
          'The selected account group does not belong to the selected classification',
        );
      }
      const category = group.classification.category;
      const normalBalance = NORMAL_BALANCE_BY_CATEGORY[category];
      if (dto.category && dto.category !== category) {
        throw new BadRequestException(
          'GL account category must match the selected account group classification',
        );
      }
      if (dto.normalBalance && dto.normalBalance !== normalBalance) {
        throw new BadRequestException(
          'GL account normal balance must match the selected account group category',
        );
      }
      return {
        category,
        normalBalance,
        bandCode: group.code as string | null,
        classificationId: group.classificationId as string | null,
      };
    }

    if (account.accountGroupId && dto.accountGroupId === undefined) {
      if (dto.category && dto.category !== account.category) {
        throw new BadRequestException(
          'Clear accountGroupId before overriding a grouped GL account category',
        );
      }
      if (dto.normalBalance && dto.normalBalance !== account.normalBalance) {
        throw new BadRequestException(
          'Clear accountGroupId before overriding a grouped GL account normal balance',
        );
      }
      const group = await this.findAccountGroup(
        tenantId,
        account.accountGroupId,
      );
      if (
        dto.classificationId &&
        dto.classificationId !== group.classificationId
      ) {
        throw new BadRequestException(
          'Change or clear the account group to move the account to another classification',
        );
      }
      return {
        category: account.category,
        normalBalance: account.normalBalance,
        bandCode: group.code as string | null,
        classificationId: group.classificationId as string | null,
      };
    }

    // The account has no group (or its group is being cleared): it stays under the requested
    // classification, or the one it already has.
    if (dto.classificationId) {
      const classification = await this.assertActiveClassification(
        tenantId,
        dto.classificationId,
      );
      return this.classificationHierarchy(classification, dto);
    }
    const currentClassificationId = account.classificationId;
    if (currentClassificationId) {
      const classification = await this.findAccountClassification(
        tenantId,
        currentClassificationId,
      );
      return this.classificationHierarchy(classification, dto);
    }

    const category = dto.category ?? account.category;
    const normalBalance = NORMAL_BALANCE_BY_CATEGORY[category];
    if (dto.normalBalance && dto.normalBalance !== normalBalance) {
      throw new BadRequestException(
        'GL account normal balance must match the account category',
      );
    }
    return {
      category,
      normalBalance,
      bandCode: null as string | null,
      classificationId: null as string | null,
    };
  }

  /** Parses a chart-of-accounts code as a positive whole number, e.g. "1100" -> 1100. */
  private parseAccountCode(code: string, label: string): number {
    if (!/^\d+$/.test(code)) {
      throw new BadRequestException(`${label} code must be numeric`);
    }
    return Number(code);
  }

  private assertCodeInCategoryRange(
    code: string,
    category: GLAccountCategory,
    label: string,
  ) {
    const range = CATEGORY_CODE_RANGES[category];
    const numeric = this.parseAccountCode(code, label);
    if (numeric < range.min || numeric > range.max) {
      throw new BadRequestException(
        `${label} code must be between ${range.min} and ${range.max} for ${category} accounts`,
      );
    }
  }

  /**
   * The numbering block a code reserves for its children, derived from its trailing
   * zeros (1100 -> 1100-1199, 1110 -> 1110-1119) rather than a hardcoded depth, so it
   * keeps working as the hierarchy gets deeper.
   */
  private codeBand(
    code: string,
    label: string,
  ): { start: number; end: number } {
    const numeric = this.parseAccountCode(code, label);
    let width = 1;
    while (width < 1000 && numeric % (width * 10) === 0) width *= 10;
    return { start: numeric, end: numeric + width - 1 };
  }

  private assertCodeWithinBand(
    code: string,
    parentCode: string,
    label: string,
  ) {
    const numeric = this.parseAccountCode(code, label);
    const band = this.codeBand(parentCode, label);
    if (numeric < band.start || numeric > band.end) {
      throw new BadRequestException(
        `${label} code must be between ${band.start} and ${band.end} to stay within parent code ${parentCode}`,
      );
    }
  }

  private async recordAudit(
    user: RequestUser,
    action: string,
    entityType: string,
    entityId: string,
    changedFields?: unknown,
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

  private async findCurrency(tenantId: string, id: string) {
    const currency = await this.prisma.accountingCurrency.findFirst({
      where: { id, tenantId },
    });
    if (!currency) throw new NotFoundException('Accounting currency not found');
    return currency;
  }

  private async findCostCentre(tenantId: string, id: string) {
    const costCentre = await this.prisma.costCentre.findFirst({
      where: { id, tenantId },
    });
    if (!costCentre) throw new NotFoundException('Cost centre not found');
    return costCentre;
  }

  private async findSubledger(tenantId: string, id: string) {
    const subledger = await this.prisma.subledgerAccount.findFirst({
      where: { id, tenantId },
    });
    if (!subledger) throw new NotFoundException('Subledger account not found');
    return subledger;
  }

  private async assertActiveCurrency(tenantId: string, code: string) {
    const currency = await this.prisma.accountingCurrency.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!currency || !currency.isActive) {
      throw new BadRequestException(
        `Active accounting currency ${code} not found`,
      );
    }
    return currency;
  }

  private async assertParentAccount(
    tenantId: string,
    accountId: string | undefined,
    parentAccountId: string | undefined,
    category: GLAccountCategory,
    accountGroupId: string | null,
    classificationId: string | null,
    code: string,
  ) {
    if (!parentAccountId) return;
    if (accountId === parentAccountId) {
      throw new BadRequestException('A GL account cannot be its own parent');
    }
    const parent = await this.prisma.gLAccount.findFirst({
      where: { id: parentAccountId, tenantId },
    });
    if (!parent) throw new NotFoundException('Parent GL account not found');
    if (parent.status !== RecordStatus.ACTIVE) {
      throw new BadRequestException('Parent GL account must be active');
    }
    if (parent.category !== category) {
      throw new BadRequestException(
        'Parent and child GL accounts must use the same category',
      );
    }
    if ((parent.accountGroupId ?? null) !== accountGroupId) {
      throw new BadRequestException(
        'Parent and child GL accounts must use the same account group',
      );
    }
    if ((parent.classificationId ?? null) !== classificationId) {
      throw new BadRequestException(
        'Parent and child GL accounts must use the same classification',
      );
    }
    this.assertCodeWithinBand(code, parent.code, 'GL account');
    let ancestorId = parent.parentAccountId;
    while (ancestorId) {
      if (ancestorId === accountId) {
        throw new BadRequestException(
          'GL account hierarchy cannot contain cycles',
        );
      }
      const ancestor = await this.prisma.gLAccount.findFirst({
        where: { id: ancestorId, tenantId },
        select: { parentAccountId: true },
      });
      ancestorId = ancestor?.parentAccountId ?? null;
    }
  }

  private async assertControlAccount(
    tenantId: string,
    accountId: string,
    category?: GLAccountCategory,
    label = 'Subledger control account',
  ) {
    const account = await this.prisma.gLAccount.findFirst({
      where: {
        id: accountId,
        tenantId,
        status: RecordStatus.ACTIVE,
        allowPosting: true,
      },
    });
    if (!account) {
      throw new BadRequestException(
        `${label} must be active and posting-enabled`,
      );
    }
    if (category && account.category !== category) {
      throw new BadRequestException(`${label} must be a ${category} account`);
    }
    const childCount = await this.prisma.gLAccount.count({
      where: { tenantId, parentAccountId: account.id },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        `Summary accounts cannot be used as ${label.toLowerCase()}`,
      );
    }
    return account;
  }

  private async assertPostingAccount(
    tenantId: string,
    accountId: string,
    category: GLAccountCategory,
    label: string,
  ) {
    const account = await this.prisma.gLAccount.findFirst({
      where: {
        id: accountId,
        tenantId,
        status: RecordStatus.ACTIVE,
        allowPosting: true,
      },
    });
    if (!account) {
      throw new BadRequestException(
        `${label} must be active and posting-enabled`,
      );
    }
    if (account.category !== category) {
      throw new BadRequestException(`${label} must be a ${category} account`);
    }
    return account;
  }

  /**
   * Each entity's outstanding balance, from every posted journal line that carries it as its
   * subledger — so it does not depend on the entity having a control account of its own (the
   * control account now comes from the transaction type's rule at posting time). The sign
   * follows the account each line hits: a debit-normal account (receivables) counts debits
   * minus credits, so a positive balance is what a customer owes; a credit-normal one
   * (payables) counts credits minus debits, so a positive balance is what is owed to a
   * vendor. Base amounts are in the tenant's base currency, and reversed journals stay in so
   * their reversals net them out. Entities with no postings get no entry.
   */
  private async calculateSubledgerBalances(
    tenantId: string,
    subledgerIds: string[],
  ) {
    const balances = new Map<string, ReturnType<typeof this.emptyBalance>>();
    if (subledgerIds.length === 0) return balances;

    const lines = await this.prisma.journalLine.findMany({
      where: {
        tenantId,
        subledgerAccountId: { in: subledgerIds },
        journalEntry: {
          status: { in: [JournalStatus.POSTED, JournalStatus.REVERSED] },
        },
      },
      select: {
        subledgerAccountId: true,
        transactionDebit: true,
        transactionCredit: true,
        baseDebit: true,
        baseCredit: true,
        glAccount: { select: { normalBalance: true } },
        journalEntry: { select: { transactionCurrency: true } },
      },
    });

    const totals = new Map<
      string,
      {
        baseDebit: Prisma.Decimal;
        baseCredit: Prisma.Decimal;
        baseBalance: Prisma.Decimal;
        transactionDebit: Prisma.Decimal;
        transactionCredit: Prisma.Decimal;
        transactionBalance: Prisma.Decimal;
        currencies: Set<string>;
      }
    >();
    for (const line of lines) {
      if (!line.subledgerAccountId) continue;
      const current = totals.get(line.subledgerAccountId) ?? {
        baseDebit: new Prisma.Decimal(0),
        baseCredit: new Prisma.Decimal(0),
        baseBalance: new Prisma.Decimal(0),
        transactionDebit: new Prisma.Decimal(0),
        transactionCredit: new Prisma.Decimal(0),
        transactionBalance: new Prisma.Decimal(0),
        currencies: new Set<string>(),
      };
      const debitNormal = line.glAccount.normalBalance === NormalBalance.DEBIT;
      const base = line.baseDebit.minus(line.baseCredit);
      const transaction = line.transactionDebit.minus(line.transactionCredit);
      current.baseDebit = current.baseDebit.plus(line.baseDebit);
      current.baseCredit = current.baseCredit.plus(line.baseCredit);
      current.baseBalance = current.baseBalance.plus(
        debitNormal ? base : base.negated(),
      );
      current.transactionDebit = current.transactionDebit.plus(
        line.transactionDebit,
      );
      current.transactionCredit = current.transactionCredit.plus(
        line.transactionCredit,
      );
      current.transactionBalance = current.transactionBalance.plus(
        debitNormal ? transaction : transaction.negated(),
      );
      current.currencies.add(line.journalEntry.transactionCurrency);
      totals.set(line.subledgerAccountId, current);
    }

    for (const [subledgerId, t] of totals) {
      balances.set(subledgerId, {
        baseDebit: t.baseDebit.toNumber(),
        baseCredit: t.baseCredit.toNumber(),
        baseBalance: t.baseBalance.toNumber(),
        transactionDebit: t.transactionDebit.toNumber(),
        transactionCredit: t.transactionCredit.toNumber(),
        transactionBalance: t.transactionBalance.toNumber(),
        transactionCurrencies: Array.from(t.currencies).sort(),
      });
    }
    return balances;
  }

  private emptyBalance() {
    return {
      baseDebit: 0,
      baseCredit: 0,
      baseBalance: 0,
      transactionDebit: 0,
      transactionCredit: 0,
      transactionBalance: 0,
      transactionCurrencies: [] as string[],
    };
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

  private optional(value: string | undefined): string | null | undefined {
    if (value === undefined) return undefined;
    return value.trim() || null;
  }

  private integrationSubledgerCode(type: string, externalRef: string): string {
    // Derived from the type name itself rather than a fixed set — "Cedant" and
    // "Reinsurer" still produce the same CED/REI prefixes they always did.
    const prefix = type.trim().toUpperCase().slice(0, 3) || 'SUB';
    const digest = createHash('sha1').update(externalRef).digest('hex');
    return `${prefix}-${digest.slice(0, 12).toUpperCase()}`;
  }

  private internalActor(callingService: string): string {
    return `service:${callingService.slice(0, 80)}`;
  }

  private requiredExternalRef(value: string): string {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      throw new BadRequestException('externalRef is required');
    }
    return trimmedValue;
  }

  private requiredName(value: string): string {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      throw new BadRequestException('name is required');
    }
    return trimmedValue;
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
