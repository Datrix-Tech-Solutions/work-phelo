import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  FiscalPeriodStatus,
  GLAccountCategory,
  JournalStatus,
  NormalBalance,
  Prisma,
  RecordStatus,
  SubledgerType,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingMasterDataService } from './accounting-master-data.service';

describe('AccountingMasterDataService', () => {
  const actor = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'accountant@example.com',
    role: 'EMPLOYEE',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Amina',
    moduleConfig: { accounting: true },
    featureConfig: {},
    permissions: [],
  } as RequestUser;

  function setup() {
    const prisma = {
      accountingTenantConfig: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      accountingCurrency: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      journalEntry: {
        count: jest.fn().mockResolvedValue(0),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 12 }),
        updateMany: jest.fn(),
      },
      fiscalYear: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      accountingPayableDocument: { count: jest.fn().mockResolvedValue(0) },
      accountingReceivableDocument: { count: jest.fn().mockResolvedValue(0) },
      cashbookTransaction: { count: jest.fn().mockResolvedValue(0) },
      sourceEventInbox: { count: jest.fn().mockResolvedValue(0) },
      accountingCashAccount: { findMany: jest.fn().mockResolvedValue([]) },
      gLAccount: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      accountClassification: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      accountGroup: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      accountingAuditLog: {
        create: jest.fn(),
      },
      subledgerAccount: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      entityType: {
        findFirst: jest.fn(),
      },
      journalLine: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (input: ((tx: typeof prisma) => unknown) | Array<Promise<unknown>>) => {
        if (Array.isArray(input)) return Promise.all(input);
        return input(prisma);
      },
    );
    const service = new AccountingMasterDataService(
      prisma as unknown as PrismaService,
    );
    return { prisma, service };
  }

  it('rejects locking an open fiscal period', async () => {
    const { prisma, service } = setup();
    prisma.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      tenantId: actor.tenantId,
      status: FiscalPeriodStatus.OPEN,
    });

    await expect(
      service.changeFiscalPeriodStatus(
        actor,
        'period-1',
        FiscalPeriodStatus.LOCKED,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.fiscalPeriod.updateMany).not.toHaveBeenCalled();
  });

  it('locks only a closed tenant period with an atomic scoped mutation', async () => {
    const { prisma, service } = setup();
    const closedPeriod = {
      id: 'period-1',
      tenantId: actor.tenantId,
      status: FiscalPeriodStatus.CLOSED,
    };
    prisma.fiscalPeriod.findFirst.mockResolvedValue(closedPeriod);
    prisma.fiscalPeriod.updateMany.mockResolvedValue({ count: 1 });
    prisma.fiscalPeriod.findUniqueOrThrow.mockResolvedValue({
      ...closedPeriod,
      status: FiscalPeriodStatus.LOCKED,
    });

    await service.changeFiscalPeriodStatus(
      actor,
      closedPeriod.id,
      FiscalPeriodStatus.LOCKED,
    );

    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.fiscalPeriod.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: closedPeriod.id,
          tenantId: actor.tenantId,
          status: FiscalPeriodStatus.CLOSED,
        },
      }),
    );
  });

  describe('fiscal period soft close', () => {
    const march = (status: FiscalPeriodStatus) => ({
      id: 'period-3',
      tenantId: actor.tenantId,
      name: '2026-03',
      status,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T00:00:00.000Z'),
    });

    const withPeriod = (status: FiscalPeriodStatus) => {
      const ctx = setup();
      const period = march(status);
      ctx.prisma.fiscalPeriod.findFirst.mockResolvedValue(period);
      ctx.prisma.fiscalPeriod.updateMany.mockResolvedValue({ count: 1 });
      ctx.prisma.fiscalPeriod.findUniqueOrThrow.mockResolvedValue(period);
      return ctx;
    };

    it('soft closes an open period after a clean pre-close check', async () => {
      const { prisma, service } = withPeriod(FiscalPeriodStatus.OPEN);

      await service.changeFiscalPeriodStatus(
        actor,
        'period-3',
        FiscalPeriodStatus.SOFT_CLOSED,
      );

      expect(prisma.journalEntry.count).toHaveBeenCalled();
      expect(prisma.fiscalPeriod.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'period-3',
            tenantId: actor.tenantId,
            status: FiscalPeriodStatus.OPEN,
          },
          data: expect.objectContaining({
            status: FiscalPeriodStatus.SOFT_CLOSED,
            softClosedByUserId: actor.id,
          }) as unknown,
        }),
      );
    });

    it.each([FiscalPeriodStatus.SOFT_CLOSED, FiscalPeriodStatus.CLOSED])(
      'refuses to leave OPEN for %s while drafts remain, and lists why',
      async (target) => {
        const { prisma, service } = withPeriod(FiscalPeriodStatus.OPEN);
        prisma.journalEntry.count.mockResolvedValue(2);
        prisma.cashbookTransaction.count.mockResolvedValue(1);

        const error = await service
          .changeFiscalPeriodStatus(actor, 'period-3', target)
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ConflictException);
        const body = (error as ConflictException).getResponse() as {
          message: string;
          blockers: { code: string }[];
        };
        expect(body.message).toContain('2026-03 cannot be closed yet');
        expect(body.blockers.map((b) => b.code)).toEqual([
          'DRAFT_JOURNALS',
          'DRAFT_CASHBOOK_TRANSACTIONS',
        ]);
        expect(prisma.fiscalPeriod.updateMany).not.toHaveBeenCalled();
      },
    );

    it('closes a soft-closed period without re-running the check', async () => {
      const { prisma, service } = withPeriod(FiscalPeriodStatus.SOFT_CLOSED);
      prisma.journalEntry.count.mockResolvedValue(5);

      await service.changeFiscalPeriodStatus(
        actor,
        'period-3',
        FiscalPeriodStatus.CLOSED,
      );

      expect(prisma.journalEntry.count).not.toHaveBeenCalled();
      expect(prisma.fiscalPeriod.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: FiscalPeriodStatus.SOFT_CLOSED,
          }) as unknown,
          data: expect.objectContaining({
            status: FiscalPeriodStatus.CLOSED,
            closedByUserId: actor.id,
          }) as unknown,
        }),
      );
    });

    it('still allows closing an open period directly', async () => {
      const { prisma, service } = withPeriod(FiscalPeriodStatus.OPEN);

      await service.changeFiscalPeriodStatus(
        actor,
        'period-3',
        FiscalPeriodStatus.CLOSED,
      );

      expect(prisma.fiscalPeriod.updateMany).toHaveBeenCalledTimes(1);
    });

    it.each([FiscalPeriodStatus.SOFT_CLOSED, FiscalPeriodStatus.CLOSED])(
      'reopens a %s period and clears the closing stamps',
      async (from) => {
        const { prisma, service } = withPeriod(from);

        await service.changeFiscalPeriodStatus(
          actor,
          'period-3',
          FiscalPeriodStatus.OPEN,
        );

        expect(prisma.fiscalPeriod.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: FiscalPeriodStatus.OPEN,
              softClosedAt: null,
              softClosedByUserId: null,
              closedAt: null,
              closedByUserId: null,
            }) as unknown,
          }),
        );
      },
    );

    it('rejects transitions the state machine does not allow', async () => {
      for (const [from, to] of [
        [FiscalPeriodStatus.CLOSED, FiscalPeriodStatus.SOFT_CLOSED],
        [FiscalPeriodStatus.SOFT_CLOSED, FiscalPeriodStatus.LOCKED],
      ] as [FiscalPeriodStatus, FiscalPeriodStatus][]) {
        const { prisma, service } = withPeriod(from);
        await expect(
          service.changeFiscalPeriodStatus(actor, 'period-3', to),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.fiscalPeriod.updateMany).not.toHaveBeenCalled();
      }
    });

    it('serves the pre-close check and 404s for an unknown period', async () => {
      const { prisma, service } = withPeriod(FiscalPeriodStatus.OPEN);
      prisma.accountingPayableDocument.count.mockResolvedValue(1);

      const check = await service.fiscalPeriodCloseCheck(
        actor.tenantId,
        'period-3',
      );
      expect(check.canClose).toBe(false);
      expect(check.blockers[0].code).toBe('DRAFT_PAYABLE_DOCUMENTS');

      prisma.fiscalPeriod.findFirst.mockResolvedValue(null);
      await expect(
        service.fiscalPeriodCloseCheck(actor.tenantId, 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('fiscal years', () => {
    const yearRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'year-1',
      tenantId: actor.tenantId,
      name: 'FY2026',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      createdAt: new Date('2025-12-01'),
      periods: [],
      ...overrides,
    });

    const withGenerate = (startMonth: number) => {
      const ctx = setup();
      ctx.prisma.accountingTenantConfig.findUnique.mockResolvedValue({
        tenantId: actor.tenantId,
        fiscalYearStartMonth: startMonth,
      });
      ctx.prisma.fiscalPeriod.findFirst.mockResolvedValue(null);
      ctx.prisma.fiscalYear.create.mockResolvedValue({ id: 'year-1' });
      ctx.prisma.fiscalYear.findFirst.mockResolvedValue(yearRow());
      return ctx;
    };

    it('generates the year record and its 12 periods together, attached to the year', async () => {
      const { prisma, service } = withGenerate(1);

      await service.generateFiscalYear(actor, 2026);

      expect(prisma.fiscalYear.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: actor.tenantId,
          name: 'FY2026',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
        }) as unknown,
      });
      const [{ data }] = prisma.fiscalPeriod.createMany.mock.calls[0] as [
        { data: { name: string; fiscalYearId: string }[] },
      ];
      expect(data).toHaveLength(12);
      expect(data.every((p) => p.fiscalYearId === 'year-1')).toBe(true);
      expect(data[0].name).toBe('Jan 2026');
      expect(data[11].name).toBe('Dec 2026');
    });

    it('names and dates a non-January year across the calendar boundary', async () => {
      const { prisma, service } = withGenerate(7);

      await service.generateFiscalYear(actor, 2026);

      expect(prisma.fiscalYear.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'FY2026/27',
          startDate: new Date('2026-07-01T00:00:00.000Z'),
          endDate: new Date('2027-06-30T00:00:00.000Z'),
        }) as unknown,
      });
    });

    it('lets the caller pick the start month instead of the tenant setting', async () => {
      const { prisma, service } = withGenerate(1);

      await service.generateFiscalYear(actor, 2026, 4);

      expect(prisma.fiscalYear.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'FY2026/27',
          startDate: new Date('2026-04-01T00:00:00.000Z'),
          endDate: new Date('2027-03-31T00:00:00.000Z'),
        }) as unknown,
      });
      expect(prisma.accountingTenantConfig.findUnique).not.toHaveBeenCalled();
    });

    it('creates nothing when the year would overlap an existing period', async () => {
      const { prisma, service } = withGenerate(1);
      prisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'p',
        name: 'Mar 2026',
      });

      await expect(service.generateFiscalYear(actor, 2026)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.fiscalYear.create).not.toHaveBeenCalled();
      expect(prisma.fiscalPeriod.createMany).not.toHaveBeenCalled();
    });

    it('keeps the old generateYear endpoint returning the periods', async () => {
      const { prisma, service } = withGenerate(1);
      const periods = [{ id: 'p1', status: FiscalPeriodStatus.OPEN }];
      prisma.fiscalYear.findFirst.mockResolvedValue(yearRow({ periods }));

      await expect(
        service.createFiscalPeriod(actor, { generateYear: 2026 }),
      ).resolves.toEqual(periods);
    });

    it('lists years newest first with derived status and progress', async () => {
      const { prisma, service } = setup();
      prisma.fiscalYear.findMany.mockResolvedValue([
        yearRow({
          periods: [
            { status: FiscalPeriodStatus.CLOSED },
            { status: FiscalPeriodStatus.OPEN },
          ],
        }),
      ]);

      const [year] = await service.listFiscalYears(actor.tenantId);

      expect(prisma.fiscalYear.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: actor.tenantId },
          orderBy: { startDate: 'desc' },
        }),
      );
      expect(year).toMatchObject({
        name: 'FY2026',
        status: FiscalPeriodStatus.OPEN,
        periodCount: 2,
        closedPeriodCount: 1,
      });
    });

    it('returns one year with its periods, or 404s', async () => {
      const { prisma, service } = setup();
      prisma.fiscalYear.findFirst.mockResolvedValue(
        yearRow({ periods: [{ id: 'p1', status: FiscalPeriodStatus.LOCKED }] }),
      );

      const year = await service.getFiscalYear(actor.tenantId, 'year-1');
      expect(year.status).toBe(FiscalPeriodStatus.LOCKED);
      expect(year.periods).toHaveLength(1);

      prisma.fiscalYear.findFirst.mockResolvedValue(null);
      await expect(
        service.getFiscalYear(actor.tenantId, 'nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('only accepts a one-off period that falls inside an existing year', async () => {
      const { prisma, service } = setup();
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.fiscalPeriod.findFirst.mockResolvedValue(null);
      prisma.fiscalYear.findFirst.mockResolvedValue(null);

      await expect(
        service.createFiscalPeriod(actor, {
          name: 'Stray',
          startDate: '2030-01-01',
          endDate: '2030-01-31',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.fiscalPeriod.create).not.toHaveBeenCalled();

      prisma.fiscalYear.findFirst.mockResolvedValue({ id: 'year-1' });
      prisma.fiscalPeriod.create.mockResolvedValue({ id: 'p' });
      await service.createFiscalPeriod(actor, {
        name: 'Gap',
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      });
      expect(prisma.fiscalPeriod.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ fiscalYearId: 'year-1' }) as unknown,
      });
    });
  });

  it('blocks base currency changes after journals exist', async () => {
    const { prisma, service } = setup();
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'USD',
      isActive: true,
    });
    prisma.accountingTenantConfig.findUnique.mockResolvedValue({
      tenantId: actor.tenantId,
      baseCurrency: 'GHS',
    });
    prisma.journalEntry.count.mockResolvedValue(1);

    await expect(
      service.updateConfig(actor, { baseCurrency: 'USD' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.accountingTenantConfig.upsert).not.toHaveBeenCalled();
  });

  it('does not allow a summary account to be re-enabled for posting', async () => {
    const { prisma, service } = setup();
    prisma.gLAccount.findFirst.mockResolvedValue({
      id: 'account-1',
      tenantId: actor.tenantId,
      code: '1000',
      name: 'Assets',
      category: GLAccountCategory.ASSET,
      normalBalance: NormalBalance.DEBIT,
      parentAccountId: null,
      allowPosting: false,
      status: RecordStatus.ACTIVE,
    });
    prisma.gLAccount.count.mockResolvedValue(1);

    await expect(
      service.updateGLAccount(actor, 'account-1', { allowPosting: true }),
    ).rejects.toThrow('Summary accounts with child accounts');
    expect(prisma.gLAccount.update).not.toHaveBeenCalled();
  });

  it('lists fixed account categories with normal reporting metadata', () => {
    const { service } = setup();

    const categories = service.listAccountCategories();

    expect(categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: GLAccountCategory.ASSET,
          normalBalance: NormalBalance.DEBIT,
          financialStatement: 'BALANCE_SHEET',
        }),
        expect.objectContaining({
          code: GLAccountCategory.REVENUE,
          normalBalance: NormalBalance.CREDIT,
          financialStatement: 'INCOME_STATEMENT',
        }),
      ]),
    );
  });

  it('ensures a Cedant subledger from an internal service with no control account', async () => {
    const { prisma, service } = setup();
    prisma.subledgerAccount.findFirst.mockResolvedValue(null);
    prisma.entityType.findFirst.mockResolvedValue({
      id: 'entity-type-cedant',
      tenantId: actor.tenantId,
      name: 'Cedant',
    });
    prisma.accountingCurrency.findUnique.mockResolvedValue({
      code: 'GHS',
      isActive: true,
    });
    prisma.subledgerAccount.create.mockResolvedValue({
      id: 'subledger-1',
      tenantId: actor.tenantId,
      code: 'CED-123',
      name: 'Acme Cedant',
      type: 'Cedant',
      externalRef: 'counterparty-1',
    });

    await service.ensureInternalInsuranceSubledger('reinsurance-service', {
      tenantId: actor.tenantId,
      type: 'Cedant',
      externalRef: 'counterparty-1',
      name: 'Acme Cedant',
      currency: 'GHS',
    });

    const [createArgs] = prisma.subledgerAccount.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(createArgs.data).toMatchObject({
      tenantId: actor.tenantId,
      type: 'Cedant',
      externalRef: 'counterparty-1',
      createdByUserId: 'service:reinsurance-service',
    });
    expect(createArgs.data.controlAccountId).toBeUndefined();
    expect(createArgs.data.code).toEqual(
      expect.stringMatching(/^CED-[A-F0-9]{12}$/),
    );
  });

  it('updates an existing active Reinsurer subledger by type and external reference', async () => {
    const { prisma, service } = setup();
    prisma.entityType.findFirst.mockResolvedValue({
      id: 'entity-type-reinsurer',
      tenantId: actor.tenantId,
      name: 'Reinsurer',
    });
    prisma.subledgerAccount.findFirst.mockResolvedValue({
      id: 'subledger-1',
      tenantId: actor.tenantId,
      code: 'REI-OLD',
      name: 'Old Reinsurer',
      type: 'Reinsurer',
      externalRef: 'counterparty-1',
      currency: null,
      status: RecordStatus.ACTIVE,
    });
    prisma.subledgerAccount.update.mockResolvedValue({
      id: 'subledger-1',
      name: 'New Reinsurer',
    });

    await service.ensureInternalInsuranceSubledger('reinsurance-service', {
      tenantId: actor.tenantId,
      type: 'Reinsurer',
      externalRef: 'counterparty-1',
      name: 'New Reinsurer',
      currency: 'GHS',
    });

    expect(prisma.subledgerAccount.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        type: 'Reinsurer',
        externalRef: 'counterparty-1',
      },
    });
    const [updateArgs] = prisma.subledgerAccount.update.mock.calls[0] as [
      {
        where: { id_tenantId: { id: string; tenantId: string } };
        data: Record<string, unknown>;
      },
    ];
    expect(updateArgs.where).toEqual({
      id_tenantId: { id: 'subledger-1', tenantId: actor.tenantId },
    });
    expect(updateArgs.data).toMatchObject({
      name: 'New Reinsurer',
      currency: 'GHS',
      updatedByUserId: 'service:reinsurance-service',
    });
  });

  it('does not silently reactivate an inactive integrated subledger', async () => {
    const { prisma, service } = setup();
    prisma.entityType.findFirst.mockResolvedValue({
      id: 'entity-type-cedant',
      tenantId: actor.tenantId,
      name: 'Cedant',
    });
    prisma.subledgerAccount.findFirst.mockResolvedValue({
      id: 'subledger-1',
      tenantId: actor.tenantId,
      type: 'Cedant',
      externalRef: 'counterparty-1',
      status: RecordStatus.INACTIVE,
    });

    await expect(
      service.ensureInternalInsuranceSubledger('reinsurance-service', {
        tenantId: actor.tenantId,
        type: 'Cedant',
        externalRef: 'counterparty-1',
        name: 'Acme Cedant',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.subledgerAccount.update).not.toHaveBeenCalled();
  });

  it('keeps the same reinsurer premium payable and claims receivable balances separate by control account', async () => {
    const { prisma, service } = setup();
    prisma.subledgerAccount.findMany.mockResolvedValue([
      {
        id: 'reinsurer-premium-ap-subledger',
        tenantId: actor.tenantId,
        code: 'REI-PREMIUM',
        name: 'Reinsurer A',
        type: SubledgerType.REINSURER,
        externalRef: 'reinsurer-1',
        controlAccountId: 'premium-payable-control',
        currency: 'GHS',
        status: RecordStatus.ACTIVE,
        controlAccount: {
          id: 'premium-payable-control',
          code: '2100',
          name: 'Premium Payables',
          category: GLAccountCategory.LIABILITY,
          normalBalance: NormalBalance.CREDIT,
        },
      },
      {
        id: 'reinsurer-claims-ar-subledger',
        tenantId: actor.tenantId,
        code: 'REI-CLAIMS',
        name: 'Reinsurer A',
        type: SubledgerType.REINSURER,
        externalRef: 'reinsurer-1',
        controlAccountId: 'claims-receivable-control',
        currency: 'GHS',
        status: RecordStatus.ACTIVE,
        controlAccount: {
          id: 'claims-receivable-control',
          code: '1200',
          name: 'Claims Recovery Receivables',
          category: GLAccountCategory.ASSET,
          normalBalance: NormalBalance.DEBIT,
        },
      },
    ]);
    prisma.journalLine.findMany.mockResolvedValue([
      {
        subledgerAccountId: 'reinsurer-premium-ap-subledger',
        glAccount: { normalBalance: NormalBalance.CREDIT },
        transactionDebit: new Prisma.Decimal(0),
        transactionCredit: new Prisma.Decimal(100),
        baseDebit: new Prisma.Decimal(0),
        baseCredit: new Prisma.Decimal(100),
        journalEntry: {
          transactionCurrency: 'GHS',
          baseCurrency: 'GHS',
        },
      },
      {
        subledgerAccountId: 'reinsurer-claims-ar-subledger',
        glAccount: { normalBalance: NormalBalance.DEBIT },
        transactionDebit: new Prisma.Decimal(100),
        transactionCredit: new Prisma.Decimal(0),
        baseDebit: new Prisma.Decimal(100),
        baseCredit: new Prisma.Decimal(0),
        journalEntry: {
          transactionCurrency: 'GHS',
          baseCurrency: 'GHS',
        },
      },
    ]);

    const result = await service.listSubledgerAccounts(actor.tenantId, {
      type: SubledgerType.REINSURER,
      externalRef: 'reinsurer-1',
    });

    expect(prisma.subledgerAccount.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        type: SubledgerType.REINSURER,
        externalRef: 'reinsurer-1',
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
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'reinsurer-premium-ap-subledger',
      controlAccountId: 'premium-payable-control',
    });
    expect(result[0].balance).toMatchObject({
      baseBalance: 100,
      transactionBalance: 100,
    });
    expect(result[1]).toMatchObject({
      id: 'reinsurer-claims-ar-subledger',
      controlAccountId: 'claims-receivable-control',
    });
    expect(result[1].balance).toMatchObject({
      baseBalance: 100,
      transactionBalance: 100,
    });
  });

  it('keeps the same cedant premium receivable and claims payable balances separate by control account', async () => {
    const { prisma, service } = setup();
    prisma.subledgerAccount.findMany.mockResolvedValue([
      {
        id: 'cedant-premium-ar-subledger',
        tenantId: actor.tenantId,
        code: 'CED-PREMIUM',
        name: 'Cedant A',
        type: SubledgerType.CEDANT,
        externalRef: 'cedant-1',
        controlAccountId: 'premium-receivable-control',
        currency: 'GHS',
        status: RecordStatus.ACTIVE,
        controlAccount: {
          id: 'premium-receivable-control',
          code: '1100',
          name: 'Premium Receivables',
          category: GLAccountCategory.ASSET,
          normalBalance: NormalBalance.DEBIT,
        },
      },
      {
        id: 'cedant-claims-ap-subledger',
        tenantId: actor.tenantId,
        code: 'CED-CLAIMS',
        name: 'Cedant A',
        type: SubledgerType.CEDANT,
        externalRef: 'cedant-1',
        controlAccountId: 'claims-payable-control',
        currency: 'GHS',
        status: RecordStatus.ACTIVE,
        controlAccount: {
          id: 'claims-payable-control',
          code: '2200',
          name: 'Claims Payables',
          category: GLAccountCategory.LIABILITY,
          normalBalance: NormalBalance.CREDIT,
        },
      },
    ]);
    prisma.journalLine.findMany.mockResolvedValue([
      {
        subledgerAccountId: 'cedant-premium-ar-subledger',
        glAccount: { normalBalance: NormalBalance.DEBIT },
        transactionDebit: new Prisma.Decimal(250),
        transactionCredit: new Prisma.Decimal(0),
        baseDebit: new Prisma.Decimal(250),
        baseCredit: new Prisma.Decimal(0),
        journalEntry: {
          transactionCurrency: 'GHS',
          baseCurrency: 'GHS',
        },
      },
      {
        subledgerAccountId: 'cedant-claims-ap-subledger',
        glAccount: { normalBalance: NormalBalance.CREDIT },
        transactionDebit: new Prisma.Decimal(0),
        transactionCredit: new Prisma.Decimal(90),
        baseDebit: new Prisma.Decimal(0),
        baseCredit: new Prisma.Decimal(90),
        journalEntry: {
          transactionCurrency: 'GHS',
          baseCurrency: 'GHS',
        },
      },
    ]);

    const result = await service.listSubledgerAccounts(actor.tenantId, {
      type: SubledgerType.CEDANT,
      externalRef: 'cedant-1',
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'cedant-premium-ar-subledger',
      controlAccountId: 'premium-receivable-control',
    });
    expect(result[0].balance).toMatchObject({
      baseBalance: 250,
      transactionBalance: 250,
    });
    expect(result[1]).toMatchObject({
      id: 'cedant-claims-ap-subledger',
      controlAccountId: 'claims-payable-control',
    });
    expect(result[1].balance).toMatchObject({
      baseBalance: 90,
      transactionBalance: 90,
    });
  });

  describe('entity outstanding balances', () => {
    const entity = (id: string, type: string) => ({
      id,
      tenantId: actor.tenantId,
      code: id.toUpperCase(),
      name: id,
      type,
      controlAccountId: null,
      controlAccount: null,
      currency: 'GHS',
      status: RecordStatus.ACTIVE,
    });
    const line = (
      subledgerAccountId: string,
      normalBalance: NormalBalance,
      debit: number,
      credit: number,
      currency = 'GHS',
    ) => ({
      subledgerAccountId,
      glAccount: { normalBalance },
      transactionDebit: new Prisma.Decimal(debit),
      transactionCredit: new Prisma.Decimal(credit),
      baseDebit: new Prisma.Decimal(debit),
      baseCredit: new Prisma.Decimal(credit),
      journalEntry: { transactionCurrency: currency },
    });

    it('works without a control account: what a customer owes and what is owed to a vendor', async () => {
      const { prisma, service } = setup();
      prisma.subledgerAccount.findMany.mockResolvedValue([
        entity('cust', 'CUSTOMER'),
        entity('vend', 'VENDOR'),
        entity('idle', 'CUSTOMER'),
      ]);
      prisma.journalLine.findMany.mockResolvedValue([
        // customer: invoiced 1,000 on receivables (debit-normal), then paid 400
        line('cust', NormalBalance.DEBIT, 1000, 0),
        line('cust', NormalBalance.DEBIT, 0, 400),
        // vendor: billed 800 on payables (credit-normal), then paid 300
        line('vend', NormalBalance.CREDIT, 0, 800),
        line('vend', NormalBalance.CREDIT, 300, 0),
      ]);

      const [cust, vend, idle] = await service.listSubledgerAccounts(
        actor.tenantId,
      );

      expect(cust.balance.baseBalance).toBe(600);
      expect(vend.balance.baseBalance).toBe(500);
      expect(idle.balance.baseBalance).toBe(0);
      expect(cust.balance).toMatchObject({
        baseDebit: 1000,
        baseCredit: 400,
        transactionCurrencies: ['GHS'],
      });
    });

    it('uses base amounts, not the transaction currency, for the balance', async () => {
      const { prisma, service } = setup();
      prisma.subledgerAccount.findMany.mockResolvedValue([
        entity('cust', 'CUSTOMER'),
      ]);
      prisma.journalLine.findMany.mockResolvedValue([
        {
          ...line('cust', NormalBalance.DEBIT, 100, 0, 'USD'),
          baseDebit: new Prisma.Decimal(1500),
        },
      ]);

      const [cust] = await service.listSubledgerAccounts(actor.tenantId);

      expect(cust.balance.baseBalance).toBe(1500);
      expect(cust.balance.transactionBalance).toBe(100);
      expect(cust.balance.transactionCurrencies).toEqual(['USD']);
    });

    it('reads only posted and reversed journals for the listed entities', async () => {
      const { prisma, service } = setup();
      prisma.subledgerAccount.findMany.mockResolvedValue([
        entity('cust', 'CUSTOMER'),
      ]);
      prisma.journalLine.findMany.mockResolvedValue([]);

      await service.listSubledgerAccounts(actor.tenantId);

      expect(prisma.journalLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: actor.tenantId,
            subledgerAccountId: { in: ['cust'] },
            journalEntry: {
              status: {
                in: [JournalStatus.POSTED, JournalStatus.REVERSED],
              },
            },
          },
        }),
      );
    });

    it('skips the query entirely when there are no entities', async () => {
      const { prisma, service } = setup();
      prisma.subledgerAccount.findMany.mockResolvedValue([]);

      await expect(
        service.listSubledgerAccounts(actor.tenantId),
      ).resolves.toEqual([]);
      expect(prisma.journalLine.findMany).not.toHaveBeenCalled();
    });

    it('returns the same balance on a single entity', async () => {
      const { prisma, service } = setup();
      prisma.subledgerAccount.findFirst.mockResolvedValue(
        entity('vend', 'VENDOR'),
      );
      prisma.journalLine.findMany.mockResolvedValue([
        line('vend', NormalBalance.CREDIT, 0, 250),
      ]);

      const result = await service.getSubledgerAccount(actor.tenantId, 'vend');

      expect(result.balance.baseBalance).toBe(250);
    });
  });

  it('derives GL account category and normal balance from account group', async () => {
    const { prisma, service } = setup();
    prisma.accountGroup.findFirst.mockResolvedValue({
      id: 'group-1',
      tenantId: actor.tenantId,
      code: '1110',
      name: 'Bank Accounts',
      isActive: true,
      classification: {
        id: 'classification-1',
        code: '1100',
        name: 'Current Assets',
        category: GLAccountCategory.ASSET,
        isActive: true,
      },
    });
    prisma.gLAccount.create.mockResolvedValue({
      id: 'account-1',
      tenantId: actor.tenantId,
      code: '1111',
      name: 'Cash at Bank',
      category: GLAccountCategory.ASSET,
      normalBalance: NormalBalance.DEBIT,
      accountGroupId: 'group-1',
      parentAccountId: null,
      accountGroup: {
        id: 'group-1',
        code: '1110',
        name: 'Bank Accounts',
        classification: {
          id: 'classification-1',
          code: '1100',
          name: 'Current Assets',
          category: GLAccountCategory.ASSET,
        },
      },
      parentAccount: null,
    });

    const result = await service.createGLAccount(actor, {
      code: '1111',
      name: 'Cash at Bank',
      accountGroupId: 'group-1',
    });

    const createCall = (
      prisma.gLAccount.create as jest.MockedFunction<
        (args: {
          data: {
            category: GLAccountCategory;
            normalBalance: NormalBalance;
            accountGroupId: string;
          };
        }) => Promise<unknown>
      >
    ).mock.calls[0][0];
    expect(createCall.data.category).toBe(GLAccountCategory.ASSET);
    expect(createCall.data.normalBalance).toBe(NormalBalance.DEBIT);
    expect(createCall.data.accountGroupId).toBe('group-1');

    expect(result.category).toBe(GLAccountCategory.ASSET);
    expect(result.normalBalance).toBe(NormalBalance.DEBIT);
    expect(result.classification.code).toBe('1100');
    expect(result.accountGroup?.code).toBe('1110');
    expect(result.isLegacyUnclassified).toBe(false);

    const auditCall = (
      prisma.accountingAuditLog.create as jest.MockedFunction<
        (args: {
          data: {
            action: string;
            entityType: string;
            entityId: string;
          };
        }) => Promise<unknown>
      >
    ).mock.calls[0][0];
    expect(auditCall.data.action).toBe('GL_ACCOUNT_CREATE');
    expect(auditCall.data.entityType).toBe('GLAccount');
    expect(auditCall.data.entityId).toBe('account-1');
  });

  describe('accounts directly under a classification', () => {
    const classification = {
      id: 'classification-1',
      tenantId: actor.tenantId,
      code: '1100',
      name: 'Current Assets',
      category: GLAccountCategory.ASSET,
      isActive: true,
    };

    it('creates an account with a classification and no group', async () => {
      const { prisma, service } = setup();
      prisma.accountClassification.findFirst.mockResolvedValue(classification);
      prisma.gLAccount.create.mockResolvedValue({
        id: 'account-1',
        tenantId: actor.tenantId,
        code: '1101',
        name: 'Petty Cash',
        category: GLAccountCategory.ASSET,
        normalBalance: NormalBalance.DEBIT,
        classificationId: 'classification-1',
        classification,
        accountGroupId: null,
        accountGroup: null,
        parentAccountId: null,
        parentAccount: null,
      });

      const result = await service.createGLAccount(actor, {
        code: '1101',
        name: 'Petty Cash',
        classificationId: 'classification-1',
      });

      const createCall = (
        prisma.gLAccount.create as jest.MockedFunction<
          (args: {
            data: {
              category: GLAccountCategory;
              normalBalance: NormalBalance;
              classificationId: string;
              accountGroupId?: string;
            };
          }) => Promise<unknown>
        >
      ).mock.calls[0][0];
      expect(createCall.data.category).toBe(GLAccountCategory.ASSET);
      expect(createCall.data.normalBalance).toBe(NormalBalance.DEBIT);
      expect(createCall.data.classificationId).toBe('classification-1');
      expect(createCall.data.accountGroupId).toBeUndefined();

      expect(result.classification.code).toBe('1100');
      expect(result.accountGroup).toBeNull();
      expect(result.isLegacyUnclassified).toBe(false);
      expect(result.hierarchyPath).toEqual([
        GLAccountCategory.ASSET,
        'Current Assets',
        'Petty Cash',
      ]);
    });

    it('keeps the code inside the classification band', async () => {
      const { prisma, service } = setup();
      prisma.accountClassification.findFirst.mockResolvedValue(classification);

      await expect(
        service.createGLAccount(actor, {
          code: '1201',
          name: 'Out of band',
          classificationId: 'classification-1',
        }),
      ).rejects.toThrow('between 1100 and 1199');
      expect(prisma.gLAccount.create).not.toHaveBeenCalled();
    });

    it('rejects a group that belongs to a different classification', async () => {
      const { prisma, service } = setup();
      prisma.accountGroup.findFirst.mockResolvedValue({
        id: 'group-1',
        tenantId: actor.tenantId,
        classificationId: 'classification-2',
        code: '1210',
        isActive: true,
        classification: {
          id: 'classification-2',
          code: '1200',
          name: 'Fixed Assets',
          category: GLAccountCategory.ASSET,
          isActive: true,
        },
      });

      await expect(
        service.createGLAccount(actor, {
          code: '1211',
          name: 'Vehicles',
          classificationId: 'classification-1',
          accountGroupId: 'group-1',
        }),
      ).rejects.toThrow('does not belong to the selected classification');
      expect(prisma.gLAccount.create).not.toHaveBeenCalled();
    });

    it('needs a category when neither group nor classification is given', async () => {
      const { prisma, service } = setup();

      await expect(
        service.createGLAccount(actor, { code: '1101', name: 'Petty Cash' }),
      ).rejects.toThrow('neither accountGroupId nor classificationId');
      expect(prisma.gLAccount.create).not.toHaveBeenCalled();
    });

    it('keeps the classification when the group is cleared', async () => {
      const { prisma, service } = setup();
      prisma.gLAccount.findFirst.mockResolvedValue({
        id: 'account-1',
        tenantId: actor.tenantId,
        code: '1111',
        name: 'Cash at Bank',
        category: GLAccountCategory.ASSET,
        normalBalance: NormalBalance.DEBIT,
        classificationId: 'classification-1',
        accountGroupId: 'group-1',
        parentAccountId: null,
        allowPosting: true,
        status: RecordStatus.ACTIVE,
      });
      prisma.accountClassification.findFirst.mockResolvedValue(classification);
      prisma.journalLine.count.mockResolvedValue(0);
      prisma.gLAccount.update.mockResolvedValue({
        id: 'account-1',
        tenantId: actor.tenantId,
        code: '1111',
        name: 'Cash at Bank',
        category: GLAccountCategory.ASSET,
        normalBalance: NormalBalance.DEBIT,
        classificationId: 'classification-1',
        classification,
        accountGroupId: null,
        accountGroup: null,
        parentAccountId: null,
        parentAccount: null,
      });

      const result = await service.updateGLAccount(actor, 'account-1', {
        accountGroupId: null,
      });

      const updateCall = (
        prisma.gLAccount.update as jest.MockedFunction<
          (args: {
            data: {
              classificationId: string;
              accountGroupId: string | null;
            };
          }) => Promise<unknown>
        >
      ).mock.calls[0][0];
      expect(updateCall.data.classificationId).toBe('classification-1');
      expect(updateCall.data.accountGroupId).toBeNull();
      expect(result.accountGroup).toBeNull();
    });

    it('filters by classification whether the account is grouped or not', async () => {
      const { prisma, service } = setup();
      prisma.gLAccount.findMany.mockResolvedValue([]);

      await service.listGLAccounts(actor.tenantId, {
        classificationId: 'classification-1',
      });

      const findCall = (
        prisma.gLAccount.findMany as jest.MockedFunction<
          (args: { where: unknown }) => Promise<unknown>
        >
      ).mock.calls[0][0];
      expect(findCall.where).toMatchObject({
        OR: [
          { classificationId: 'classification-1' },
          { accountGroup: { classificationId: 'classification-1' } },
        ],
      });
    });
  });

  it('keeps legacy GL accounts readable as unclassified', async () => {
    const { prisma, service } = setup();
    prisma.gLAccount.findMany.mockResolvedValue([
      {
        id: 'account-1',
        tenantId: actor.tenantId,
        code: '9999',
        name: 'Legacy Suspense',
        category: GLAccountCategory.ASSET,
        normalBalance: NormalBalance.DEBIT,
        accountGroupId: null,
        accountGroup: null,
        parentAccount: null,
      },
    ]);

    const result = await service.listGLAccounts(actor.tenantId, {});

    expect(result[0].isLegacyUnclassified).toBe(true);
    expect(result[0].classification.code).toBe('UNCLASSIFIED');
    expect(result[0].classification.name).toBe('Unclassified');
    expect(result[0].accountGroup).toBeNull();
  });

  it('seeds the standard hierarchy without overwriting existing templates', async () => {
    const { prisma, service } = setup();
    prisma.accountClassification.findUnique.mockResolvedValueOnce(null);
    prisma.accountClassification.findUnique.mockResolvedValue({
      id: 'existing-classification',
      tenantId: actor.tenantId,
      code: 'EXISTING',
      category: GLAccountCategory.ASSET,
    });
    prisma.accountClassification.create.mockResolvedValue({
      id: 'classification-1',
      tenantId: actor.tenantId,
      code: '1100',
      category: GLAccountCategory.ASSET,
    });
    prisma.accountGroup.findUnique.mockResolvedValue(null);
    prisma.accountGroup.create.mockImplementation(
      (args: { data: { code: string; classificationId: string } }) =>
        Promise.resolve({
          id: `group-${args.data.code}`,
          code: args.data.code,
          classificationId: args.data.classificationId,
        }),
    );

    const result = await service.seedStandardAccountHierarchy(actor);

    expect(result.classificationsCreated).toBe(1);
    expect(result.classificationsSkipped).toBeGreaterThan(0);
    expect(result.groupsCreated).toBeGreaterThan(0);
    const classificationCreateCall = (
      prisma.accountClassification.create as jest.MockedFunction<
        (args: {
          data: { tenantId: string; code: string; isSystemTemplate: boolean };
        }) => Promise<unknown>
      >
    ).mock.calls[0][0];
    expect(classificationCreateCall.data.tenantId).toBe(actor.tenantId);
    expect(classificationCreateCall.data.code).toBe('1100');
    expect(classificationCreateCall.data.isSystemTemplate).toBe(true);
  });

  it('reuses seeded records created by a concurrent request', async () => {
    const { prisma, service } = setup();
    prisma.accountClassification.findUnique.mockResolvedValueOnce(null);
    prisma.accountClassification.findUnique.mockResolvedValue({
      id: 'existing-classification',
      tenantId: actor.tenantId,
      code: 'EXISTING',
      category: GLAccountCategory.ASSET,
    });
    prisma.accountClassification.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.accountClassification.findUniqueOrThrow.mockResolvedValue({
      id: 'classification-1',
      tenantId: actor.tenantId,
      code: '1100',
      category: GLAccountCategory.ASSET,
    });
    prisma.accountGroup.findUnique.mockResolvedValue({
      id: 'existing-group',
      tenantId: actor.tenantId,
      code: 'EXISTING_GROUP',
      classificationId: 'classification-1',
    });

    const result = await service.seedStandardAccountHierarchy(actor);

    expect(result.classificationsCreated).toBe(0);
    expect(result.classificationsSkipped).toBeGreaterThan(0);
    expect(result.groupsSkipped).toBeGreaterThan(0);
    expect(prisma.accountClassification.findUniqueOrThrow).toHaveBeenCalled();
  });

  it('rejects category changes on grouped accounts unless the group is cleared', async () => {
    const { prisma, service } = setup();
    prisma.gLAccount.findFirst.mockResolvedValue({
      id: 'account-1',
      tenantId: actor.tenantId,
      code: '1100',
      name: 'Cash at Bank',
      category: GLAccountCategory.ASSET,
      normalBalance: NormalBalance.DEBIT,
      accountGroupId: 'group-1',
      parentAccountId: null,
      allowPosting: true,
      status: RecordStatus.ACTIVE,
    });

    await expect(
      service.updateGLAccount(actor, 'account-1', {
        category: GLAccountCategory.EXPENSE,
      }),
    ).rejects.toThrow('Clear accountGroupId');
    expect(prisma.gLAccount.update).not.toHaveBeenCalled();
  });

  it('rejects GL subaccounts whose parent is in a different account group', async () => {
    const { prisma, service } = setup();
    prisma.accountGroup.findFirst.mockResolvedValue({
      id: 'group-1',
      tenantId: actor.tenantId,
      code: '1110',
      isActive: true,
      classification: {
        id: 'classification-1',
        code: '1100',
        name: 'Current Assets',
        category: GLAccountCategory.ASSET,
        isActive: true,
      },
    });
    prisma.gLAccount.findFirst.mockResolvedValue({
      id: 'parent-1',
      tenantId: actor.tenantId,
      category: GLAccountCategory.ASSET,
      accountGroupId: 'group-2',
      parentAccountId: null,
      status: RecordStatus.ACTIVE,
    });

    await expect(
      service.createGLAccount(actor, {
        code: '1111',
        name: 'Ecobank Current Account',
        accountGroupId: 'group-1',
        parentAccountId: 'parent-1',
      }),
    ).rejects.toThrow('same account group');
    expect(prisma.gLAccount.create).not.toHaveBeenCalled();
  });

  it('uses the tenant composite key for currency mutations', async () => {
    const { prisma, service } = setup();
    prisma.accountingCurrency.findFirst.mockResolvedValue({
      id: 'currency-1',
      tenantId: actor.tenantId,
      code: 'USD',
    });
    prisma.accountingTenantConfig.findUnique.mockResolvedValue(null);
    prisma.accountingCurrency.update.mockResolvedValue({
      id: 'currency-1',
      code: 'USD',
    });

    await service.updateCurrency(actor, 'currency-1', {
      name: 'US Dollar',
    });

    expect(prisma.accountingCurrency.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id_tenantId: {
            id: 'currency-1',
            tenantId: actor.tenantId,
          },
        },
      }),
    );
  });
});
