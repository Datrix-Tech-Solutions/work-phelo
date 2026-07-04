import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  FiscalPeriodStatus,
  GLAccountCategory,
  Prisma,
  RecordStatus,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAccountingCurrencyDto,
  CreateCostCentreDto,
  CreateExchangeRateDto,
  CreateFiscalPeriodDto,
  CreateGLAccountDto,
  CreateSubledgerAccountDto,
  QueryFiscalPeriodsDto,
  QueryGLAccountsDto,
  UpdateAccountingCurrencyDto,
  UpdateAccountingTenantConfigDto,
  UpdateCostCentreDto,
  UpdateExchangeRateDto,
  UpdateGLAccountDto,
  UpdateSubledgerAccountDto,
} from './dto/accounting.dto';

@Injectable()
export class AccountingMasterDataService {
  constructor(private readonly prisma: PrismaService) {}

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
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate > endDate) {
      throw new BadRequestException(
        'Fiscal period endDate must follow startDate',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
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

      try {
        return await tx.fiscalPeriod.create({
          data: {
            tenantId: user.tenantId,
            name: dto.name,
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

      const requiredCurrentStatus =
        nextStatus === FiscalPeriodStatus.OPEN
          ? FiscalPeriodStatus.CLOSED
          : nextStatus === FiscalPeriodStatus.CLOSED
            ? FiscalPeriodStatus.OPEN
            : FiscalPeriodStatus.CLOSED;
      if (period.status !== requiredCurrentStatus) {
        const message =
          nextStatus === FiscalPeriodStatus.OPEN
            ? 'Only a closed fiscal period can be reopened'
            : nextStatus === FiscalPeriodStatus.CLOSED
              ? 'Only an open fiscal period can be closed'
              : 'Only a closed fiscal period can be locked';
        throw new BadRequestException(message);
      }

      const changed = await tx.fiscalPeriod.updateMany({
        where: {
          id: period.id,
          tenantId: user.tenantId,
          status: requiredCurrentStatus,
        },
        data: {
          status: nextStatus,
          ...(nextStatus === FiscalPeriodStatus.OPEN
            ? {
                closedAt: null,
                closedByUserId: null,
              }
            : {}),
          ...(nextStatus === FiscalPeriodStatus.CLOSED
            ? {
                closedAt: new Date(),
                closedByUserId: user.id,
              }
            : {}),
          ...(nextStatus === FiscalPeriodStatus.LOCKED
            ? {
                lockedAt: new Date(),
                lockedByUserId: user.id,
              }
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
    return this.prisma.gLAccount.findMany({
      where: {
        tenantId,
        ...(query.category ? { category: query.category } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        parentAccount: { select: { id: true, code: true, name: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createGLAccount(user: RequestUser, dto: CreateGLAccountDto) {
    await this.assertParentAccount(
      user.tenantId,
      undefined,
      dto.parentAccountId,
      dto.category,
    );
    try {
      return await this.prisma.gLAccount.create({
        data: {
          tenantId: user.tenantId,
          code: dto.code,
          name: dto.name,
          category: dto.category,
          normalBalance: dto.normalBalance,
          parentAccountId: dto.parentAccountId,
          allowPosting: dto.allowPosting ?? true,
          description: this.optional(dto.description),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
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
    const nextCategory = dto.category ?? account.category;
    await this.assertParentAccount(
      user.tenantId,
      account.id,
      dto.parentAccountId ?? account.parentAccountId ?? undefined,
      nextCategory,
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
          'Posted GL accounts cannot change code, category, normal balance or parent',
        );
      }
    }

    try {
      return await this.prisma.gLAccount.update({
        where: {
          id_tenantId: { id: account.id, tenantId: user.tenantId },
        },
        data: {
          ...(dto.code ? { code: dto.code } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.category ? { category: dto.category } : {}),
          ...(dto.normalBalance ? { normalBalance: dto.normalBalance } : {}),
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
      });
    } catch (error) {
      this.rethrowUnique(error, 'GL account code already exists');
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
    return this.prisma.gLAccount.update({
      where: {
        id_tenantId: { id: account.id, tenantId: user.tenantId },
      },
      data: {
        status: RecordStatus.INACTIVE,
        allowPosting: false,
        updatedByUserId: user.id,
      },
    });
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

  listSubledgerAccounts(tenantId: string) {
    return this.prisma.subledgerAccount.findMany({
      where: { tenantId },
      include: {
        controlAccount: { select: { id: true, code: true, name: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createSubledgerAccount(
    user: RequestUser,
    dto: CreateSubledgerAccountDto,
  ) {
    await this.assertControlAccount(user.tenantId, dto.controlAccountId);
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
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Subledger account already exists');
    }
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

  private async assertControlAccount(tenantId: string, accountId: string) {
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
        'Subledger control account must be active and posting-enabled',
      );
    }
    const childCount = await this.prisma.gLAccount.count({
      where: { tenantId, parentAccountId: account.id },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        'Summary accounts cannot be used as subledger control accounts',
      );
    }
  }

  private async lockFiscalPeriod(
    tx: Prisma.TransactionClient,
    tenantId: string,
    periodId: string,
  ) {
    await tx.$queryRaw`
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
