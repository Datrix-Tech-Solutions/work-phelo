import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import { BudgetsService } from './budgets.service';

const actor = { id: 'user-1', tenantId: 'tenant-1' } as unknown as RequestUser;

const salesCc = { id: 'cc-sales', code: 'SAL', name: 'Sales' };
const opsCc = { id: 'cc-ops', code: 'OPS', name: 'Operations' };

const account = (overrides: Record<string, unknown> = {}) => ({
  id: 'acc-expense',
  tenantId: actor.tenantId,
  code: '5100',
  name: 'Salaries',
  category: 'EXPENSE',
  status: 'ACTIVE',
  allowPosting: true,
  _count: { childAccounts: 0 },
  ...overrides,
});
const expenseAccount = account();
const revenueAccount = account({
  id: 'acc-revenue',
  code: '4000',
  name: 'Premium Income',
  category: 'REVENUE',
});

const line = (
  acc: { id: string; code: string; name: string; category: string },
  amount: number,
  costCentre: { id: string; code: string; name: string } | null = null,
) => ({
  id: `line-${acc.id}-${costCentre?.id ?? 'all'}`,
  tenantId: actor.tenantId,
  budgetId: 'budget-1',
  glAccountId: acc.id,
  costCentreId: costCentre?.id ?? null,
  amount: new Prisma.Decimal(amount),
  glAccount: {
    id: acc.id,
    code: acc.code,
    name: acc.name,
    category: acc.category,
  },
  costCentre,
});

const budget = (overrides: Record<string, unknown> = {}) => ({
  id: 'budget-1',
  tenantId: actor.tenantId,
  name: 'FY2026',
  period: 'YEARLY',
  scope: 'BOTH',
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2026-12-31T00:00:00.000Z'),
  currency: 'GHS',
  status: 'DRAFT',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  lines: [line(expenseAccount, 1000, salesCc)],
  ...overrides,
});

const setup = () => {
  const prisma = {
    accountingTenantConfig: {
      findUnique: jest.fn().mockResolvedValue({ baseCurrency: 'GHS' }),
    },
    budget: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(budget()),
      create: jest.fn().mockResolvedValue({ id: 'budget-1' }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn().mockResolvedValue({}),
    },
    budgetLine: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    // Like the real tables, only return the ids that were asked for.
    gLAccount: {
      findMany: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
          Promise.resolve(
            [expenseAccount, revenueAccount].filter((a) =>
              where.id.in.includes(a.id),
            ),
          ),
        ),
    },
    costCentre: {
      findMany: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
          Promise.resolve(
            [salesCc, opsCc]
              .filter((c) => where.id.in.includes(c.id))
              .map((c) => ({ ...c, status: 'ACTIVE' })),
          ),
        ),
    },
    journalLine: { groupBy: jest.fn().mockResolvedValue([]) },
    accountingAuditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  return { prisma, service: new BudgetsService(prisma as never) };
};

const createDto = (overrides: Record<string, unknown> = {}) => ({
  name: 'FY2026',
  period: 'YEARLY' as const,
  startDate: '2026-01-01',
  scope: 'BOTH' as const,
  lines: [
    { accountId: expenseAccount.id, costCentreId: salesCc.id, amount: 1000 },
  ],
  ...overrides,
});

