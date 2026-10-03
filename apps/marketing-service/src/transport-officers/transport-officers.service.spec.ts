import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InternalServiceClientError } from '@work-phelo/internal-auth';
import { RequestUser } from '@work-phelo/types';
import { TransportOfficersService } from './transport-officers.service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const user = { id: 'user-1', tenantId: TENANT } as RequestUser;

const person = (
  id: string,
  name: string,
  department: string | null = null,
) => ({
  employeeId: id,
  name,
  department,
  jobTitle: 'Driver',
  email: `${id}@example.com`,
});

function officer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'off-1',
    tenantId: TENANT,
    employeeId: 'e1',
    name: 'Ama Mensah',
    isActive: true,
    deactivatedAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('TransportOfficersService', () => {
  const prisma = {
    marketingTransportOfficer: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const directory = { list: jest.fn(), resolve: jest.fn() };
  const trips = { activeTrips: jest.fn(), completedTrips: jest.fn() };
  const service = new TransportOfficersService(
    prisma as never,
    directory as never,
    trips as never,
  );

  const trip = (employeeId: string, state: string, requestId = 'req-1') => ({
    requestId,
    travelDate: '2026-10-20',
    departureTime: '10:00',
    returnTime: '12:00',
    destination: 'Kumasi',
    requesterName: 'Efua',
    vehicle: { assetId: 'v1', name: 'Toyota Hilux', assetNumber: 'VEH-1' },
    driver: { employeeId, name: 'Driver' },
    selfDriven: false,
    state,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    trips.activeTrips.mockResolvedValue([]);
    prisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
  });

  describe('list', () => {
    it('shows live HR details and flags officers who left HR', async () => {
      prisma.marketingTransportOfficer.findMany.mockResolvedValue([
        officer(),
        officer({ id: 'off-2', employeeId: 'gone', name: 'Old Driver' }),
      ]);
      directory.list.mockResolvedValue([
        person('e1', 'Ama Mensah-Owusu', 'Ops'),
      ]);

      const { data } = await service.list(user);

      expect(data[0]).toMatchObject({
        name: 'Ama Mensah-Owusu',
        department: 'Ops',
        jobTitle: 'Driver',
        employeeActive: true,
      });
      expect(data[1]).toMatchObject({
        name: 'Old Driver',
        department: null,
        employeeActive: false,
      });
    });

    it('lists active officers first, then filters by status and search', async () => {
      prisma.marketingTransportOfficer.findMany.mockResolvedValue([
        officer({ id: 'a', employeeId: 'e1', name: 'Zed', isActive: false }),
        officer({ id: 'b', employeeId: 'e2', name: 'Kofi' }),
        officer({ id: 'c', employeeId: 'e3', name: 'Ama' }),
      ]);
      directory.list.mockResolvedValue([
        person('e1', 'Zed'),
        person('e2', 'Kofi', 'Transport'),
        person('e3', 'Ama'),
      ]);

      const all = await service.list(user);
      expect(all.data.map((o) => o.name)).toEqual(['Ama', 'Kofi', 'Zed']);

      const inactive = await service.list(user, { status: 'INACTIVE' });
      expect(inactive.data.map((o) => o.name)).toEqual(['Zed']);

      const bySearch = await service.list(user, { search: 'transport' });
      expect(bySearch.data.map((o) => o.name)).toEqual(['Kofi']);
    });

    it('scopes officers to the tenant', async () => {
      prisma.marketingTransportOfficer.findMany.mockResolvedValue([]);
      directory.list.mockResolvedValue([]);

      await service.list(user);

      expect(prisma.marketingTransportOfficer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT } }),
      );
    });
  });

  describe('status from trips', () => {
    const listOne = async (
      overrides: Record<string, unknown>,
      tripList: unknown[],
      inHr = true,
    ) => {
      prisma.marketingTransportOfficer.findMany.mockResolvedValue([
        officer(overrides),
      ]);
      directory.list.mockResolvedValue(inHr ? [person('e1', 'Ama')] : []);
      trips.activeTrips.mockResolvedValue(tripList);
      return (await service.list(user)).data[0];
    };

    it('is available with no trips', async () => {
      expect((await listOne({}, [])).status).toBe('AVAILABLE');
    });

    it('is booked when assigned to an approved trip that has not started', async () => {
      const row = await listOne({}, [trip('e1', 'BOOKED')]);
      expect(row.status).toBe('BOOKED');
      expect(row.tripCount).toBe(1);
      expect(row.trips[0]).toMatchObject({
        destination: 'Kumasi',
        departureTime: '10:00',
        returnTime: '12:00',
        vehicleName: 'Toyota Hilux',
        state: 'BOOKED',
      });
    });

    it('is on route once the trip has started', async () => {
      const row = await listOne({}, [
        trip('e1', 'BOOKED', 'later'),
        trip('e1', 'ON_ROUTE'),
      ]);
      expect(row.status).toBe('ON_ROUTE');
    });

    it('ignores other drivers’ trips', async () => {
      const row = await listOne({}, [trip('someone-else', 'ON_ROUTE')]);
      expect(row.status).toBe('AVAILABLE');
      expect(row.tripCount).toBe(0);
    });

    it('is inactive when switched off, whatever trips they have', async () => {
      const row = await listOne({ isActive: false }, [trip('e1', 'ON_ROUTE')]);
      expect(row.status).toBe('INACTIVE');
    });

    it('is marked as left once the employee is gone from HR', async () => {
      const row = await listOne({}, [], false);
      expect(row.status).toBe('LEFT');
    });

    it('filters the list by the derived status', async () => {
      prisma.marketingTransportOfficer.findMany.mockResolvedValue([
        officer({ id: 'a', employeeId: 'e1', name: 'Ama' }),
        officer({ id: 'b', employeeId: 'e2', name: 'Kofi' }),
        officer({ id: 'c', employeeId: 'e3', name: 'Yaw' }),
      ]);
      directory.list.mockResolvedValue([
        person('e1', 'Ama'),
        person('e2', 'Kofi'),
        person('e3', 'Yaw'),
      ]);
      trips.activeTrips.mockResolvedValue([
        trip('e1', 'ON_ROUTE'),
        trip('e2', 'BOOKED'),
      ]);

      const status = async (value: 'ON_ROUTE' | 'BOOKED' | 'AVAILABLE') =>
        (await service.list(user, { status: value })).data.map((o) => o.name);

      expect(await status('ON_ROUTE')).toEqual(['Ama']);
      expect(await status('BOOKED')).toEqual(['Kofi']);
      expect(await status('AVAILABLE')).toEqual(['Yaw']);
    });
  });

  describe('tripHistory', () => {
    it('lists the completed trips driven by that officer’s employee', async () => {
      prisma.marketingTransportOfficer.findFirst.mockResolvedValue({
        employeeId: 'e1',
      });
      trips.completedTrips.mockResolvedValue({ data: [], meta: {} });

      await service.tripHistory(user, 'off-1', { page: 2, limit: 5 });

      expect(prisma.marketingTransportOfficer.findFirst).toHaveBeenCalledWith({
        where: { id: 'off-1', tenantId: TENANT },
        select: { employeeId: true },
      });
      expect(trips.completedTrips).toHaveBeenCalledWith(
        TENANT,
        { driverEmployeeId: 'e1' },
        2,
        5,
      );
    });

    it('returns 404 for an officer in another tenant, without querying trips', async () => {
      prisma.marketingTransportOfficer.findFirst.mockResolvedValue(null);

      await expect(
        service.tripHistory(user, 'off-1', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(trips.completedTrips).not.toHaveBeenCalled();
    });
  });

  describe('candidates', () => {
    it('excludes employees who are already officers, active or not', async () => {
      prisma.marketingTransportOfficer.findMany.mockResolvedValue([
        { employeeId: 'e1' },
        { employeeId: 'e2' },
      ]);
      directory.list.mockResolvedValue([
        person('e1', 'Ama'),
        person('e2', 'Kofi'),
        person('e3', 'Yaw'),
      ]);

      const result = await service.candidates(user);

      expect(result.map((p) => p.employeeId)).toEqual(['e3']);
    });
  });

  describe('add', () => {
    it('validates employees with HR, then adds or reactivates each one', async () => {
      directory.resolve.mockResolvedValue({
        person: null,
        people: [person('e1', 'Ama'), person('e2', 'Kofi')],
      });
      prisma.marketingTransportOfficer.upsert.mockImplementation(
        (args: { create: { employeeId: string; name: string } }) =>
          Promise.resolve(
            officer({
              employeeId: args.create.employeeId,
              name: args.create.name,
            }),
          ),
      );

      const result = await service.add(user, { employeeIds: ['e1', 'e2'] });

      expect(directory.resolve).toHaveBeenCalledWith(TENANT, {
        employeeIds: ['e1', 'e2'],
      });
      expect(result).toHaveLength(2);
      const [first] = prisma.marketingTransportOfficer.upsert.mock.calls[0] as [
        { update: Record<string, unknown>; where: Record<string, unknown> },
      ];
      expect(first.update).toMatchObject({
        isActive: true,
        deactivatedAt: null,
      });
      expect(first.where).toEqual({
        tenantId_employeeId: { tenantId: TENANT, employeeId: 'e1' },
      });
    });

    it('adds nobody when HR rejects an employee', async () => {
      directory.resolve.mockRejectedValue(
        new InternalServiceClientError(
          'One or more employees were not found',
          false,
          404,
        ),
      );

      await expect(
        service.add(user, { employeeIds: ['ghost'] }),
      ).rejects.toMatchObject({ status: 404 });
      expect(prisma.marketingTransportOfficer.upsert).not.toHaveBeenCalled();
    });
  });

  describe('setActive', () => {
    it('deactivates and reports upcoming approved trips without cancelling them', async () => {
      prisma.marketingTransportOfficer.findFirst.mockResolvedValue(officer());
      prisma.marketingTransportOfficer.update.mockResolvedValue(
        officer({ isActive: false, deactivatedAt: new Date() }),
      );
      trips.activeTrips.mockResolvedValue([
        trip('e1', 'BOOKED', 'a'),
        trip('e1', 'BOOKED', 'b'),
      ]);
      directory.list.mockResolvedValue([person('e1', 'Ama')]);

      const result = await service.setActive(user, 'off-1', false);

      expect(result).toMatchObject({
        isActive: false,
        status: 'INACTIVE',
        upcomingTrips: 2,
      });
      expect(trips.activeTrips).toHaveBeenCalledWith(TENANT, {
        driverEmployeeIds: ['e1'],
      });
    });

    it('reactivates without counting trips', async () => {
      prisma.marketingTransportOfficer.findFirst.mockResolvedValue(
        officer({ isActive: false }),
      );
      prisma.marketingTransportOfficer.update.mockResolvedValue(officer());
      directory.list.mockResolvedValue([person('e1', 'Ama')]);

      const result = await service.setActive(user, 'off-1', true);

      expect(result).toMatchObject({
        isActive: true,
        status: 'AVAILABLE',
        upcomingTrips: 0,
      });
    });

    it('returns 404 for an officer in another tenant', async () => {
      prisma.marketingTransportOfficer.findFirst.mockResolvedValue(null);

      await expect(
        service.setActive(user, 'off-1', false),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('driver lookups used by fleet and requests', () => {
    it('activeDrivers is active officers who are still active employees', async () => {
      prisma.marketingTransportOfficer.findMany.mockResolvedValue([
        { employeeId: 'e1' },
        { employeeId: 'gone' },
      ]);
      directory.list.mockResolvedValue([
        person('e1', 'Ama'),
        person('e2', 'Kofi'),
      ]);

      const result = await service.activeDrivers(TENANT);

      expect(result.map((p) => p.employeeId)).toEqual(['e1']);
      expect(prisma.marketingTransportOfficer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT, isActive: true },
        }),
      );
    });

    it('assertActiveOfficer rejects anyone who is not an active officer', async () => {
      prisma.marketingTransportOfficer.findFirst.mockResolvedValue(null);

      await expect(
        service.assertActiveOfficer(TENANT, 'e9'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.marketingTransportOfficer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT, employeeId: 'e9', isActive: true },
        }),
      );
    });

    it('assertActiveOfficer passes for an active officer', async () => {
      prisma.marketingTransportOfficer.findFirst.mockResolvedValue({
        id: 'off-1',
      });

      await expect(
        service.assertActiveOfficer(TENANT, 'e1'),
      ).resolves.toBeUndefined();
    });
  });
});
