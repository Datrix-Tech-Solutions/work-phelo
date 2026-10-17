import { BadGatewayException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { TransportDashboardService } from './transport-dashboard.service';

const user = { id: 'u1', tenantId: 'tenant-1' } as RequestUser;
const query = {
  fromDate: '2026-10-01',
  toDate: '2026-10-31',
  prevFromDate: '2026-09-01',
  prevToDate: '2026-09-30',
};

const trip = (overrides: Record<string, unknown> = {}) => ({
  requestId: 'req-1',
  travelDate: '2026-10-17',
  departureTime: '09:00',
  returnTime: '12:00',
  destination: 'Kumasi',
  requesterName: 'Efua',
  vehicle: { assetId: 'v1', name: 'Hilux', assetNumber: 'VEH-1' },
  driver: null,
  selfDriven: false,
  state: 'BOOKED',
  overdue: false,
  ...overrides,
});

const vehicle = (overrides: Record<string, unknown> = {}) => ({
  assetId: 'v1',
  assetNumber: 'VEH-1',
  name: 'Hilux',
  make: 'Toyota',
  model: 'Hilux',
  status: 'AVAILABLE',
  documentAlerts: [],
  ...overrides,
});

describe('TransportDashboardService', () => {
  const prisma = {
    marketingTransportRequest: { count: jest.fn(), findMany: jest.fn() },
  };
  const trips = { activeTrips: jest.fn(), now: jest.fn() };
  const fleet = { list: jest.fn() };
  const service = new TransportDashboardService(
    prisma as never,
    trips as never,
    fleet as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    trips.now.mockReturnValue({ date: '2026-10-17', time: '10:00' });
    trips.activeTrips.mockResolvedValue([]);
    prisma.marketingTransportRequest.count.mockResolvedValue(0);
    prisma.marketingTransportRequest.findMany.mockResolvedValue([]);
    fleet.list.mockResolvedValue({ data: [] });
  });

  describe('summary', () => {
    it('counts today, on route and overdue trips from the active trips', async () => {
      trips.activeTrips.mockResolvedValue([
        trip({ requestId: 'a', travelDate: '2026-10-17' }),
        trip({ requestId: 'b', travelDate: '2026-10-18' }),
        trip({
          requestId: 'c',
          travelDate: '2026-10-16',
          state: 'ON_ROUTE',
          overdue: true,
        }),
      ]);

      const { kpis, attention, tripsToday } = await service.summary(
        user,
        query,
      );

      expect(kpis).toMatchObject({ tripsToday: 1, onRoute: 1, overdue: 1 });
      expect(tripsToday).toEqual([
        expect.objectContaining({
          requestId: 'a',
          destination: 'Kumasi',
          vehicleName: 'Hilux',
          state: 'BOOKED',
          departureTime: '09:00',
        }),
      ]);
      expect(attention.overdueTrips).toEqual([
        expect.objectContaining({
          requestId: 'c',
          destination: 'Kumasi',
          vehicleName: 'Hilux',
        }),
      ]);
    });

    it('lists the oldest pending requests and counts them all', async () => {
      prisma.marketingTransportRequest.count.mockResolvedValueOnce(7);
      prisma.marketingTransportRequest.findMany.mockResolvedValue([
        {
          id: 'r1',
          requesterName: 'Kofi',
          destination: 'Tema',
          travelDate: new Date('2026-10-20T00:00:00.000Z'),
          departureTime: '08:00',
          createdAt: new Date('2026-10-10T08:00:00.000Z'),
        },
      ]);

      const { kpis, pendingRequests } = await service.summary(user, query);

      expect(kpis.pending).toBe(7);
      expect(pendingRequests).toEqual([
        expect.objectContaining({ requestId: 'r1', travelDate: '2026-10-20' }),
      ]);
      const listing = prisma.marketingTransportRequest.findMany.mock
        .calls[0] as [{ orderBy: unknown; take: number }];
      expect(listing[0].take).toBe(8);
    });

    it('compares completed and closed requests with the previous period', async () => {
      // count order: pending, completed, completed before, closed, closed before.
      prisma.marketingTransportRequest.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(9)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(4);

      const { kpis } = await service.summary(user, query);

      expect(kpis.completed).toEqual({ current: 12, previous: 9 });
      expect(kpis.closed).toEqual({ current: 3, previous: 4 });
    });

    it('summarises the fleet and ranks vehicles by the nearest expiry', async () => {
      fleet.list.mockResolvedValue({
        data: [
          vehicle({ assetId: 'v1' }),
          vehicle({ assetId: 'v2', status: 'BOOKED' }),
          vehicle({
            assetId: 'v3',
            status: 'DOCUMENTS_EXPIRED',
            documentAlerts: [
              {
                label: 'Insurance',
                state: 'EXPIRED',
                expiresOn: '2026-10-10',
                daysLeft: -7,
              },
            ],
          }),
          vehicle({
            assetId: 'v4',
            documentAlerts: [
              {
                label: 'Safety certificate',
                state: 'EXPIRING_SOON',
                expiresOn: '2026-10-25',
                daysLeft: 8,
              },
            ],
          }),
          vehicle({ assetId: 'v5', status: 'MAINTENANCE' }),
          vehicle({ assetId: 'v6', status: 'RETIRED' }),
        ],
      });

      const { fleet: counts, attention } = await service.summary(user, query);

      expect(counts).toEqual({
        total: 5,
        available: 2,
        booked: 1,
        onRoute: 0,
        documentsExpired: 1,
        maintenance: 1,
      });
      expect(attention.vehicleDocuments.map((v) => v.assetId)).toEqual([
        'v3',
        'v4',
      ]);
      expect(attention.vehicleDocuments[0].name).toBe('Toyota Hilux');
      expect(attention.maintenance.map((v) => v.assetId)).toEqual(['v5']);
    });

    it('still answers, without fleet figures, when the fleet cannot be read', async () => {
      fleet.list.mockRejectedValue(new BadGatewayException('HR down'));

      const result = await service.summary(user, query);

      expect(result.fleet).toBeNull();
      expect(result.attention.vehicleDocuments).toEqual([]);
      expect(result.kpis.pending).toBe(0);
    });

    it('is scoped to the tenant', async () => {
      await service.summary(user, query);

      for (const [arg] of prisma.marketingTransportRequest.count.mock
        .calls as Array<[{ where: Record<string, unknown> }]>) {
        expect(arg.where.tenantId).toBe('tenant-1');
      }
      expect(trips.activeTrips).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('trend', () => {
    it('counts requests raised and trips completed per range', async () => {
      // per range the order is requested, completed.
      prisma.marketingTransportRequest.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(6);

      const result = await service.trend(user, {
        ranges: '2026-09-01:2026-09-30,2026-10-01:2026-10-31',
      });

      expect(result).toEqual([
        {
          fromDate: '2026-09-01',
          toDate: '2026-09-30',
          requested: 5,
          completed: 3,
        },
        {
          fromDate: '2026-10-01',
          toDate: '2026-10-31',
          requested: 8,
          completed: 6,
        },
      ]);
    });

    it('rejects a range that ends before it starts', async () => {
      await expect(
        service.trend(user, { ranges: '2026-10-31:2026-10-01' }),
      ).rejects.toThrow(/ends before it starts/);
    });
  });
});
