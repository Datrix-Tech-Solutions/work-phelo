import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AssetStatus, AssetType } from '../../prisma/generated/client';
import { AssetsService } from './assets.service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ASSET = '22222222-2222-4222-8222-222222222222';

function asset(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSET,
    tenantId: TENANT,
    type: AssetType.VEHICLE,
    status: AssetStatus.AVAILABLE,
    assignedEmployeeId: null,
    purchaseCost: null,
    assignedEmployee: null,
    ...overrides,
  };
}

describe('AssetsService vehicle helpers', () => {
  const prisma = {
    branch: { findMany: jest.fn() },
    employee: { findMany: jest.fn() },
    asset: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new AssetsService(prisma as never);

  beforeEach(() => jest.resetAllMocks());

  it('lists only active VEHICLE assets scoped to the tenant', async () => {
    prisma.asset.findMany.mockResolvedValue([asset()]);

    await service.findVehicles(TENANT, {
      ids: [ASSET],
      status: AssetStatus.MAINTENANCE,
    });

    expect(prisma.asset.findMany.mock.calls[0][0].where).toEqual({
      tenantId: TENANT,
      isActive: true,
      type: AssetType.VEHICLE,
      id: { in: [ASSET] },
      status: AssetStatus.MAINTENANCE,
    });
  });

  it('returns only active branches and assignable drivers for fleet options', async () => {
    prisma.branch.findMany.mockResolvedValue([{ id: 'b1', name: 'Accra' }]);
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e1', firstName: 'Ama', lastName: 'Mensah' },
    ]);

    const result = await service.findFleetOptions(TENANT);

    expect(result).toEqual({
      branches: [{ id: 'b1', name: 'Accra' }],
      drivers: [{ id: 'e1', name: 'Ama Mensah' }],
    });
    expect(prisma.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT, isActive: true } }),
    );
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT,
          employmentStatus: { in: ['ACTIVE', 'PROBATION'] },
        },
      }),
    );
  });

  it('treats a non-vehicle asset as not found', async () => {
    prisma.asset.findFirst.mockResolvedValue(asset({ type: AssetType.LAPTOP }));

    await expect(service.findVehicleById(TENANT, ASSET)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('changeStatus', () => {
    it('moves an unassigned vehicle into maintenance', async () => {
      prisma.asset.findFirst.mockResolvedValue(asset());
      prisma.asset.update.mockResolvedValue(
        asset({ status: AssetStatus.MAINTENANCE }),
      );

      const result = await service.changeStatus(
        TENANT,
        ASSET,
        AssetStatus.MAINTENANCE,
      );

      expect(prisma.asset.update.mock.calls[0][0].data).toEqual({
        status: AssetStatus.MAINTENANCE,
      });
      expect(result.status).toBe(AssetStatus.MAINTENANCE);
    });

    it('refuses to change status while a driver is assigned', async () => {
      prisma.asset.findFirst.mockResolvedValue(
        asset({
          status: AssetStatus.ASSIGNED,
          assignedEmployeeId: 'emp-1',
        }),
      );

      await expect(
        service.changeStatus(TENANT, ASSET, AssetStatus.MAINTENANCE),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.asset.update).not.toHaveBeenCalled();
    });

    it('rejects a no-op status change', async () => {
      prisma.asset.findFirst.mockResolvedValue(asset());

      await expect(
        service.changeStatus(TENANT, ASSET, AssetStatus.AVAILABLE),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('retires through the existing retire rules', async () => {
      prisma.asset.findFirst.mockResolvedValue(asset());
      prisma.asset.update.mockResolvedValue(
        asset({ status: AssetStatus.RETIRED }),
      );

      await service.changeStatus(TENANT, ASSET, AssetStatus.RETIRED);

      expect(prisma.asset.update.mock.calls[0][0].data.status).toBe(
        AssetStatus.RETIRED,
      );
    });
  });
});
