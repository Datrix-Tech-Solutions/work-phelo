import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InternalServiceClientError } from '@work-phelo/internal-auth';
import { Prisma } from '../../prisma/generated/client';
import { RequestUser } from '@work-phelo/types';
import { RequestsService } from './requests.service';

type CallArg = {
  where: Record<string, unknown>;
  data: Record<string, unknown> & {
    passengers: { create: { employeeId: string }[] };
  };
};
const callArg = (fn: jest.Mock): CallArg => (fn.mock.calls[0] as [CallArg])[0];

const TENANT = '11111111-1111-4111-8111-111111111111';
const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

const user = (overrides: Partial<RequestUser> = {}) =>
  ({
    id: 'user-1',
    tenantId: TENANT,
    firstName: 'Ama',
    role: 'USER',
    permissions: [],
    ...overrides,
  }) as RequestUser;

const ama = { employeeId: 'e1', name: 'Ama Mensah', department: 'Operations' };
const kofi = { employeeId: 'e2', name: 'Kofi Boateng', department: null };

const createDto = {
  businessPurpose: 'Client site visit',
  travelDate: future,
  departureTime: '08:00',
  returnTime: '17:00',
  destination: 'Kumasi',
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    tenantId: TENANT,
    requesterUserId: 'user-1',
    requesterEmployeeId: 'e1',
    requesterName: 'Ama Mensah',
    requesterDepartment: 'Operations',
    businessPurpose: 'Client site visit',
    travelDate: new Date(`${future}T00:00:00.000Z`),
    departureTime: '08:00',
    returnTime: '17:00',
    destination: 'Kumasi',
    notes: null,
    status: 'PENDING',
    reviewedByUserId: null,
    reviewedByName: null,
    reviewedAt: null,
    reviewNote: null,
    cancelledAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    passengers: [],
    ...overrides,
  };
}

