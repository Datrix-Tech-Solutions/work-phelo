import {
  BadGatewayException,
  BadRequestException,
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
    listVehicles: jest.fn(),
    getVehicle: jest.fn(),
    createVehicle: jest.fn(),
    updateVehicle: jest.fn(),
    setStatus: jest.fn(),
    assignDriver: jest.fn(),
    unassignDriver: jest.fn(),
  };
  const service = new FleetService(prisma as never, hr as never);

  beforeEach(() => jest.resetAllMocks());

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
