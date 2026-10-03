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
    marketingTransportRequest: { count: jest.fn() },
    $transaction: jest.fn(),
  };
  const directory = { list: jest.fn(), resolve: jest.fn() };
  const service = new TransportOfficersService(
    prisma as never,
    directory as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
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
      prisma.marketingTransportRequest.count.mockResolvedValue(2);
      directory.list.mockResolvedValue([person('e1', 'Ama')]);

      const result = await service.setActive(user, 'off-1', false);

      expect(result).toMatchObject({ isActive: false, upcomingTrips: 2 });
      expect(prisma.marketingTransportRequest.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'APPROVED',
          driverEmployeeId: 'e1',
        }) as unknown,
      });
    });

    it('reactivates without counting trips', async () => {
      prisma.marketingTransportOfficer.findFirst.mockResolvedValue(
        officer({ isActive: false }),
      );
      prisma.marketingTransportOfficer.update.mockResolvedValue(officer());
      directory.list.mockResolvedValue([person('e1', 'Ama')]);

      const result = await service.setActive(user, 'off-1', true);

      expect(result).toMatchObject({ isActive: true, upcomingTrips: 0 });
      expect(prisma.marketingTransportRequest.count).not.toHaveBeenCalled();
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
