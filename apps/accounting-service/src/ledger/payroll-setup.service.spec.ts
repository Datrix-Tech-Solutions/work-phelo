import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { PayrollSetupService } from './payroll-setup.service';

const USER = { id: 'u1', tenantId: 'tenant-1' } as unknown as RequestUser;

const ALL_CORE = [
  'salariesWagesExpense',
  'employerSocialSecurityExpense',
  'netPayPayable',
  'incomeTaxPayable',
  'socialSecurityPayable',
];

function build(
  options: {
    mapped?: string[];
    baseCurrency?: string | null;
    source?: { id: string; isActive: boolean } | null;
    summary?: { entryCount: number; paidCount: number };
  } = {},
) {
  const mapped = options.mapped ?? ALL_CORE;
  const prisma = {
    payrollAccountMapping: {
      findMany: jest.fn().mockResolvedValue(
        mapped.map((role) => ({
          role,
          glAccount: { id: `acc-${role}`, code: '1', name: role },
        })),
      ),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
    payrollAccountingSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    gLAccount: { findFirst: jest.fn() },
    sourceType: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.source === undefined
            ? { id: 'src-1', isActive: true }
            : options.source,
        ),
    },
    sourceLedgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
    transactionType: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const masterData = {
    getConfig: jest.fn().mockResolvedValue({
      baseCurrency:
        options.baseCurrency === undefined ? 'GHS' : options.baseCurrency,
    }),
  };
  const provisioning = {
    ensure: jest.fn().mockResolvedValue({
      id: 'src-1',
      isActive: options.source?.isActive ?? true,
      name: 'Payroll',
    }),
  };
  const sourceLedger = {
    getSettlementSummary: jest
      .fn()
      .mockResolvedValue(
        new Map([
          ['src-1', options.summary ?? { entryCount: 0, paidCount: 0 }],
        ]),
      ),
  };
  const service = new PayrollSetupService(
    prisma as never,
    masterData as never,
    provisioning as never,
    sourceLedger as never,
  );
  return { service, prisma, masterData, provisioning };
}

