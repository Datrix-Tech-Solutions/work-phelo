import { TripScheduleService } from './trip-schedule.service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const at = (date: string) => new Date(`${date}T00:00:00.000Z`);

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    travelDate: at('2026-10-20'),
    departureTime: '10:00',
    returnTime: '12:00',
    destination: 'Kumasi',
    requesterName: 'Efua',
    vehicleAssetId: 'veh-1',
    vehicleName: 'Toyota Hilux',
    vehicleAssetNumber: 'VEH-1',
    driverEmployeeId: 'e1',
    driverName: 'Ama Mensah',
    selfDriven: false,
    startedAt: null,
    ...overrides,
  };
}

describe('TripScheduleService', () => {
  const prisma = {
    marketingTransportRequest: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new TripScheduleService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
    // Pin "now" to 20 Oct 2026, 11:00 in the business timezone.
    jest
      .spyOn(service, 'now')
      .mockReturnValue({ date: '2026-10-20', time: '11:00' });
  });

  it('keeps old unresolved trips: nothing limits how far back it looks', async () => {
    prisma.marketingTransportRequest.findMany.mockResolvedValue([]);

    await service.activeTrips(TENANT);

    const { where } = (
      prisma.marketingTransportRequest.findMany.mock.calls[0] as [
        { where: Record<string, unknown> },
      ]
    )[0];
    expect(where).toMatchObject({ tenantId: TENANT, status: 'APPROVED' });
    expect(where).not.toHaveProperty('travelDate');
  });

  const STARTED = new Date('2026-10-20T10:05:00.000Z');

  it('marks a trip on route only once it is started, whatever the clock says', async () => {
    prisma.marketingTransportRequest.findMany.mockResolvedValue([
      row({ id: 'started', startedAt: STARTED }),
      row({ id: 'not-started', departureTime: '09:00', returnTime: '10:00' }),
    ]);

    const trips = await service.activeTrips(TENANT);

    expect(trips.map((t) => [t.requestId, t.state, t.overdue])).toEqual([
      ['started', 'ON_ROUTE', false],
      ['not-started', 'BOOKED', false],
    ]);
  });

  it('flags a started trip overdue once its return time has passed, however old', async () => {
    prisma.marketingTransportRequest.findMany.mockResolvedValue([
      row({
        id: 'today-late',
        departureTime: '08:00',
        returnTime: '10:30',
        startedAt: STARTED,
      }),
      row({
        id: 'last-week',
        travelDate: at('2026-10-13'),
        startedAt: STARTED,
      }),
    ]);

    const trips = await service.activeTrips(TENANT);

    expect(trips.map((t) => [t.requestId, t.state, t.overdue])).toEqual([
      ['today-late', 'ON_ROUTE', true],
      ['last-week', 'ON_ROUTE', true],
    ]);
  });

  it('describes the vehicle and driver, including a self-driven requester', async () => {
    prisma.marketingTransportRequest.findMany.mockResolvedValue([
      row({ selfDriven: true, driverEmployeeId: null, driverName: 'Efua' }),
    ]);

    const [trip] = await service.activeTrips(TENANT);

    expect(trip.vehicle).toEqual({
      assetId: 'veh-1',
      name: 'Toyota Hilux',
      assetNumber: 'VEH-1',
    });
    expect(trip.driver).toEqual({ employeeId: null, name: 'Efua' });
    expect(trip.selfDriven).toBe(true);
  });

  it('limits the query to the given vehicles and drivers', async () => {
    prisma.marketingTransportRequest.findMany.mockResolvedValue([]);

    await service.activeTrips(TENANT, {
      vehicleAssetIds: ['veh-1'],
      driverEmployeeIds: ['e1'],
    });

    const { where } = (
      prisma.marketingTransportRequest.findMany.mock.calls[0] as [
        { where: Record<string, unknown> },
      ]
    )[0];
    expect(where.OR).toEqual([
      { vehicleAssetId: { in: ['veh-1'] } },
      { driverEmployeeId: { in: ['e1'] } },
    ]);
  });

  it('does not query at all when asked about no vehicles or drivers', async () => {
    const trips = await service.activeTrips(TENANT, { vehicleAssetIds: [] });

    expect(trips).toEqual([]);
    expect(prisma.marketingTransportRequest.findMany).not.toHaveBeenCalled();
  });

  describe('completedTrips', () => {
    const completed = (overrides: Record<string, unknown> = {}) =>
      row({
        id: 'done-1',
        status: 'COMPLETED',
        travelDate: at('2026-10-10'),
        returnTime: '12:00',
        actualReturnTime: '12:40',
        completedAt: new Date('2026-10-10T13:00:00.000Z'),
        ...overrides,
      });

    it('lists only completed trips for the given vehicle, most recent first', async () => {
      prisma.marketingTransportRequest.count.mockResolvedValue(1);
      prisma.marketingTransportRequest.findMany.mockResolvedValue([
        completed(),
      ]);

      await service.completedTrips(TENANT, { vehicleAssetId: 'veh-1' });

      const [query] = prisma.marketingTransportRequest.findMany.mock
        .calls[0] as [{ where: unknown; orderBy: unknown }];
      expect(query.where).toEqual({
        tenantId: TENANT,
        status: 'COMPLETED',
        vehicleAssetId: 'veh-1',
      });
      expect(query.orderBy).toEqual([
        { travelDate: 'desc' },
        { departureTime: 'desc' },
        { id: 'asc' },
      ]);
    });

    it('lists the trips a driver has driven', async () => {
      prisma.marketingTransportRequest.count.mockResolvedValue(0);
      prisma.marketingTransportRequest.findMany.mockResolvedValue([]);

      await service.completedTrips(TENANT, { driverEmployeeId: 'e1' });

      const [query] = prisma.marketingTransportRequest.findMany.mock
        .calls[0] as [{ where: unknown }];
      expect(query.where).toEqual({
        tenantId: TENANT,
        status: 'COMPLETED',
        driverEmployeeId: 'e1',
      });
    });

    it('reports how each trip compared with its plan', async () => {
      prisma.marketingTransportRequest.count.mockResolvedValue(3);
      prisma.marketingTransportRequest.findMany.mockResolvedValue([
        completed({ id: 'late', actualReturnTime: '12:40' }),
        completed({ id: 'early', actualReturnTime: '11:30' }),
        completed({ id: 'unknown', actualReturnTime: null }),
      ]);

      const { data } = await service.completedTrips(TENANT, {
        vehicleAssetId: 'veh-1',
      });

      expect(data.map((t) => [t.requestId, t.minutesLate])).toEqual([
        ['late', 40],
        ['early', -30],
        ['unknown', null],
      ]);
      expect(data[0]).toMatchObject({
        travelDate: '2026-10-10',
        destination: 'Kumasi',
        actualReturnTime: '12:40',
        vehicleName: 'Toyota Hilux',
        driverName: 'Ama Mensah',
        requesterName: 'Efua',
      });
    });

    it('pages the results', async () => {
      prisma.marketingTransportRequest.count.mockResolvedValue(25);
      prisma.marketingTransportRequest.findMany.mockResolvedValue([]);

      const result = await service.completedTrips(
        TENANT,
        { vehicleAssetId: 'veh-1' },
        3,
        10,
      );

      const [query] = prisma.marketingTransportRequest.findMany.mock
        .calls[0] as [{ skip: number; take: number }];
      expect(query).toMatchObject({ skip: 20, take: 10 });
      expect(result.meta).toEqual({
        page: 3,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });
  });
});
