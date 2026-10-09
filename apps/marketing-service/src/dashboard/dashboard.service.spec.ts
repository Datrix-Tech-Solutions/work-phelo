import { RequestUser } from '@work-phelo/types';
import { Prisma } from '../../prisma/generated/client';
import { MarketingCrmSettingsPermission as P } from '../crm-settings/crm-settings.permissions';
import { DashboardService } from './dashboard.service';

const D = (value: string) => new Prisma.Decimal(value);

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
    marketingClient: { count: jest.Mock; findMany: jest.Mock };
    marketingClientBilling: { findMany: jest.Mock };
    marketingClientProduct: { findMany: jest.Mock; aggregate: jest.Mock };
    marketingPipelineStage: { findMany: jest.Mock };
  };
  let targets: { receivedByEntities: jest.Mock; listOverlapping: jest.Mock };
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
      },
      marketingClientBilling: { findMany: jest.fn().mockResolvedValue([]) },
      marketingClientProduct: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { expectedValue: null } }),
      },
      marketingPipelineStage: { findMany: jest.fn().mockResolvedValue([]) },
    };
    targets = {
      receivedByEntities: jest
        .fn()
        .mockResolvedValue({ amount: '0.00', currency: 'GHS' }),
      listOverlapping: jest.fn().mockResolvedValue([]),
    };
    service = new DashboardService(prisma as never, targets as never);
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

  it('weights each stage by its probability', async () => {
    prisma.marketingPipelineStage.findMany.mockResolvedValue([
      { id: 's-1', name: 'Lead', probability: 10 },
      { id: 's-2', name: 'Proposal', probability: 50 },
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
        weighted: '150.00',
      }),
      expect.objectContaining({
        name: 'Proposal',
        prospects: 1,
        expected: '2000.00',
        weighted: '1000.00',
      }),
    ]);
    expect(pipeline).toEqual(
      expect.objectContaining({
        prospects: 4,
        expected: '3500.00',
        weighted: '1150.00',
      }),
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

  it('reads achieved revenue for each period from Accounting', async () => {
    prisma.marketingClient.findMany.mockResolvedValue([
      { accountingEntityId: 'e-1' },
      { accountingEntityId: 'e-2' },
    ]);
    targets.receivedByEntities
      .mockResolvedValueOnce({ amount: '800.00', currency: 'GHS' })
      .mockResolvedValueOnce({ amount: '500.00', currency: 'GHS' });

    const result = await service.summary(manager, query);

    expect(targets.receivedByEntities).toHaveBeenCalledWith(
      manager,
      ['e-1', 'e-2'],
      { from: '2026-10-01', to: '2026-10-09' },
    );
    expect(result.achievedRevenue).toEqual({
      current: '800.00',
      previous: '500.00',
    });
    expect(result.currency).toBe('GHS');
  });

  it('reports achieved revenue as unavailable when Accounting cannot be reached', async () => {
    prisma.marketingClient.findMany.mockResolvedValue([
      { accountingEntityId: 'e-1' },
    ]);
    targets.receivedByEntities.mockRejectedValue(new Error('down'));

    const result = await service.summary(manager, query);

    expect(result.achievedRevenue).toEqual({ current: null, previous: null });
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
});
