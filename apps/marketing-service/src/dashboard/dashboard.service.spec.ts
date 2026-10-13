import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { DashboardService } from './dashboard.service';

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
  clientId: `client-of-${userId}`,
  client: { assignedUserId: userId },
});

describe('DashboardService', () => {
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
    permissions: [P.PROSPECTS_VIEW_ALL, P.CLIENTS_VIEW_ALL],
  };

  const query = {
    fromDate: '2026-10-01',
    toDate: '2026-10-09',
    prevFromDate: '2026-09-01',
    prevToDate: '2026-09-09',
  };

  let prisma: {
    marketingProspect: { count: jest.Mock; groupBy: jest.Mock };
    marketingProspectProduct: { aggregate: jest.Mock; findMany: jest.Mock };
    marketingClient: {
      count: jest.Mock;
      findMany: jest.Mock;
      groupBy: jest.Mock;
    };
    marketingClientBilling: { findMany: jest.Mock };
    marketingClientProduct: { findMany: jest.Mock; aggregate: jest.Mock };
    marketingPipelineStage: { findMany: jest.Mock };
    marketingCrmSettingOption: { findMany: jest.Mock };
  };
  let targets: {
    invoiceRows: jest.Mock;
    baseCurrency: jest.Mock;
    listOverlapping: jest.Mock;
  };
  let assignees: { namesFor: jest.Mock };
  let service: DashboardService;

  beforeEach(() => {
    prisma = {
      marketingProspect: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      marketingProspectProduct: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { expectedValue: null } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      marketingClient: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      marketingClientBilling: { findMany: jest.fn().mockResolvedValue([]) },
      marketingClientProduct: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { expectedValue: null } }),
      },
      marketingPipelineStage: { findMany: jest.fn().mockResolvedValue([]) },
      marketingCrmSettingOption: { findMany: jest.fn().mockResolvedValue([]) },
    };
    targets = {
      invoiceRows: jest.fn().mockResolvedValue([]),
      baseCurrency: jest.fn().mockResolvedValue('GHS'),
      listOverlapping: jest.fn().mockResolvedValue([]),
    };
    assignees = {
      namesFor: jest.fn().mockResolvedValue(new Map<string, string>()),
    };
    service = new DashboardService(
      prisma as never,
      targets as never,
      assignees as never,
    );
  });

  it('dates a won deal by its first posted transaction and values it at the expected value', async () => {
    prisma.marketingClientBilling.findMany.mockResolvedValue([
      // first posted in the period, then posted again later
      { clientId: 'c-1', productId: 'p-1', updatedAt: new Date('2026-10-05') },
      { clientId: 'c-1', productId: 'p-1', updatedAt: new Date('2026-10-08') },
      // first posted last month
      { clientId: 'c-2', productId: 'p-1', updatedAt: new Date('2026-09-03') },
      // no value carried over
      { clientId: 'c-3', productId: 'p-2', updatedAt: new Date('2026-10-02') },
    ]);
    prisma.marketingClientProduct.findMany.mockResolvedValue([
      { clientId: 'c-1', productId: 'p-1', expectedValue: D('1000') },
      { clientId: 'c-2', productId: 'p-1', expectedValue: D('400') },
      { clientId: 'c-3', productId: 'p-2', expectedValue: null },
      // Purchased but never posted (should not happen) is ignored
      { clientId: 'c-4', productId: 'p-1', expectedValue: D('9999') },
    ]);

    const result = await service.summary(manager, query);

    expect(result.sales.won).toBe('1000.00');
    expect(result.sales.wonDeals).toBe(2);
    expect(result.sales.previousWon).toBe('400.00');
  });

  it('adds up expected value from unconverted prospects and pending client products', async () => {
    prisma.marketingClientProduct.aggregate.mockResolvedValue({
      _sum: { expectedValue: D('250.50') },
    });
    prisma.marketingProspectProduct.aggregate.mockResolvedValue({
      _sum: { expectedValue: D('100') },
    });

    const result = await service.summary(manager, query);

    expect(result.sales.expected).toBe('350.50');
  });

  it('reports each stage’s prospects, expected revenue and average per prospect', async () => {
    prisma.marketingPipelineStage.findMany.mockResolvedValue([
      { id: 's-1', name: 'Lead', probability: 10 },
      { id: 's-2', name: 'Proposal', probability: 50 },
      { id: 's-3', name: 'Negotiation', probability: 80 },
    ]);
    prisma.marketingProspect.groupBy.mockResolvedValue([
      { pipelineStageId: 's-1', _count: { _all: 3 } },
      { pipelineStageId: 's-2', _count: { _all: 1 } },
    ]);
    prisma.marketingProspectProduct.findMany.mockResolvedValue([
      { expectedValue: D('1000'), prospect: { pipelineStageId: 's-1' } },
      { expectedValue: D('500'), prospect: { pipelineStageId: 's-1' } },
      { expectedValue: D('2000'), prospect: { pipelineStageId: 's-2' } },
    ]);

    const { pipeline } = await service.summary(manager, query);

    expect(pipeline.stages).toEqual([
      expect.objectContaining({
        name: 'Lead',
        prospects: 3,
        expected: '1500.00',
        average: '500.00',
      }),
      expect.objectContaining({
        name: 'Proposal',
        prospects: 1,
        expected: '2000.00',
        average: '2000.00',
      }),
      // a stage with no prospects has nothing to average
      expect.objectContaining({
        name: 'Negotiation',
        prospects: 0,
        expected: '0.00',
        average: '0.00',
      }),
    ]);
    expect(pipeline).toEqual(
      expect.objectContaining({ prospects: 4, expected: '3500.00' }),
    );
  });

  it('only counts open prospects created in the period toward the pipeline', async () => {
    await service.summary(manager, query);

    const [grouped] = prisma.marketingProspect.groupBy.mock.calls[0] as [
      {
        where: {
          client: unknown;
          createdAt: { gte: Date; lt: Date };
        };
      },
    ];
    expect(grouped.where.client).toEqual({ is: null });
    expect(grouped.where.createdAt.gte.toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
    expect(grouped.where.createdAt.lt.toISOString()).toBe(
      '2026-10-10T00:00:00.000Z',
    );
  });

  it('counts conversions among the prospects created in the period', async () => {
    prisma.marketingProspect.count.mockImplementation(
      ({ where }: { where: { client?: unknown } }) =>
        Promise.resolve(where.client ? 3 : 12),
    );

    const result = await service.summary(manager, query);

    expect(result.conversion).toEqual({
      created: 12,
      converted: 3,
      previousCreated: 12,
      previousConverted: 3,
    });
  });

  it('limits a user without view-all to their own prospects and clients', async () => {
    await service.summary(rep, query);

    for (const mock of [
      prisma.marketingProspect.count,
      prisma.marketingClient.count,
    ]) {
      const calls = mock.mock.calls as [{ where: Record<string, unknown> }][];
      expect(calls.length).toBeGreaterThan(0);
      for (const [args] of calls) {
        expect(args.where.assignedUserId).toBe('rep-1');
      }
    }
  });

  it('does not limit a user with view-all', async () => {
    await service.summary(manager, query);

    for (const [args] of prisma.marketingProspect.count.mock.calls as [
      { where: Record<string, unknown> },
    ][]) {
      expect(args.where).not.toHaveProperty('assignedUserId');
    }
  });

  it('adds up the invoices raised in each period', async () => {
    targets.invoiceRows.mockResolvedValue([
      invoice('500.00', '2026-10-03'),
      invoice('300.00', '2026-10-09'),
      invoice('200.00', '2026-09-05'),
      invoice('999.00', '2026-08-01'),
    ]);

    const result = await service.summary(manager, query);

    expect(result.achievedRevenue).toEqual({
      current: '800.00',
      previous: '200.00',
    });
    expect(result.currency).toBe('GHS');
  });

  it('still reports achieved revenue when the currency cannot be read', async () => {
    targets.invoiceRows.mockResolvedValue([invoice('100.00', '2026-10-03')]);
    targets.baseCurrency.mockResolvedValue(null);

    const result = await service.summary(manager, query);

    expect(result.achievedRevenue.current).toBe('100.00');
    expect(result.currency).toBeNull();
  });

  it('counts a rep’s all-products target instead of also adding their product targets', async () => {
    targets.listOverlapping.mockResolvedValue([
      {
        userId: 'rep-1',
        productId: null,
        amount: '1000.00',
        achieved: '400.00',
      },
      {
        userId: 'rep-1',
        productId: 'p-1',
        amount: '600.00',
        achieved: '300.00',
      },
      {
        userId: 'rep-2',
        productId: 'p-1',
        amount: '500.00',
        achieved: '100.00',
      },
      {
        userId: 'rep-2',
        productId: 'p-2',
        amount: '500.00',
        achieved: '200.00',
      },
    ]);

    const { targets: progress } = await service.summary(manager, query);

    expect(progress).toEqual({
      count: 3,
      target: '2000.00',
      achieved: '700.00',
      remaining: '1300.00',
      percent: 35,
    });
  });

  it('leaves target progress unavailable when any achieved figure is', async () => {
    targets.listOverlapping.mockResolvedValue([
      { userId: 'rep-1', productId: null, amount: '1000.00', achieved: null },
    ]);

    const { targets: progress } = await service.summary(manager, query);

    expect(progress).toEqual({
      count: 1,
      target: '1000.00',
      achieved: null,
      remaining: null,
      percent: null,
    });
  });

  it('counts clients as billable and non-billable', async () => {
    prisma.marketingClient.count.mockImplementation(
      ({ where }: { where: { isBillable?: boolean; createdAt?: unknown } }) =>
        Promise.resolve(where.isBillable ? 4 : where.createdAt ? 2 : 10),
    );

    const { clients } = await service.summary(manager, query);

    expect(clients).toEqual({ total: 10, new: 2, billable: 4, nonBillable: 6 });
  });

  describe('growth', () => {
    it('counts prospects and clients created in each range', async () => {
      prisma.marketingProspect.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2);
      prisma.marketingClient.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      const result = await service.growth(manager, {
        ranges: '2026-09-01:2026-09-30,2026-10-01:2026-10-31',
      });

      expect(result).toEqual([
        {
          fromDate: '2026-09-01',
          toDate: '2026-09-30',
          newProspects: 5,
          newClients: 1,
        },
        {
          fromDate: '2026-10-01',
          toDate: '2026-10-31',
          newProspects: 2,
          newClients: 0,
        },
      ]);
    });

    it('includes the last day of the range', async () => {
      await service.growth(manager, { ranges: '2026-10-01:2026-10-31' });

      const [args] = prisma.marketingProspect.count.mock.calls[0] as [
        { where: { createdAt: { gte: Date; lt: Date } } },
      ];
      expect(args.where.createdAt.gte.toISOString()).toBe(
        '2026-10-01T00:00:00.000Z',
      );
      expect(args.where.createdAt.lt.toISOString()).toBe(
        '2026-11-01T00:00:00.000Z',
      );
    });

    it('limits a user without view-all to their own prospects and clients', async () => {
      await service.growth(rep, { ranges: '2026-10-01:2026-10-31' });

      for (const mock of [
        prisma.marketingProspect.count,
        prisma.marketingClient.count,
      ]) {
        const [args] = mock.mock.calls[0] as [
          { where: Record<string, unknown> },
        ];
        expect(args.where.assignedUserId).toBe('rep-1');
      }
    });

    it('rejects a range that ends before it starts', async () => {
      await expect(
        service.growth(manager, { ranges: '2026-10-31:2026-10-01' }),
      ).rejects.toThrow('ends before it starts');
    });
  });

  describe('revenueByProduct', () => {
    const range = { fromDate: '2026-10-01', toDate: '2026-10-10' };

    it('adds up the invoices raised in the period for the product each was raised for', async () => {
      targets.invoiceRows.mockResolvedValue([
        invoice('300.00', '2026-10-02', 'p-1'),
        invoice('200.00', '2026-10-10', 'p-1'),
        invoice('900.00', '2026-10-05', 'p-2'),
        invoice('50.00', '2026-10-06', null),
        // outside the period
        invoice('7000.00', '2026-09-30', 'p-1'),
      ]);
      prisma.marketingCrmSettingOption.findMany.mockResolvedValue([
        { id: 'p-1', name: 'Loans' },
        { id: 'p-2', name: 'Savings' },
      ]);

      const result = await service.revenueByProduct(manager, range);

      expect(result).toEqual({
        currency: 'GHS',
        total: '1450.00',
        products: [
          { productId: 'p-2', name: 'Savings', amount: '900.00' },
          { productId: 'p-1', name: 'Loans', amount: '500.00' },
          { productId: null, name: 'No product', amount: '50.00' },
        ],
      });
    });

    it('returns nothing when no invoice was raised', async () => {
      const result = await service.revenueByProduct(manager, range);

      expect(result).toEqual({ currency: 'GHS', total: '0.00', products: [] });
    });

    it('limits a user without view-all to their own clients', async () => {
      await service.revenueByProduct(rep, range);

      expect(targets.invoiceRows).toHaveBeenCalledWith('tenant-1', {
        assignedUserId: 'rep-1',
      });
    });
  });

  describe('salesPersonnel', () => {
    const range = { fromDate: '2026-10-01', toDate: '2026-10-09' };

    it('brings each rep’s counts, expected value and achieved revenue together', async () => {
      prisma.marketingProspect.groupBy
        .mockResolvedValueOnce([
          { assignedUserId: 'rep-1', _count: { _all: 4 } },
        ])
        .mockResolvedValueOnce([
          { assignedUserId: 'rep-1', _count: { _all: 8 } },
        ])
        .mockResolvedValueOnce([
          { assignedUserId: 'rep-1', _count: { _all: 2 } },
        ]);
      prisma.marketingClient.groupBy.mockResolvedValue([
        { assignedUserId: 'rep-1', _count: { _all: 2 } },
        { assignedUserId: 'rep-2', _count: { _all: 1 } },
      ]);
      prisma.marketingClientProduct.findMany.mockResolvedValue([
        { expectedValue: D('100'), client: { assignedUserId: 'rep-1' } },
        { expectedValue: null, client: { assignedUserId: 'rep-1' } },
      ]);
      prisma.marketingProspectProduct.findMany.mockResolvedValue([
        { expectedValue: D('50.5'), prospect: { assignedUserId: 'rep-1' } },
      ]);
      targets.invoiceRows.mockResolvedValue([
        invoice('600.00', '2026-10-02'),
        invoice('300.00', '2026-10-08'),
        // outside the period
        invoice('5000.00', '2026-09-20'),
      ]);
      assignees.namesFor.mockResolvedValue(new Map([['rep-1', 'Ama Mensah']]));

      const result = await service.salesPersonnel(manager, range);

      expect(result.currency).toBe('GHS');
      expect(result.reps).toEqual(
        expect.arrayContaining([
          {
            userId: 'rep-1',
            name: 'Ama Mensah',
            prospects: 4,
            clients: 2,
            created: 8,
            converted: 2,
            conversion: 25,
            expected: '150.50',
            achieved: '900.00',
          },
          {
            userId: 'rep-2',
            name: 'Unknown user',
            prospects: 0,
            clients: 1,
            created: 0,
            converted: 0,
            conversion: null,
            expected: '0.00',
            achieved: '0.00',
          },
        ]),
      );
    });

    it('counts a reversed or rejected invoice as nothing', async () => {
      prisma.marketingClient.groupBy.mockResolvedValue([
        { assignedUserId: 'rep-1', _count: { _all: 1 } },
      ]);
      // invoiceRows only ever returns live invoices; asking for them is what keeps the rest out.
      await service.salesPersonnel(manager, range);

      expect(targets.invoiceRows).toHaveBeenCalledWith('tenant-1', {});
    });

    it('limits a user without view-all to their own records', async () => {
      await service.salesPersonnel(rep, range);

      const [args] = prisma.marketingClient.groupBy.mock.calls[0] as [
        { where: { assignedUserId: string } },
      ];
      expect(args.where.assignedUserId).toBe('rep-1');
    });
  });
});