describe('BudgetsService', () => {
  describe('create', () => {
    it('stores a draft in the base currency with a derived end date and its lines', async () => {
      const { prisma, service } = setup();

      await service.create(
        actor,
        createDto({
          lines: [
            {
              accountId: expenseAccount.id,
              costCentreId: salesCc.id,
              amount: 1000,
            },
            { accountId: revenueAccount.id, amount: 5000 },
          ],
        }),
      );

      expect(prisma.budget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: actor.tenantId,
          currency: 'GHS',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
        }) as unknown,
      });
      expect(prisma.budgetLine.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            glAccountId: expenseAccount.id,
            costCentreId: salesCc.id,
          }),
          expect.objectContaining({
            glAccountId: revenueAccount.id,
            costCentreId: null,
          }),
        ],
      });
      expect(prisma.accountingAuditLog.create).toHaveBeenCalled();
    });

    it.each([
      [
        'a scope the account category does not fit',
        createDto({
          scope: 'INCOME',
          lines: [{ accountId: expenseAccount.id, amount: 10 }],
        }),
        undefined,
      ],
      ['an account from another tenant', createDto(), { accounts: [] }],
      [
        'a parent (non-posting) account',
        createDto(),
        { accounts: [account({ allowPosting: false })] },
      ],
      [
        'an account with children',
        createDto(),
        { accounts: [account({ _count: { childAccounts: 2 } })] },
      ],
      [
        'an inactive account',
        createDto(),
        { accounts: [account({ status: 'INACTIVE' })] },
      ],
      [
        'an inactive cost centre',
        createDto(),
        { costCentres: [{ ...salesCc, status: 'INACTIVE' }] },
      ],
      ['an unknown cost centre', createDto(), { costCentres: [] }],
      [
        'the same account and cost centre twice',
        createDto({
          lines: [
            {
              accountId: expenseAccount.id,
              costCentreId: salesCc.id,
              amount: 1,
            },
            {
              accountId: expenseAccount.id,
              costCentreId: salesCc.id,
              amount: 2,
            },
          ],
        }),
        undefined,
      ],
      [
        'a company-wide line mixed with a cost-centre split',
        createDto({
          lines: [
            { accountId: expenseAccount.id, amount: 1 },
            {
              accountId: expenseAccount.id,
              costCentreId: salesCc.id,
              amount: 2,
            },
          ],
        }),
        undefined,
      ],
      [
        'an impossible start date',
        createDto({ startDate: '2026-02-31' }),
        undefined,
      ],
    ])(
      'rejects %s',
      async (
        _label,
        dto,
        override?: { accounts?: unknown[]; costCentres?: unknown[] },
      ) => {
        const { prisma, service } = setup();
        if (override?.accounts) {
          prisma.gLAccount.findMany.mockResolvedValue(override.accounts);
        }
        if (override?.costCentres) {
          prisma.costCentre.findMany.mockResolvedValue(override.costCentres);
        }

        await expect(service.create(actor, dto)).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.budget.create).not.toHaveBeenCalled();
      },
    );

    it('requires accounting configuration', async () => {
      const { prisma, service } = setup();
      prisma.accountingTenantConfig.findUnique.mockResolvedValue(null);

      await expect(service.create(actor, createDto())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('list', () => {
    it('totals income, expense and net from the lines', async () => {
      const { prisma, service } = setup();
      prisma.budget.findMany.mockResolvedValue([
        budget({
          lines: [
            line(revenueAccount, 5000),
            line(expenseAccount, 1200, salesCc),
            line(expenseAccount, 800, opsCc),
          ],
        }),
      ]);

      const [row] = await service.list(actor.tenantId, {});

      expect(row).toMatchObject({
        incomeBudgeted: 5000,
        expenseBudgeted: 2000,
        netAmount: 3000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      });
      expect(row).not.toHaveProperty('lines');
    });
  });

  describe('get', () => {
    it('rolls posted activity up per line, by account and cost centre', async () => {
      const { prisma, service } = setup();
      prisma.budget.findFirst.mockResolvedValue(
        budget({
          lines: [
            line(revenueAccount, 5000, salesCc),
            line(expenseAccount, 2000),
            line(
              { ...expenseAccount, id: 'acc-rent', code: '5300', name: 'Rent' },
              300,
              opsCc,
            ),
          ],
        }),
      );
      prisma.journalLine.groupBy.mockResolvedValue([
        {
          glAccountId: revenueAccount.id,
          costCentreId: salesCc.id,
          _sum: {
            baseDebit: new Prisma.Decimal(50),
            baseCredit: new Prisma.Decimal(950),
          },
        },
        {
          glAccountId: expenseAccount.id,
          costCentreId: salesCc.id,
          _sum: {
            baseDebit: new Prisma.Decimal(300),
            baseCredit: new Prisma.Decimal(0),
          },
        },
        {
          glAccountId: expenseAccount.id,
          costCentreId: null,
          _sum: {
            baseDebit: new Prisma.Decimal(150.5),
            baseCredit: new Prisma.Decimal(50),
          },
        },
      ]);

      const detail = await service.get(actor.tenantId, 'budget-1');
      const actualOf = (accountId: string, costCentreId: string | null) =>
        detail.lines.find(
          (l) => l.accountId === accountId && l.costCentreId === costCentreId,
        )?.actual;

      // revenue reads credit − debit, from its own cost centre only
      expect(actualOf(revenueAccount.id, salesCc.id)).toBe(900);
      // a company-wide expense line sums the account across all cost centres
      expect(actualOf(expenseAccount.id, null)).toBe(400.5);
      // no posted activity yet → null, not 0
      expect(actualOf('acc-rent', opsCc.id)).toBeNull();
    });

    it('reads only posted / reversed journals inside the budget window', async () => {
      const { prisma, service } = setup();

      await service.get(actor.tenantId, 'budget-1');

      expect(prisma.journalLine.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: actor.tenantId,
            journalEntry: {
              tenantId: actor.tenantId,
              status: { in: ['POSTED', 'REVERSED'] },
              transactionDate: {
                gte: new Date('2026-01-01T00:00:00.000Z'),
                lt: new Date('2027-01-01T00:00:00.000Z'),
              },
            },
          }) as unknown,
        }),
      );
    });

    it('404s for an unknown budget', async () => {
      const { prisma, service } = setup();
      prisma.budget.findFirst.mockResolvedValue(null);

      await expect(service.get(actor.tenantId, 'nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('refuses to edit a closed budget', async () => {
      const { prisma, service } = setup();
      prisma.budget.findFirst.mockResolvedValue(budget({ status: 'CLOSED' }));

      await expect(
        service.update(actor, 'budget-1', { name: 'x' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.budget.update).not.toHaveBeenCalled();
    });

    it('recalculates the end date and replaces lines only when lines are sent', async () => {
      const { prisma, service } = setup();

      await service.update(actor, 'budget-1', { period: 'QUARTERLY' });
      expect(prisma.budget.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endDate: new Date('2026-03-31T00:00:00.000Z'),
          }) as unknown,
        }),
      );
      expect(prisma.budgetLine.deleteMany).not.toHaveBeenCalled();

      await service.update(actor, 'budget-1', {
        lines: [{ accountId: expenseAccount.id, amount: 5 }],
      });
      expect(prisma.budgetLine.deleteMany).toHaveBeenCalledTimes(1);
      expect(prisma.budgetLine.createMany).toHaveBeenCalledTimes(1);
    });

    it('keeps lines on accounts and cost centres that were deactivated after the budget was made', async () => {
      const { prisma, service } = setup();
      prisma.gLAccount.findMany.mockResolvedValue([
        account({ status: 'INACTIVE' }),
      ]);
      prisma.costCentre.findMany.mockResolvedValue([
        { ...salesCc, status: 'INACTIVE' },
      ]);

      await expect(
        service.update(actor, 'budget-1', { name: 'Renamed' }),
      ).resolves.toBeDefined();
    });

    it('does not let an edit add a newly inactive account', async () => {
      const { prisma, service } = setup();
      prisma.gLAccount.findMany.mockResolvedValue([
        revenueAccount,
        account({ id: 'acc-new', code: '5900', status: 'INACTIVE' }),
      ]);

      await expect(
        service.update(actor, 'budget-1', {
          lines: [
            { accountId: revenueAccount.id, amount: 1 },
            { accountId: 'acc-new', amount: 1 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('lifecycle', () => {
    it('activates a draft and closes an active budget', async () => {
      const { prisma, service } = setup();

      await service.activate(actor, 'budget-1');
      expect(prisma.budget.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: 'budget-1', tenantId: actor.tenantId, status: 'DRAFT' },
          data: expect.objectContaining({ status: 'ACTIVE' }) as unknown,
        }),
      );

      prisma.budget.findFirst.mockResolvedValue(budget({ status: 'ACTIVE' }));
      await service.close(actor, 'budget-1');
      expect(prisma.budget.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CLOSED' }) as unknown,
        }),
      );
    });

    it('rejects transitions from the wrong status', async () => {
      const { prisma, service } = setup();

      await expect(service.close(actor, 'budget-1')).rejects.toThrow(
        ConflictException,
      );
      prisma.budget.findFirst.mockResolvedValue(budget({ status: 'ACTIVE' }));
      await expect(service.activate(actor, 'budget-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('loses cleanly when another request already changed the status', async () => {
      const { prisma, service } = setup();
      prisma.budget.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.activate(actor, 'budget-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('deletes only drafts', async () => {
      const { prisma, service } = setup();

      await service.remove(actor, 'budget-1');
      expect(prisma.budget.delete).toHaveBeenCalledTimes(1);

      prisma.budget.findFirst.mockResolvedValue(budget({ status: 'ACTIVE' }));
      await expect(service.remove(actor, 'budget-1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.budget.delete).toHaveBeenCalledTimes(1);
    });
  });
});