describe('RequestsService', () => {
  const tx = {
    marketingTransportRequestPassenger: { deleteMany: jest.fn() },
    marketingTransportRequest: {
      update: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    marketingTransportRequest: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    marketingFleetVehicle: { findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const directory = { list: jest.fn(), resolve: jest.fn() };
  const fleet = {
    getVehicle: jest.fn(),
    listVehicles: jest.fn(),
    // Writes that must never be called when approving a request.
    assignDriver: jest.fn(),
    unassignDriver: jest.fn(),
    setStatus: jest.fn(),
    updateVehicle: jest.fn(),
  };
  const officers = {
    activeDrivers: jest.fn(),
    assertActiveOfficer: jest.fn(),
  };
  const service = new RequestsService(
    prisma as never,
    directory as never,
    fleet as never,
    officers as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    officers.assertActiveOfficer.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: typeof tx) => unknown)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    );
  });

  describe('create', () => {
    it('snapshots the requester with their department and starts pending', async () => {
      directory.resolve.mockResolvedValue({ person: ama, people: [kofi] });
      prisma.marketingTransportRequest.create.mockResolvedValue(
        row({ passengers: [{ ...kofi, id: 'p1' }] }),
      );

      const result = await service.create(user(), {
        ...createDto,
        passengerIds: ['e2'],
      });

      const data = callArg(prisma.marketingTransportRequest.create)
        .data as Record<string, unknown>;
      expect(data).toMatchObject({
        tenantId: TENANT,
        requesterUserId: 'user-1',
        requesterEmployeeId: 'e1',
        requesterName: 'Ama Mensah',
        requesterDepartment: 'Operations',
        departureTime: '08:00',
        returnTime: '17:00',
      });
      expect(data).not.toHaveProperty('status');
      expect(result.status).toBe('PENDING');
      expect(result.passengers).toEqual([
        { employeeId: 'e2', name: 'Kofi Boateng', department: null },
      ]);
    });

    it('drops the requester from the passenger list', async () => {
      directory.resolve.mockResolvedValue({ person: ama, people: [ama, kofi] });
      prisma.marketingTransportRequest.create.mockResolvedValue(row());

      await service.create(user(), {
        ...createDto,
        passengerIds: ['e1', 'e2'],
      });

      const created = callArg(prisma.marketingTransportRequest.create).data
        .passengers.create as { employeeId: string }[];
      expect(created.map((p) => p.employeeId)).toEqual(['e2']);
    });

    it('falls back to the login name when the user has no employee record', async () => {
      directory.resolve.mockResolvedValue({ person: null, people: [] });
      prisma.marketingTransportRequest.create.mockResolvedValue(row());

      await service.create(user(), createDto);

      expect(
        callArg(prisma.marketingTransportRequest.create).data,
      ).toMatchObject({
        requesterName: 'Ama',
        requesterDepartment: null,
        requesterEmployeeId: null,
      });
    });

    it.each([
      ['a past travel date', { travelDate: '2020-01-01' }],
      ['an impossible date', { travelDate: '2026-02-31' }],
      [
        'return before departure',
        { departureTime: '17:00', returnTime: '08:00' },
      ],
      [
        'return equal to departure',
        { departureTime: '09:00', returnTime: '09:00' },
      ],
    ])('rejects %s before calling HR', async (_label, patch) => {
      await expect(
        service.create(user(), { ...createDto, ...patch }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(directory.resolve).not.toHaveBeenCalled();
      expect(prisma.marketingTransportRequest.create).not.toHaveBeenCalled();
    });

    it('passes HR validation of passengers through', async () => {
      directory.resolve.mockRejectedValue(
        new InternalServiceClientError(
          'One or more employees were not found',
          false,
          404,
        ),
      );

      await expect(
        service.create(user(), { ...createDto, passengerIds: ['ghost'] }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('returns a tagged 502 when HR is unreachable', async () => {
      directory.resolve.mockRejectedValue(
        new InternalServiceClientError('ECONNREFUSED', true),
      );

      const error = (await service
        .create(user(), createDto)
        .catch((e: BadGatewayException) => e)) as BadGatewayException;

      expect(error).toBeInstanceOf(BadGatewayException);
      expect(error.getResponse()).toMatchObject({
        reason: 'HR_SERVICE_UNREACHABLE',
      });
    });
  });

  describe('list visibility', () => {
    beforeEach(() => {
      prisma.marketingTransportRequest.count.mockResolvedValue(0);
      prisma.marketingTransportRequest.findMany.mockResolvedValue([]);
    });
    const whereOf = () => callArg(prisma.marketingTransportRequest.count).where;

    it('limits users without the all permission to their own requests', async () => {
      await service.list(user());
      expect(whereOf()).toMatchObject({
        tenantId: TENANT,
        requesterUserId: 'user-1',
      });
    });

    it('shows everything to holders of requests.all:VIEW', async () => {
      await service.list(
        user({ permissions: ['marketing.requests.all:VIEW'] }),
      );
      expect(whereOf()).not.toHaveProperty('requesterUserId');
    });

    it('shows everything to tenant admins', async () => {
      await service.list(user({ role: 'TENANT_ADMIN' }));
      expect(whereOf()).not.toHaveProperty('requesterUserId');
    });

    it('filters by status list and searches purpose, destination and requester', async () => {
      await service.list(user(), {
        status: ['PENDING', 'APPROVED'],
        search: 'kum',
      });
      expect(whereOf()).toMatchObject({
        status: { in: ['PENDING', 'APPROVED'] },
        OR: expect.arrayContaining([
          { destination: { contains: 'kum', mode: 'insensitive' } },
        ]) as unknown,
      });
    });
  });

  describe('findOne', () => {
    it('does not reveal another user’s request', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(null);

      await expect(service.findOne(user(), 'req-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(
        callArg(prisma.marketingTransportRequest.findFirst).where,
      ).toMatchObject({ requesterUserId: 'user-1' });
    });
  });

  describe('update', () => {
    it('only lets the requester edit, hiding other people’s requests', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.update(user(), 'req-1', { destination: 'Tamale' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects edits once the request is no longer pending', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        row({ status: 'APPROVED' }),
      );

      await expect(
        service.update(user(), 'req-1', { destination: 'Tamale' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('re-validates the merged schedule', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());

      await expect(
        service.update(user(), 'req-1', { returnTime: '07:00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('replaces passengers and leaves them alone when not provided', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());
      directory.resolve.mockResolvedValue({ person: null, people: [kofi] });
      tx.marketingTransportRequest.update.mockResolvedValue(row());

      await service.update(user(), 'req-1', { passengerIds: ['e2'] });
      expect(
        tx.marketingTransportRequestPassenger.deleteMany,
      ).toHaveBeenCalledWith({ where: { requestId: 'req-1' } });

      tx.marketingTransportRequestPassenger.deleteMany.mockClear();
      await service.update(user(), 'req-1', { destination: 'Tamale' });
      expect(
        tx.marketingTransportRequestPassenger.deleteMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('cancels a pending request', async () => {
      prisma.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(row())
        .mockResolvedValueOnce(row({ status: 'CANCELLED' }));
      prisma.marketingTransportRequest.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.cancel(user(), 'req-1');

      expect(result.status).toBe('CANCELLED');
    });

    it.each(['REJECTED', 'CANCELLED'])(
      'refuses to cancel a %s request',
      async (status) => {
        prisma.marketingTransportRequest.findFirst.mockResolvedValue(
          row({ status }),
        );

        await expect(service.cancel(user(), 'req-1')).rejects.toBeInstanceOf(
          ConflictException,
        );
      },
    );
  });

  describe('review', () => {
    const reviewer = () => user({ id: 'user-2', firstName: 'Kojo' });
    const driver = {
      employeeId: 'e5',
      name: 'Yaw Owusu',
      department: 'Transport',
    };
    const hrVehicle = (overrides: Record<string, unknown> = {}) => ({
      id: 'veh-1',
      assetNumber: 'VEH-0001',
      name: 'Toyota Hilux',
      status: 'AVAILABLE',
      ...overrides,
    });
    const approveDto = {
      vehicleAssetId: 'veh-1',
      driverEmployeeId: 'e5',
      note: 'ok',
    };
    const resolvedFor = () => ({
      person: { employeeId: 'e9', name: 'Kojo Asante', department: null },
      people: [driver],
    });

    function arrangeApprove() {
      prisma.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(row())
        .mockResolvedValueOnce(
          row({
            status: 'APPROVED',
            reviewedByName: 'Kojo Asante',
            reviewedAt: new Date('2026-10-02T00:00:00.000Z'),
            vehicleAssetId: 'veh-1',
            vehicleName: 'Toyota Hilux',
            vehicleAssetNumber: 'VEH-0001',
            driverEmployeeId: 'e5',
            driverName: 'Yaw Owusu',
          }),
        );
      directory.resolve.mockResolvedValue(resolvedFor());
      fleet.getVehicle.mockResolvedValue(hrVehicle());
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue({
        make: 'Toyota',
        model: 'Hilux',
      });
      tx.marketingTransportRequest.findMany.mockResolvedValue([]);
      tx.marketingTransportRequest.updateMany.mockResolvedValue({ count: 1 });
    }

    it('approves with a vehicle and driver and records the allocation', async () => {
      arrangeApprove();

      const result = await service.approve(reviewer(), 'req-1', approveDto);

      expect(tx.marketingTransportRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'req-1', tenantId: TENANT, status: 'PENDING' },
        data: expect.objectContaining({
          status: 'APPROVED',
          reviewedByUserId: 'user-2',
          reviewedByName: 'Kojo Asante',
          reviewNote: 'ok',
          vehicleAssetId: 'veh-1',
          vehicleName: 'Toyota Hilux',
          vehicleAssetNumber: 'VEH-0001',
          driverEmployeeId: 'e5',
          driverName: 'Yaw Owusu',
        }) as unknown,
      });
      expect(result.allocation).toEqual({
        vehicle: {
          assetId: 'veh-1',
          name: 'Toyota Hilux',
          assetNumber: 'VEH-0001',
        },
        driver: { employeeId: 'e5', name: 'Yaw Owusu' },
      });
    });

    it('refuses a driver who is not an active transport officer', async () => {
      arrangeApprove();
      officers.assertActiveOfficer.mockRejectedValue(
        new BadRequestException('not an officer'),
      );

      await expect(
        service.approve(reviewer(), 'req-1', approveDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(officers.assertActiveOfficer).toHaveBeenCalledWith(TENANT, 'e5');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not change the vehicle’s HR assignment or status', async () => {
      arrangeApprove();

      await service.approve(reviewer(), 'req-1', approveDto);

      expect(fleet.assignDriver).not.toHaveBeenCalled();
      expect(fleet.unassignDriver).not.toHaveBeenCalled();
      expect(fleet.setStatus).not.toHaveBeenCalled();
      expect(fleet.updateVehicle).not.toHaveBeenCalled();
    });

    it('checks clashes against approved trips overlapping on that day', async () => {
      arrangeApprove();

      await service.approve(reviewer(), 'req-1', approveDto);

      const where = callArg(tx.marketingTransportRequest.findMany).where;
      expect(where).toMatchObject({
        tenantId: TENANT,
        status: 'APPROVED',
        id: { not: 'req-1' },
        departureTime: { lt: '17:00' },
        returnTime: { gt: '08:00' },
        OR: [{ vehicleAssetId: 'veh-1' }, { driverEmployeeId: 'e5' }],
      });
    });

    it.each([
      [
        'vehicle',
        { vehicleAssetId: 'veh-1', driverEmployeeId: 'other' },
        /Toyota Hilux is already allocated/,
      ],
      [
        'driver',
        { vehicleAssetId: 'other', driverEmployeeId: 'e5' },
        /Yaw Owusu is already allocated/,
      ],
    ])('refuses a double-booked %s', async (_label, clash, message) => {
      arrangeApprove();
      tx.marketingTransportRequest.findMany.mockResolvedValue([
        {
          ...clash,
          departureTime: '09:00',
          returnTime: '12:00',
          requesterName: 'Efua',
        },
      ]);

      await expect(
        service.approve(reviewer(), 'req-1', approveDto),
      ).rejects.toThrow(message);
      expect(tx.marketingTransportRequest.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      ['RETIRED', /retired/],
      ['MAINTENANCE', /under maintenance/],
    ])('refuses a %s vehicle', async (status, message) => {
      arrangeApprove();
      fleet.getVehicle.mockResolvedValue(hrVehicle({ status }));

      await expect(
        service.approve(reviewer(), 'req-1', approveDto),
      ).rejects.toThrow(message);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('still allows a vehicle HR shows as ASSIGNED, since assignment is not fleet status', async () => {
      arrangeApprove();
      fleet.getVehicle.mockResolvedValue(hrVehicle({ status: 'ASSIGNED' }));

      await expect(
        service.approve(reviewer(), 'req-1', approveDto),
      ).resolves.toBeDefined();
    });

    it('falls back to the HR asset name when the vehicle has no fleet details', async () => {
      arrangeApprove();
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(null);

      await service.approve(reviewer(), 'req-1', approveDto);

      expect(
        callArg(tx.marketingTransportRequest.updateMany).data,
      ).toMatchObject({ vehicleName: 'Toyota Hilux' });
    });

    it('passes HR rejection of an unknown vehicle or driver through', async () => {
      arrangeApprove();
      fleet.getVehicle.mockRejectedValue(
        new InternalServiceClientError('Vehicle not found', false, 404),
      );

      await expect(
        service.approve(reviewer(), 'req-1', approveDto),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('turns a serialization failure into a retryable conflict', async () => {
      arrangeApprove();
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('conflict', {
          code: 'P2034',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.approve(reviewer(), 'req-1', approveDto),
      ).rejects.toThrow(/try again/);
    });

    it('records a rejection with its reason and no allocation', async () => {
      prisma.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(row())
        .mockResolvedValueOnce(row({ status: 'REJECTED' }));
      directory.resolve.mockResolvedValue({ person: null, people: [] });
      prisma.marketingTransportRequest.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.reject(reviewer(), 'req-1', { note: 'No vehicle free' });

      const data = callArg(prisma.marketingTransportRequest.updateMany).data;
      expect(data).toMatchObject({
        status: 'REJECTED',
        reviewedByName: 'Kojo',
        reviewNote: 'No vehicle free',
      });
      expect(data).not.toHaveProperty('vehicleAssetId');
    });

    it('does not let anyone review their own request', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());

      await expect(
        service.approve(user(), 'req-1', approveDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.reject(user(), 'req-1', {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('only reviews pending requests', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        row({ status: 'APPROVED' }),
      );

      await expect(
        service.approve(reviewer(), 'req-1', approveDto),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.reject(reviewer(), 'req-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('loses cleanly when another reviewer got there first', async () => {
      arrangeApprove();
      tx.marketingTransportRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.approve(reviewer(), 'req-1', approveDto),
      ).rejects.toThrow(/already been reviewed/);
    });

    it('returns 404 for a request in another tenant', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.approve(reviewer(), 'req-1', approveDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('allocationOptions', () => {
    it('flags maintenance and double-booked vehicles and drivers, and hides retired', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());
      fleet.listVehicles.mockResolvedValue([
        { id: 'v1', name: 'Hilux', assetNumber: 'VEH-1', status: 'AVAILABLE' },
        { id: 'v2', name: 'Van', assetNumber: 'VEH-2', status: 'MAINTENANCE' },
        { id: 'v3', name: 'Old bus', assetNumber: 'VEH-3', status: 'RETIRED' },
        { id: 'v4', name: 'Pickup', assetNumber: 'VEH-4', status: 'AVAILABLE' },
      ]);
      officers.activeDrivers.mockResolvedValue([
        { employeeId: 'e1', name: 'Ama Mensah', department: null },
        { employeeId: 'e2', name: 'Kofi Boateng', department: null },
      ]);
      prisma.marketingFleetVehicle.findMany.mockResolvedValue([
        { assetId: 'v1', make: 'Toyota', model: 'Hilux' },
      ]);
      prisma.marketingTransportRequest.findMany.mockResolvedValue([
        {
          vehicleAssetId: 'v4',
          driverEmployeeId: 'e2',
          departureTime: '09:00',
          returnTime: '12:00',
          requesterName: 'Efua',
        },
      ]);

      const result = await service.allocationOptions(user(), 'req-1');

      expect(result.vehicles.map((v) => [v.assetId, v.available])).toEqual([
        ['v1', true],
        ['v2', false],
        ['v4', false],
      ]);
      expect(result.vehicles[0].name).toBe('Toyota Hilux');
      expect(result.vehicles[1].unavailableReason).toBe('Under maintenance');
      expect(result.vehicles[2].unavailableReason).toContain("Efua's trip");
      expect(result.drivers.map((d) => [d.employeeId, d.available])).toEqual([
        ['e1', true],
        ['e2', false],
      ]);
    });

    it('returns 404 for a request in another tenant', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.allocationOptions(user(), 'req-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('formOptions', () => {
    it('returns the requester and everyone else as passengers', async () => {
      directory.list.mockResolvedValue([ama, kofi]);
      directory.resolve.mockResolvedValue({ person: ama, people: [] });

      const result = await service.formOptions(user());

      expect(result.requester).toEqual({
        name: 'Ama Mensah',
        department: 'Operations',
      });
      expect(result.employees).toEqual([kofi]);
    });
  });
});