describe('PayrollSetupService', () => {
  describe('getStatus', () => {
    it('is not linked when there is no Payroll source, and creates nothing', async () => {
      const { service, provisioning } = build({ source: null });

      await expect(service.getStatus('tenant-1')).resolves.toMatchObject({
        linked: false,
        ready: false,
        reason: 'NOT_LINKED',
      });
      expect(provisioning.ensure).not.toHaveBeenCalled();
    });

    it('is not linked when the source exists but is unlinked', async () => {
      const { service } = build({ source: { id: 'src-1', isActive: false } });

      await expect(service.getStatus('tenant-1')).resolves.toMatchObject({
        linked: false,
      });
    });

    it('is linked and ready when every core account is chosen', async () => {
      const { service } = build();

      await expect(service.getStatus('tenant-1')).resolves.toMatchObject({
        linked: true,
        ready: true,
        missingRoles: [],
      });
    });

    it('is linked but not ready, naming what is missing, when a core account is cleared', async () => {
      const { service } = build({
        mapped: ALL_CORE.filter((role) => role !== 'incomeTaxPayable'),
      });

      await expect(service.getStatus('tenant-1')).resolves.toMatchObject({
        linked: true,
        ready: false,
        reason: 'ACCOUNTS_MISSING',
        missingRoles: [
          { key: 'incomeTaxPayable', label: 'Income Tax Payable' },
        ],
      });
    });

    it('does not require the optional pension and other-deductions accounts', async () => {
      const { service } = build({ mapped: ALL_CORE });

      const status = await service.getStatus('tenant-1');

      expect(status.missingRoles.map((r) => r.key)).not.toContain(
        'statutoryPensionPayable',
      );
      expect(status.ready).toBe(true);
    });
  });

  describe('assertReadyToLink', () => {
    it('names every missing account', async () => {
      const { service } = build({ mapped: ['netPayPayable'] });

      await expect(service.assertReadyToLink('tenant-1')).rejects.toThrow(
        /Salaries and Wages Expense.*Income Tax Payable/,
      );
    });

    it('needs a base currency', async () => {
      const { service } = build({ baseCurrency: null });

      await expect(service.assertReadyToLink('tenant-1')).rejects.toThrow(
        'base currency',
      );
    });

    it('passes when everything core is chosen', async () => {
      const { service } = build();

      await expect(service.assertReadyToLink('tenant-1')).resolves.toBe(
        undefined,
      );
    });
  });

  describe('assertCanUnlink', () => {
    it('is blocked while payroll liabilities are unpaid', async () => {
      const { service } = build({ summary: { entryCount: 5, paidCount: 3 } });

      await expect(
        service.assertCanUnlink('tenant-1', 'src-1'),
      ).rejects.toThrow('2 payroll liabilities are still unpaid');
    });

    it('is allowed once everything is paid', async () => {
      const { service } = build({ summary: { entryCount: 5, paidCount: 5 } });

      await expect(
        service.assertCanUnlink('tenant-1', 'src-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('setMapping', () => {
    it('maps a role to an account of the right kind', async () => {
      const { service, prisma } = build();
      prisma.gLAccount.findFirst.mockResolvedValue({
        id: 'acc-9',
        name: 'Wages Payable',
        category: 'LIABILITY',
        status: 'ACTIVE',
        allowPosting: true,
      });

      await service.setMapping(USER, 'netPayPayable', 'acc-9');

      expect(prisma.payrollAccountMapping.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: {
            tenantId: 'tenant-1',
            role: 'netPayPayable',
            glAccountId: 'acc-9',
          },
        }),
      );
    });

    it('rejects an account of the wrong kind', async () => {
      const { service, prisma } = build();
      prisma.gLAccount.findFirst.mockResolvedValue({
        id: 'acc-9',
        name: 'Rent',
        category: 'EXPENSE',
        status: 'ACTIVE',
        allowPosting: true,
      });

      await expect(
        service.setMapping(USER, 'netPayPayable', 'acc-9'),
      ).rejects.toThrow('needs a liability account');
      expect(prisma.payrollAccountMapping.upsert).not.toHaveBeenCalled();
    });

    it('rejects an inactive account', async () => {
      const { service, prisma } = build();
      prisma.gLAccount.findFirst.mockResolvedValue({
        id: 'acc-9',
        name: 'Old',
        category: 'LIABILITY',
        status: 'INACTIVE',
        allowPosting: true,
      });

      await expect(
        service.setMapping(USER, 'netPayPayable', 'acc-9'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an account of another tenant', async () => {
      const { service, prisma } = build();
      prisma.gLAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.setMapping(USER, 'netPayPayable', 'acc-9'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.gLAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'acc-9', tenantId: 'tenant-1' },
        }),
      );
    });

    it('rejects an unknown role', async () => {
      const { service } = build();

      await expect(service.setMapping(USER, 'bogus', 'acc-9')).rejects.toThrow(
        'Unknown payroll account',
      );
    });

    it('clears a role', async () => {
      const { service, prisma } = build();

      await service.setMapping(USER, 'netPayPayable', null);

      expect(prisma.payrollAccountMapping.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', role: 'netPayPayable' },
      });
    });
  });

  describe('mapIfUnmapped', () => {
    it('never overwrites an existing choice', async () => {
      const { service, prisma } = build();

      await service.mapIfUnmapped('tenant-1', 'netPayPayable', 'acc-1');

      expect(prisma.payrollAccountMapping.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: {} }),
      );
    });
  });

  describe('setup view', () => {
    it('counts open items per role so a remap can warn about them', async () => {
      const { service, prisma } = build({
        summary: { entryCount: 2, paidCount: 0 },
      });
      prisma.sourceLedgerEntry.findMany.mockResolvedValue([
        { sourceRole: 'netPayPayable', amount: '100', allocations: [] },
        {
          sourceRole: 'netPayPayable',
          amount: '100',
          allocations: [{ amount: '100' }],
        },
        { sourceRole: 'incomeTaxPayable', amount: '50', allocations: [] },
      ]);

      const setup = await service.getSetup('tenant-1');

      const byKey = Object.fromEntries(
        setup.roles.map((role) => [role.key, role.openItemCount]),
      );
      expect(byKey.netPayPayable).toBe(1);
      expect(byKey.incomeTaxPayable).toBe(1);
      expect(byKey.socialSecurityPayable).toBe(0);
      expect(setup.openLiabilityCount).toBe(2);
    });
  });
});
