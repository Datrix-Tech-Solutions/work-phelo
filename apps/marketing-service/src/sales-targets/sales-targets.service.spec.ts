import { BadRequestException, ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { SalesTargetsService } from './sales-targets.service';

const D = (value: string) => new Prisma.Decimal(value);

describe('SalesTargetsService', () => {
  const rep: RequestUser = {
    id: 'rep-1',
    tenantId: 'tenant-1',
    email: 'rep@example.com',
    role: 'EMPLOYEE',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    firstName: 'Ama',
    moduleConfig: {},
    featureConfig: {},
    integrationConfig: {},
    permissions: [],
  };
  const manager: RequestUser = {
    ...rep,
    id: 'mgr-1',
    permissions: [P.TARGETS_VIEW_ALL, P.TARGETS_CREATE, P.TARGETS_EDIT],
  };

  const target = (overrides: object = {}) => ({
    id: 't-1',
    tenantId: 'tenant-1',
    userId: 'rep-1',
    productId: null,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-03-31T00:00:00.000Z'),
    amount: D('1000'),
    createdAt: new Date(),
    ...overrides,
  });

  let prisma: {
    marketingSalesTarget: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    marketingClient: { findMany: jest.Mock };
    marketingClientBilling: { findMany: jest.Mock };
    marketingCrmSettingOption: { findFirst: jest.Mock; findMany: jest.Mock };
  };
  let accounting: { receiptsSummary: jest.Mock };
  let assignees: { namesFor: jest.Mock; activeUsers: jest.Mock };
  let service: SalesTargetsService;

  beforeEach(() => {
    prisma = {
      marketingSalesTarget: {
        findMany: jest.fn().mockResolvedValue([target()]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      marketingClient: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'c-1', assignedUserId: 'rep-1', accountingEntityId: 'e-1' },
          { id: 'c-2', assignedUserId: 'rep-1', accountingEntityId: 'e-2' },
        ]),
      },
      marketingClientBilling: { findMany: jest.fn().mockResolvedValue([]) },
      marketingCrmSettingOption: {
        findFirst: jest.fn().mockResolvedValue({ id: 'p-1' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'p-1', name: 'Loans' }]),
      },
    };
    accounting = {
      receiptsSummary: jest.fn().mockResolvedValue({
        currency: 'GHS',
        entities: [
          { entityId: 'e-1', receivedAmount: '300.00' },
          { entityId: 'e-2', receivedAmount: '200.50' },
        ],
        transactions: [],
      }),
    };
    assignees = {
      namesFor: jest.fn().mockResolvedValue(new Map([['rep-1', 'Ama Mensah']])),
      activeUsers: jest.fn().mockResolvedValue([{ userId: 'rep-1' }]),
    };
    service = new SalesTargetsService(
      prisma as never,
      accounting as never,
      assignees as never,
    );
  });

  describe('list', () => {
    it('sums received money for the rep’s billable clients within the target dates', async () => {
      const [row] = await service.list(rep, {});

      expect(accounting.receiptsSummary).toHaveBeenCalledWith(
        {
          tenantId: 'tenant-1',
          entityIds: ['e-1', 'e-2'],
          from: '2026-01-01',
          to: '2026-03-31',
        },
        'rep-1',
      );
      expect(row).toMatchObject({
        userName: 'Ama Mensah',
        amount: '1000.00',
        achieved: '500.50',
        remaining: '499.50',
        percent: 50.1,
        currency: 'GHS',
        canEdit: false,
      });
    });

    it('shows a rep only their own targets', async () => {
      await service.list(rep, {});

      expect(prisma.marketingSalesTarget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', userId: 'rep-1' },
        }),
      );
    });

    it('lets a viewer of all targets see every rep', async () => {
      await service.list(manager, {});

      expect(prisma.marketingSalesTarget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
      );
    });

    it('counts only the transactions raised for the product on a product target', async () => {
      prisma.marketingSalesTarget.findMany.mockResolvedValue([
        target({ productId: 'p-1' }),
      ]);
      prisma.marketingClientBilling.findMany.mockResolvedValue([
        { clientId: 'c-1', productId: 'p-1', accountingTransactionId: 'tx-1' },
        { clientId: 'c-2', productId: 'p-1', accountingTransactionId: 'tx-2' },
      ]);
      accounting.receiptsSummary.mockResolvedValue({
        currency: 'GHS',
        entities: [],
        transactions: [
          { transactionId: 'tx-1', receivedAmount: '100.00' },
          { transactionId: 'tx-2', receivedAmount: '50.00' },
        ],
      });

      const [row] = await service.list(rep, {});

      expect(accounting.receiptsSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionIds: ['tx-1', 'tx-2'],
          from: '2026-01-01',
          to: '2026-03-31',
        }),
        'rep-1',
      );
      expect(row).toMatchObject({
        productName: 'Loans',
        achieved: '150.00',
      });
    });

    it('is zero without calling Accounting when the rep has no billable clients', async () => {
      prisma.marketingClient.findMany.mockResolvedValue([]);

      const [row] = await service.list(rep, {});

      expect(accounting.receiptsSummary).not.toHaveBeenCalled();
      expect(row.achieved).toBe('0.00');
    });

    it('leaves achieved empty, not zero, when Accounting is unreachable', async () => {
      accounting.receiptsSummary.mockRejectedValue(new Error('down'));

      const [row] = await service.list(rep, {});

      expect(row.achieved).toBeNull();
      expect(row.percent).toBeNull();
    });
  });

  describe('create', () => {
    const dto = {
      userId: 'rep-1',
      startDate: '2026-04-01',
      endDate: '2026-06-30',
      amount: 2000,
    };

    it('rejects a period that ends before it starts', async () => {
      await expect(
        service.create(manager, { ...dto, endDate: '2026-03-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects someone who is not an active Marketing user', async () => {
      assignees.activeUsers.mockResolvedValue([]);

      await expect(service.create(manager, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an overlapping target for the same rep and product', async () => {
      prisma.marketingSalesTarget.findFirst.mockResolvedValue({ id: 'other' });

      await expect(service.create(manager, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.marketingSalesTarget.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          userId: 'rep-1',
          productId: null,
          startDate: { lte: new Date('2026-06-30T00:00:00.000Z') },
          endDate: { gte: new Date('2026-04-01T00:00:00.000Z') },
        },
        select: { id: true },
      });
    });

    it('rejects a product that is not in CRM Settings', async () => {
      prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);

      await expect(
        service.create(manager, { ...dto, productId: 'nope' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
