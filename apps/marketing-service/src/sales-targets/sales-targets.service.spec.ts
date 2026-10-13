import { BadRequestException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingClientBillingState,
  Prisma,
} from '../../prisma/generated/client';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { SalesTargetsService } from './sales-targets.service';

const D = (value: string) => new Prisma.Decimal(value);
const invoice = (
  amount: string,
  at: string,
  productId: string | null = null,
  userId = 'rep-1',
) => ({
  amount: D(amount),
  productId,
  createdAt: new Date(`${at}T10:00:00.000Z`),
  clientId: 'c-1',
  client: { assignedUserId: userId },
});

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
    $transaction: jest.Mock;
    marketingClientBilling: { findMany: jest.Mock };
    marketingCrmSettingOption: { findFirst: jest.Mock; findMany: jest.Mock };
  };
  let accounting: { isConfigured: jest.Mock; getOptions: jest.Mock };
  let assignees: { namesFor: jest.Mock; activeUsers: jest.Mock };
  let service: SalesTargetsService;

  beforeEach(() => {
    prisma = {
      marketingSalesTarget: {
        findMany: jest.fn().mockResolvedValue([target()]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
      marketingClientBilling: { findMany: jest.fn().mockResolvedValue([]) },
      marketingCrmSettingOption: {
        findFirst: jest.fn().mockResolvedValue({ id: 'p-1' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'p-1', name: 'Loans' }]),
      },
    };
    accounting = {
      isConfigured: jest.fn().mockReturnValue(true),
      getOptions: jest.fn().mockResolvedValue({ baseCurrency: 'GHS' }),
    };
    assignees = {
      namesFor: jest.fn().mockResolvedValue(new Map([['rep-1', 'Ama Mensah']])),
      activeUsers: jest.fn().mockResolvedValue([
        { userId: 'rep-1', name: 'Ama Mensah' },
        { userId: 'rep-2', name: 'Kofi Boateng' },
      ]),
    };
    service = new SalesTargetsService(
      prisma as never,
      accounting as never,
      assignees as never,
    );
  });

  describe('list', () => {
    it('sums the invoices raised for the rep’s clients within the target dates', async () => {
      prisma.marketingClientBilling.findMany.mockResolvedValue([
        invoice('300.00', '2026-01-01'),
        invoice('200.50', '2026-03-31'),
        // outside the dates, or someone else's
        invoice('900.00', '2025-12-31'),
        invoice('900.00', '2026-04-01'),
        invoice('900.00', '2026-02-01', null, 'rep-2'),
      ]);

      const [row] = await service.list(rep, {});

      expect(prisma.marketingClientBilling.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            state: {
              in: [
                MarketingClientBillingState.SUBMITTED,
                MarketingClientBillingState.POSTED,
              ],
            },
            client: { assignedUserId: { in: ['rep-1'] } },
          },
        }),
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

    it('counts only the invoices raised for the product on a product target', async () => {
      prisma.marketingSalesTarget.findMany.mockResolvedValue([
        target({ productId: 'p-1' }),
      ]);
      prisma.marketingClientBilling.findMany.mockResolvedValue([
        invoice('100.00', '2026-02-01', 'p-1'),
        invoice('50.00', '2026-02-02', 'p-1'),
        invoice('700.00', '2026-02-03', 'p-2'),
        invoice('700.00', '2026-02-04', null),
      ]);

      const [row] = await service.list(rep, {});

      expect(row).toMatchObject({
        productName: 'Loans',
        achieved: '150.00',
      });
    });

    it('is zero when the rep has raised no invoices', async () => {
      const [row] = await service.list(rep, {});

      expect(row.achieved).toBe('0.00');
    });

    it('still shows achieved when the currency cannot be read', async () => {
      accounting.getOptions.mockRejectedValue(new Error('down'));
      prisma.marketingClientBilling.findMany.mockResolvedValue([
        invoice('100.00', '2026-02-01'),
      ]);

      const [row] = await service.list(rep, {});

      expect(row.achieved).toBe('100.00');
      expect(row.currency).toBeNull();
    });
  });

  describe('create', () => {
    const dto = {
      name: 'Q2 revenue',
      userIds: ['rep-1'],
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
      prisma.marketingSalesTarget.findMany.mockResolvedValue([
        { userId: 'rep-1' },
      ]);

      await expect(service.create(manager, dto)).rejects.toThrow(
        'Ama Mensah already has a target',
      );
      expect(prisma.marketingSalesTarget.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          userId: { in: ['rep-1'] },
          productId: null,
          startDate: { lte: new Date('2026-06-30T00:00:00.000Z') },
          endDate: { gte: new Date('2026-04-01T00:00:00.000Z') },
        },
        select: { userId: true },
      });
      expect(prisma.marketingSalesTarget.create).not.toHaveBeenCalled();
    });

    it('sets one target per rep, each of the full amount and sharing the name', async () => {
      prisma.marketingSalesTarget.findMany.mockResolvedValue([]);
      prisma.marketingSalesTarget.create.mockImplementation(
        ({ data }: { data: { userId: string } }) =>
          Promise.resolve(target({ id: `t-${data.userId}`, ...data })),
      );

      const created = await service.create(manager, {
        ...dto,
        userIds: ['rep-1', 'rep-2'],
      });

      expect(prisma.marketingSalesTarget.create).toHaveBeenCalledTimes(2);
      expect(prisma.marketingSalesTarget.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Q2 revenue',
          userId: 'rep-2',
          amount: D('2000'),
        }) as unknown,
      });
      expect(created.map((t) => t.userId)).toEqual(['rep-1', 'rep-2']);
    });

    it('creates nothing when any one rep is not an eligible Marketing user', async () => {
      await expect(
        service.create(manager, { ...dto, userIds: ['rep-1', 'ghost'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.marketingSalesTarget.create).not.toHaveBeenCalled();
    });

    it('rejects a product that is not in CRM Settings', async () => {
      prisma.marketingCrmSettingOption.findFirst.mockResolvedValue(null);

      await expect(
        service.create(manager, { ...dto, productId: 'nope' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
