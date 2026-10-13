import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { InternalServiceClientError } from '@work-phelo/internal-auth';
import { RequestUser } from '@work-phelo/types';
import { FleetService } from './fleet.service';
import { HrVehicleAsset } from './hr-fleet.client';

const TENANT = '11111111-1111-4111-8111-111111111111';
const user = { id: 'user-1', tenantId: TENANT } as RequestUser;

function asset(overrides: Partial<HrVehicleAsset> = {}): HrVehicleAsset {
  return {
    id: 'asset-1',
    assetNumber: 'VEH-0001',
    name: 'Toyota Hilux',
    status: 'AVAILABLE',
    branchId: null,
    assignedEmployeeId: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function details(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fd-1',
    tenantId: TENANT,
    assetId: 'asset-1',
    vehicleType: 'PICKUP',
    make: 'Toyota',
    model: 'Hilux',
    yearOfRegistration: 2022,
    fuelType: 'DIESEL',
    currentMileage: 45000,
    ...overrides,
  };
}

const createDto = {
  vehicleType: 'PICKUP',
  make: 'Toyota',
  model: 'Hilux',
  yearOfRegistration: 2022,
  fuelType: 'DIESEL',
  currentMileage: 45000,
} as never;

describe('FleetService', () => {
  const prisma = {
    marketingFleetVehicle: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const hr = {
    getOptions: jest.fn(),
    listVehicles: jest.fn(),
    getVehicle: jest.fn(),
    createVehicle: jest.fn(),
    updateVehicle: jest.fn(),
    setStatus: jest.fn(),
    assignDriver: jest.fn(),
    unassignDriver: jest.fn(),
  };
  const officers = {
    activeDrivers: jest.fn(),
    assertActiveOfficer: jest.fn(),
  };
  const trips = { activeTrips: jest.fn(), completedTrips: jest.fn() };
  const service = new FleetService(
    prisma as never,
    hr as never,
    officers as never,
    trips as never,
  );

  const trip = (overrides: Record<string, unknown> = {}) => ({
    requestId: 'req-1',
    travelDate: '2026-10-20',
    departureTime: '10:00',
    returnTime: '12:00',
    destination: 'Kumasi',
    requesterName: 'Efua',
    vehicle: {
      assetId: 'asset-1',
      name: 'Toyota Hilux',
      assetNumber: 'VEH-0001',
    },
    driver: { employeeId: 'e1', name: 'Ama Mensah' },
    selfDriven: false,
    state: 'BOOKED',
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    officers.assertActiveOfficer.mockResolvedValue(undefined);
    trips.activeTrips.mockResolvedValue([]);
  });

  describe('list', () => {
    it('merges HR assets with details and flags vehicles missing details', async () => {
      hr.listVehicles.mockResolvedValue([
        asset(),
        asset({ id: 'asset-2', assetNumber: 'VEH-0002', name: 'Old van' }),
      ]);
      prisma.marketingFleetVehicle.findMany.mockResolvedValue([details()]);

      const result = await service.list(user);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        assetId: 'asset-1',
        make: 'Toyota',
        needsFleetDetails: false,
      });
      expect(result.data[1]).toMatchObject({
        assetId: 'asset-2',
        make: null,
        needsFleetDetails: true,
      });
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('filters by fleet fields, status and search, then paginates', async () => {
      hr.listVehicles.mockResolvedValue([
        asset(),
        asset({ id: 'asset-2', status: 'MAINTENANCE', name: 'Other' }),
        asset({
          id: 'asset-3',
          assignedEmployeeId: 'emp-1',
          assignedEmployeeName: 'Ama Mensah',
        }),
      ]);
      prisma.marketingFleetVehicle.findMany.mockResolvedValue([
        details(),
        details({ assetId: 'asset-2', fuelType: 'PETROL' }),
        details({ assetId: 'asset-3', make: 'Nissan' }),
      ]);

      const byFuel = await service.list(user, { fuelType: 'PETROL' });
      expect(byFuel.data.map((row) => row.assetId)).toEqual(['asset-2']);

      const byStatus = await service.list(user, { status: 'MAINTENANCE' });
      expect(byStatus.data.map((row) => row.assetId)).toEqual(['asset-2']);

      const byDriver = await service.list(user, { search: 'ama' });
      expect(byDriver.data.map((row) => row.assetId)).toEqual(['asset-3']);

      const paged = await service.list(user, { page: 2, limit: 2 });
      expect(paged.data).toHaveLength(1);
      expect(paged.meta.totalPages).toBe(2);
    });
  });

  describe('status from trips', () => {
    const listOne = async (hrStatus: string, tripList: unknown[]) => {
      hr.listVehicles.mockResolvedValue([asset({ status: hrStatus } as never)]);
      prisma.marketingFleetVehicle.findMany.mockResolvedValue([details()]);
      trips.activeTrips.mockResolvedValue(tripList);
      return (await service.list(user)).data[0];
    };

    it('is available with no trips', async () => {
      expect((await listOne('AVAILABLE', [])).status).toBe('AVAILABLE');
    });

    it('is booked when an approved trip is still to come', async () => {
      const row = await listOne('AVAILABLE', [trip({ state: 'BOOKED' })]);
      expect(row.status).toBe('BOOKED');
      expect(row.tripCount).toBe(1);
      expect(row.trips[0]).toMatchObject({
        destination: 'Kumasi',
        departureTime: '10:00',
        driverName: 'Ama Mensah',
        state: 'BOOKED',
      });
    });

    it('is on route once a trip has started, even with another booked after it', async () => {
      const row = await listOne('AVAILABLE', [
        trip({ state: 'BOOKED', requestId: 'later' }),
        trip({ state: 'ON_ROUTE' }),
      ]);
      expect(row.status).toBe('ON_ROUTE');
    });

    it('only counts trips for that vehicle', async () => {
      const row = await listOne('AVAILABLE', [
        trip({
          vehicle: {
            assetId: 'someone-else',
            name: 'Van',
            assetNumber: 'VEH-2',
          },
        }),
      ]);
      expect(row.status).toBe('AVAILABLE');
      expect(row.tripCount).toBe(0);
    });

    it.each(['MAINTENANCE', 'RETIRED'])(
      'keeps %s from HR even when a trip is on route',
      async (hrStatus) => {
        const row = await listOne(hrStatus, [trip({ state: 'ON_ROUTE' })]);
        expect(row.status).toBe(hrStatus);
      },
    );

    it('does not treat a driver assignment as a status', async () => {
      const row = await listOne('ASSIGNED', []);
      expect(row.status).toBe('AVAILABLE');
      expect(row.hrStatus).toBe('ASSIGNED');
    });

    it('filters the list by the derived status', async () => {
      hr.listVehicles.mockResolvedValue([
        asset({ id: 'asset-1' }),
        asset({ id: 'asset-2', assetNumber: 'VEH-2' }),
      ]);
      prisma.marketingFleetVehicle.findMany.mockResolvedValue([]);
      trips.activeTrips.mockResolvedValue([trip({ state: 'ON_ROUTE' })]);

      const result = await service.list(user, { status: 'ON_ROUTE' });

      expect(result.data.map((row) => row.assetId)).toEqual(['asset-1']);
    });

    it('loads only this vehicle’s trips for single-vehicle reads', async () => {
      hr.getVehicle.mockResolvedValue(asset());
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(details());
      trips.activeTrips.mockResolvedValue([trip({ state: 'ON_ROUTE' })]);

      const row = await service.findOne(user, 'asset-1');

      expect(trips.activeTrips).toHaveBeenCalledWith(TENANT, {
        vehicleAssetIds: ['asset-1'],
      });
      expect(row.status).toBe('ON_ROUTE');
    });

    it.each(['MAINTENANCE', 'RETIRED'] as const)(
      'refuses to set %s while the vehicle is on a trip',
      async (status) => {
        trips.activeTrips.mockResolvedValue([trip({ state: 'ON_ROUTE' })]);

        await expect(
          service.setStatus(user, 'asset-1', status),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(hr.setStatus).not.toHaveBeenCalled();
      },
    );

    it('still allows maintenance for a vehicle that is only booked', async () => {
      trips.activeTrips.mockResolvedValue([trip({ state: 'BOOKED' })]);
      hr.setStatus.mockResolvedValue(asset({ status: 'MAINTENANCE' } as never));
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(details());

      const row = await service.setStatus(user, 'asset-1', 'MAINTENANCE');

      expect(row.status).toBe('MAINTENANCE');
    });

    it('does not need the trip check to bring a vehicle back to available', async () => {
      hr.setStatus.mockResolvedValue(asset());
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(details());

      await service.setStatus(user, 'asset-1', 'AVAILABLE');

      expect(hr.setStatus).toHaveBeenCalledWith(TENANT, 'asset-1', 'AVAILABLE');
    });

    it('refuses to retire a vehicle that is on a trip', async () => {
      hr.getVehicle.mockResolvedValue(asset());
      trips.activeTrips.mockResolvedValue([trip({ state: 'ON_ROUTE' })]);

      await expect(service.remove(user, 'asset-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(hr.setStatus).not.toHaveBeenCalled();
    });
  });

  describe('tripHistory', () => {
    it('lists the completed trips of just that vehicle in this tenant', async () => {
      trips.completedTrips.mockResolvedValue({ data: [], meta: {} });

      await service.tripHistory(user, 'asset-1', { page: 2, limit: 5 });

      expect(trips.completedTrips).toHaveBeenCalledWith(
        TENANT,
        { vehicleAssetId: 'asset-1' },
        2,
        5,
      );
    });
  });

  describe('options', () => {
    it('offers HR branches but only active transport officers as drivers', async () => {
      hr.getOptions.mockResolvedValue({
        branches: [{ id: 'b1', name: 'Accra' }],
        drivers: [{ id: 'every-employee', name: 'Not an officer' }],
      });
      officers.activeDrivers.mockResolvedValue([
        { employeeId: 'e1', name: 'Ama Mensah', department: null },
      ]);

      const result = await service.options(user);

      expect(result).toEqual({
        branches: [{ id: 'b1', name: 'Accra' }],
        drivers: [{ id: 'e1', name: 'Ama Mensah' }],
      });
    });
  });

  describe('create', () => {
    it('creates the HR asset first, then the fleet details', async () => {
      hr.createVehicle.mockResolvedValue(asset());
      prisma.marketingFleetVehicle.create.mockResolvedValue(details());

      const result = await service.create(user, {
        ...(createDto as object),
        branchId: 'branch-1',
      } as never);

      expect(hr.createVehicle).toHaveBeenCalledWith(TENANT, {
        name: 'Toyota Hilux',
        branchId: 'branch-1',
      });
      expect(prisma.marketingFleetVehicle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT,
          assetId: 'asset-1',
          make: 'Toyota',
        }) as unknown,
      });
      expect(result.warnings).toEqual([]);
    });

    it('creates a vehicle without mileage', async () => {
      const { currentMileage, ...withoutMileage } = createDto as Record<
        string,
        unknown
      >;
      void currentMileage;
      hr.createVehicle.mockResolvedValue(asset());
      prisma.marketingFleetVehicle.create.mockResolvedValue(
        details({ currentMileage: null }),
      );

      const result = await service.create(user, withoutMileage as never);

      expect(result.currentMileage).toBeNull();
      expect(result.needsFleetDetails).toBe(false);
    });

    it('keeps the vehicle and reports a warning when driver assignment fails', async () => {
      hr.createVehicle.mockResolvedValue(asset());
      prisma.marketingFleetVehicle.create.mockResolvedValue(details());
      hr.assignDriver.mockRejectedValue(
        new InternalServiceClientError('Employee not found', false, 404),
      );

      const result = await service.create(user, {
        ...(createDto as object),
        assignedDriverId: 'emp-1',
      } as never);

      expect(result.assetId).toBe('asset-1');
      expect(result.warnings[0]).toContain('driver could not be assigned');
    });

    it('refuses a driver who is not an active officer before creating anything', async () => {
      officers.assertActiveOfficer.mockRejectedValue(
        new BadRequestException('not an officer'),
      );

      await expect(
        service.create(user, {
          ...(createDto as object),
          assignedDriverId: 'emp-1',
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(hr.createVehicle).not.toHaveBeenCalled();
    });

    it('rejects maintenance combined with a driver before touching HR', async () => {
      await expect(
        service.create(user, {
          ...(createDto as object),
          status: 'MAINTENANCE',
          assignedDriverId: 'emp-1',
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(hr.createVehicle).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('requires every detail field the first time details are saved', async () => {
      hr.getVehicle.mockResolvedValue(asset());
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(null);

      await expect(
        service.update(user, 'asset-1', { make: 'Toyota' }),
      ).rejects.toThrow(/incomplete: vehicleType, model/);
      expect(prisma.marketingFleetVehicle.upsert).not.toHaveBeenCalled();
    });

    it('does not require mileage the first time details are saved', async () => {
      hr.getVehicle.mockResolvedValue(asset());
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(null);
      prisma.marketingFleetVehicle.upsert.mockResolvedValue(
        details({ currentMileage: null }),
      );

      const result = await service.update(user, 'asset-1', {
        vehicleType: 'PICKUP',
        make: 'Toyota',
        model: 'Hilux',
        yearOfRegistration: 2022,
        fuelType: 'DIESEL',
      });

      expect(result.currentMileage).toBeNull();
      expect(prisma.marketingFleetVehicle.upsert).toHaveBeenCalled();
    });

    it('clears mileage when null is sent', async () => {
      hr.getVehicle.mockResolvedValue(asset());
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(details());
      prisma.marketingFleetVehicle.upsert.mockResolvedValue(
        details({ currentMileage: null }),
      );

      await service.update(user, 'asset-1', { currentMileage: null });

      expect(prisma.marketingFleetVehicle.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ currentMileage: null }) as unknown,
        }),
      );
    });

    it('rejects an empty patch', async () => {
      await expect(service.update(user, 'asset-1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('renames the HR asset when make/model change and the name was generated', async () => {
      hr.getVehicle.mockResolvedValue(asset());
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(details());
      hr.updateVehicle.mockResolvedValue(
        asset({ name: 'Toyota Land Cruiser' }),
      );
      prisma.marketingFleetVehicle.upsert.mockResolvedValue(
        details({ model: 'Land Cruiser' }),
      );

      await service.update(user, 'asset-1', { model: 'Land Cruiser' });

      expect(hr.updateVehicle).toHaveBeenCalledWith(TENANT, 'asset-1', {
        name: 'Toyota Land Cruiser',
      });
    });

    it('leaves a hand-edited HR name alone', async () => {
      hr.getVehicle.mockResolvedValue(asset({ name: 'Director car' }));
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(details());
      prisma.marketingFleetVehicle.upsert.mockResolvedValue(
        details({ model: 'Land Cruiser' }),
      );

      await service.update(user, 'asset-1', { model: 'Land Cruiser' });

      expect(hr.updateVehicle).not.toHaveBeenCalled();
    });

    it('does not save details when HR rejects the branch change', async () => {
      hr.getVehicle.mockResolvedValue(asset());
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(details());
      hr.updateVehicle.mockRejectedValue(
        new InternalServiceClientError('Branch not found', false, 404),
      );

      await expect(
        service.update(user, 'asset-1', {
          branchId: 'branch-x',
          currentMileage: 50000,
        }),
      ).rejects.toBeInstanceOf(HttpException);
      expect(prisma.marketingFleetVehicle.upsert).not.toHaveBeenCalled();
    });
  });

  describe('assignDriver', () => {
    it('only assigns active transport officers', async () => {
      officers.assertActiveOfficer.mockRejectedValue(
        new BadRequestException('not an officer'),
      );

      await expect(
        service.assignDriver(user, 'asset-1', 'emp-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(hr.assignDriver).not.toHaveBeenCalled();
    });

    it('assigns an active officer', async () => {
      hr.assignDriver.mockResolvedValue(asset({ status: 'ASSIGNED' }));
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(details());

      await service.assignDriver(user, 'asset-1', 'emp-1');

      expect(officers.assertActiveOfficer).toHaveBeenCalledWith(
        TENANT,
        'emp-1',
      );
      expect(hr.assignDriver).toHaveBeenCalledWith(TENANT, 'asset-1', 'emp-1');
    });
  });

  describe('remove', () => {
    it('unassigns the driver, then retires the asset', async () => {
      hr.getVehicle.mockResolvedValue(
        asset({ status: 'ASSIGNED', assignedEmployeeId: 'emp-1' }),
      );
      hr.unassignDriver.mockResolvedValue(asset());
      hr.setStatus.mockResolvedValue(asset({ status: 'RETIRED' }));

      await expect(service.remove(user, 'asset-1')).resolves.toEqual({
        success: true,
      });
      expect(hr.unassignDriver.mock.invocationCallOrder[0]).toBeLessThan(
        hr.setStatus.mock.invocationCallOrder[0],
      );
      expect(hr.setStatus).toHaveBeenCalledWith(TENANT, 'asset-1', 'RETIRED');
    });

    it('is a no-op for an already retired vehicle', async () => {
      hr.getVehicle.mockResolvedValue(asset({ status: 'RETIRED' }));

      await service.remove(user, 'asset-1');

      expect(hr.setStatus).not.toHaveBeenCalled();
    });
  });

  describe('HR error handling', () => {
    it.each([404, 409, 400])(
      'passes HR %i through to the caller',
      async (code) => {
        hr.getVehicle.mockRejectedValue(
          new InternalServiceClientError('nope', false, code),
        );

        await expect(service.findOne(user, 'asset-1')).rejects.toMatchObject({
          status: code,
          message: 'nope',
        });
      },
    );

    it.each([500, 401, 403, 429])('hides HR %i behind a 502', async (code) => {
      hr.getVehicle.mockRejectedValue(
        new InternalServiceClientError('secret detail', code >= 500, code),
      );

      await expect(service.findOne(user, 'asset-1')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it.each([
      [401, true, 'HR_SERVICE_REJECTED_CREDENTIALS'],
      [500, true, 'HR_SERVICE_ERROR_500'],
      [undefined, true, 'HR_SERVICE_UNREACHABLE'],
      [undefined, false, 'HR_SERVICE_NOT_CONFIGURED'],
    ])(
      'tags a %s/retryable=%s failure with reason %s',
      async (status, retryable, reason) => {
        hr.getVehicle.mockRejectedValue(
          new InternalServiceClientError('secret detail', retryable, status),
        );

        const error = (await service
          .findOne(user, 'asset-1')
          .catch((e: BadGatewayException) => e)) as BadGatewayException;

        expect(error.getResponse()).toMatchObject({ statusCode: 502, reason });
        expect(JSON.stringify(error.getResponse())).not.toContain('secret');
      },
    );

    it('hides network failures behind a 502', async () => {
      hr.getVehicle.mockRejectedValue(
        new InternalServiceClientError('ECONNREFUSED', true),
      );

      await expect(service.findOne(user, 'asset-1')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });
  });
});
