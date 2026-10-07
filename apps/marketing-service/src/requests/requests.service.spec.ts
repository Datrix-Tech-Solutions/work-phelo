import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
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
    stops: { create: unknown[] };
    destination: string;
  };
};
const callArg = (fn: jest.Mock): CallArg => (fn.mock.calls[0] as [CallArg])[0];

type WhereCall = [{ where: Record<string, unknown> }];
/** The Nth lookup made inside the allocation transaction: 0 = overdue trips, 1 = overlapping trips. */
const txLookup = (fn: jest.Mock, n: number) =>
  (fn.mock.calls[n] as WhereCall)[0].where;

const at = (date: string) => new Date(`${date}T00:00:00.000Z`);
/** The time/status half of a lookup made inside the allocation transaction (first AND term). */
const timeTerm = (where: Record<string, unknown>) =>
  (where.AND as Record<string, unknown>[])[0];
/** The vehicle/driver half (second AND term's OR). */
const ownersTerm = (where: Record<string, unknown>) =>
  (where.AND as { OR: unknown[] }[])[1].OR;

/** The return details every completion must carry besides the time. */
const returnDetails = {
  endingMileage: 48390,
  endingCondition: 'GOOD' as const,
};

const TENANT = '11111111-1111-4111-8111-111111111111';
const today = new Date().toISOString().slice(0, 10);
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
  purpose: 'MARKETING' as const,
  travelDate: future,
  departureTime: '08:00',
  returnTime: '17:00',
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    tenantId: TENANT,
    requesterUserId: 'user-1',
    requesterEmployeeId: 'e1',
    requesterName: 'Ama Mensah',
    requesterDepartment: 'Operations',
    purpose: 'MARKETING',
    businessPurpose: null,
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
    vehicleAssetId: null,
    vehicleName: null,
    vehicleAssetNumber: null,
    driverEmployeeId: null,
    driverName: null,
    selfDriven: false,
    startedAt: null,
    startedByUserId: null,
    startedByName: null,
    actualDepartureTime: null,
    startingMileage: null,
    startingCondition: null,
    startNotes: null,
    cancelledAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    passengers: [],
    stops: [],
    ...overrides,
  };
}

describe('RequestsService', () => {
  const tx = {
    marketingFleetVehicle: { updateMany: jest.fn() },
    marketingTransportRequestPassenger: { deleteMany: jest.fn() },
    marketingTransportRequestStop: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    marketingTransportRequest: {
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
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
    marketingClient: { findMany: jest.fn() },
    marketingProspect: { findMany: jest.fn() },
    marketingAppointment: { findFirst: jest.fn() },
    marketingTransportRequestStop: { findMany: jest.fn() },
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
  // "Now" for the tests: far enough before `future` that default rows are upcoming.
  const trips = { now: jest.fn() };
  const notifier = {
    requested: jest.fn(),
    approved: jest.fn(),
    rejected: jest.fn(),
    rescheduled: jest.fn(),
    cancelled: jest.fn(),
  };
  const service = new RequestsService(
    prisma as never,
    directory as never,
    fleet as never,
    officers as never,
    trips as never,
    notifier as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    officers.assertActiveOfficer.mockResolvedValue(undefined);
    prisma.marketingClient.findMany.mockResolvedValue([]);
    prisma.marketingProspect.findMany.mockResolvedValue([]);
    prisma.marketingTransportRequestStop.findMany.mockResolvedValue([]);
    trips.now.mockReturnValue({ date: today, time: '12:00' });
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: typeof tx) => unknown)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    );
  });

  describe('create from an approved appointment', () => {
    const appointment = (overrides: Record<string, unknown> = {}) => ({
      id: 'appt-1',
      tenantId: TENANT,
      prospectId: 'p1',
      marketerUserId: 'user-1',
      managerUserId: null,
      status: 'APPROVED',
      ...overrides,
    });
    const beta = {
      id: 'p1',
      companyName: 'Beta Co',
      locationLabel: 'Kumasi',
      latitude: 6.69,
      longitude: -1.62,
    };

    beforeEach(() => {
      directory.resolve.mockResolvedValue({ person: ama, people: [] });
      prisma.marketingTransportRequest.create.mockResolvedValue(row());
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(null);
      prisma.marketingAppointment.findFirst.mockResolvedValue(appointment());
      prisma.marketingProspect.findMany.mockResolvedValue([beta]);
    });

    it('fixes the purpose to marketing and always includes the appointment’s prospect', async () => {
      await service.create(user(), {
        ...createDto,
        purpose: 'PERSONAL',
        destination: 'ignored',
        appointmentId: 'appt-1',
      });

      const { data } = callArg(prisma.marketingTransportRequest.create) as {
        data: Record<string, unknown> & { stops: { create: unknown[] } };
      };
      expect(data).toMatchObject({
        purpose: 'MARKETING',
        appointmentId: 'appt-1',
        destination: 'Beta Co',
      });
      expect(data.stops.create).toEqual([
        expect.objectContaining({ kind: 'PROSPECT', refId: 'p1' }),
      ]);
    });

    it('lets the prospect through even when it is not assigned to the requester', async () => {
      await service.create(user(), { ...createDto, appointmentId: 'appt-1' });

      const where = (
        prisma.marketingProspect.findMany.mock.calls[0] as [
          { where: Record<string, unknown> },
        ]
      )[0].where;
      expect(where.OR).toEqual([{ assignedUserId: 'user-1' }, { id: 'p1' }]);
    });

    it.each(['PENDING', 'REJECTED', 'CANCELLED', 'COMPLETED'])(
      'refuses a %s appointment',
      async (status) => {
        prisma.marketingAppointment.findFirst.mockResolvedValue(
          appointment({ status }),
        );
        await expect(
          service.create(user(), { ...createDto, appointmentId: 'appt-1' }),
        ).rejects.toThrow(/approved appointment/);
      },
    );

    it('hides an appointment that belongs to someone else', async () => {
      prisma.marketingAppointment.findFirst.mockResolvedValue(
        appointment({ marketerUserId: 'someone-else' }),
      );
      await expect(
        service.create(user(), { ...createDto, appointmentId: 'appt-1' }),
      ).rejects.toThrow(/Appointment not found/);
    });

    it('lets the manager, or someone who can approve appointments, request for it', async () => {
      prisma.marketingAppointment.findFirst.mockResolvedValue(
        appointment({
          marketerUserId: 'someone-else',
          managerUserId: 'user-1',
        }),
      );
      await expect(
        service.create(user(), { ...createDto, appointmentId: 'appt-1' }),
      ).resolves.toBeDefined();
    });

    it('refuses a second request for the same appointment', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue({
        id: 'other',
      });
      await expect(
        service.create(user(), { ...createDto, appointmentId: 'appt-1' }),
      ).rejects.toThrow(/already has a transport request/);
    });
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
      expect(notifier.requested).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ id: 'req-1' }),
      );
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

    it('searches purpose, destination and requester name', async () => {
      await service.list(user(), { search: 'kum' });
      expect(whereOf()).toMatchObject({
        AND: [
          {
            OR: expect.arrayContaining([
              { destination: { contains: 'kum', mode: 'insensitive' } },
            ]) as unknown,
          },
        ],
      });
    });

    describe('status filter', () => {
      const statusClause = (status: string[]) =>
        service
          .list(user(), { status: status as never })
          .then(() => (whereOf().AND as { OR: unknown[] }[])[0].OR);

      it.each(['PENDING', 'REJECTED', 'CANCELLED', 'COMPLETED'])(
        'matches %s exactly',
        async (status) => {
          expect(await statusClause([status])).toEqual([{ status }]);
        },
      );

      it('APPROVED means approved and not yet started', async () => {
        expect(await statusClause(['APPROVED'])).toEqual([
          { status: 'APPROVED', startedAt: null },
        ]);
      });

      it('ON_ROUTE means approved, started and not yet completed', async () => {
        expect(await statusClause(['ON_ROUTE'])).toEqual([
          { status: 'APPROVED', startedAt: { not: null } },
        ]);
      });

      it('combines several statuses, with the search alongside', async () => {
        await service.list(user(), {
          status: ['COMPLETED', 'REJECTED', 'CANCELLED'],
          search: 'kum',
        });

        const and = whereOf().AND as { OR: unknown[] }[];
        expect(and).toHaveLength(2);
        expect(and[0].OR).toHaveLength(3);
      });

      it('adds no status condition when none is given', async () => {
        await service.list(user());
        expect(whereOf().AND).toEqual([]);
      });
    });
  });

  describe('passenger count (people in the vehicle excluding the driver)', () => {
    const person = (employeeId: string) => ({
      id: `p-${employeeId}`,
      employeeId,
      name: `Person ${employeeId}`,
      department: null,
    });
    const countFor = async (overrides: Record<string, unknown>) => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        row(overrides),
      );
      return service.findOne(user(), 'req-1');
    };

    it('counts the requester when nobody else is added', async () => {
      const result = await countFor({ passengers: [] });
      expect(result.passengerCount).toBe(1);
      expect(result.requesterIsDriver).toBe(false);
    });

    it('adds the chosen passengers to the requester', async () => {
      const result = await countFor({
        passengers: [person('e2'), person('e3')],
      });
      expect(result.passengerCount).toBe(3);
    });

    it('does not count the requester when they drive themselves', async () => {
      const result = await countFor({
        status: 'APPROVED',
        selfDriven: true,
        passengers: [person('e2'), person('e3')],
      });
      expect(result.passengerCount).toBe(2);
      expect(result.requesterIsDriver).toBe(true);
    });

    it('is zero for a self-driven trip with nobody else', async () => {
      const result = await countFor({
        status: 'APPROVED',
        selfDriven: true,
        passengers: [],
      });
      expect(result.passengerCount).toBe(0);
    });

    it('counts the requester plus passengers when a separate driver is assigned', async () => {
      const result = await countFor({
        status: 'APPROVED',
        driverEmployeeId: 'e5',
        passengers: [person('e2')],
      });
      expect(result.passengerCount).toBe(2);
      expect(result.requesterIsDriver).toBe(false);
    });

    it('counts a passenger who is also the assigned driver as the driver only', async () => {
      const result = await countFor({
        status: 'APPROVED',
        driverEmployeeId: 'e2',
        passengers: [person('e2'), person('e3')],
      });
      expect(result.passengerCount).toBe(2);
    });

    it('treats an assigned driver who is the requester as the requester driving', async () => {
      const result = await countFor({
        status: 'APPROVED',
        requesterEmployeeId: 'e1',
        driverEmployeeId: 'e1',
        selfDriven: false,
        passengers: [person('e2')],
      });
      expect(result.passengerCount).toBe(1);
      expect(result.requesterIsDriver).toBe(true);
    });
  });

  describe('request status and trip details', () => {
    const at = (date: string) => new Date(`${date}T00:00:00.000Z`);
    const viewOne = async (overrides: Record<string, unknown>) => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        row(overrides),
      );
      return service.findOne(user(), 'req-1');
    };

    it('reads an approved trip that has not departed as APPROVED', async () => {
      const result = await viewOne({ status: 'APPROVED' });
      expect(result.status).toBe('APPROVED');
      expect(result.overdue).toBe(false);
    });

    it('goes on route only once started, never by the clock', async () => {
      const trip = {
        status: 'APPROVED',
        travelDate: at(today),
        departureTime: '08:00',
        returnTime: '15:00',
      };
      expect((await viewOne({ ...trip, startedAt: new Date() })).status).toBe(
        'ON_ROUTE',
      );
      expect((await viewOne(trip)).status).toBe('APPROVED');
    });

    it('keeps a trip on route, flagged overdue, after its return time until someone completes it', async () => {
      const result = await viewOne({
        status: 'APPROVED',
        travelDate: at('2020-01-01'),
        startedAt: new Date('2020-01-01T08:00:00.000Z'),
      });
      expect(result.status).toBe('ON_ROUTE');
      expect(result.overdue).toBe(true);
    });

    it('is overdue the minute the return time arrives, not before', async () => {
      const trip = {
        status: 'APPROVED',
        travelDate: at(today),
        departureTime: '08:00',
        startedAt: new Date(),
      };
      expect((await viewOne({ ...trip, returnTime: '12:00' })).overdue).toBe(
        true,
      );
      expect((await viewOne({ ...trip, returnTime: '12:01' })).overdue).toBe(
        false,
      );
    });

    it.each(['PENDING', 'REJECTED', 'CANCELLED'])(
      'never turns a %s request into on route, however old',
      async (status) => {
        const result = await viewOne({ status, travelDate: at('2020-01-01') });
        expect(result.status).toBe(status);
        expect(result.overdue).toBe(false);
      },
    );

    it('shows how a completed trip went: on time, late or early', async () => {
      const completed = {
        status: 'COMPLETED',
        returnTime: '12:00',
        completedAt: new Date('2026-10-02T13:00:00.000Z'),
        completedByName: 'Kojo Asante',
      };
      const late = await viewOne({ ...completed, actualReturnTime: '12:40' });
      expect(late.status).toBe('COMPLETED');
      expect(late.completion).toMatchObject({
        byName: 'Kojo Asante',
        actualReturnTime: '12:40',
        minutesLate: 40,
      });
      expect(
        (await viewOne({ ...completed, actualReturnTime: '11:45' })).completion
          ?.minutesLate,
      ).toBe(-15);
      expect(
        (await viewOne({ ...completed, actualReturnTime: '12:00' })).completion
          ?.minutesLate,
      ).toBe(0);
    });

    it('copes with a completed trip whose return time was never recorded', async () => {
      const result = await viewOne({
        status: 'COMPLETED',
        completedAt: new Date(),
        actualReturnTime: null,
      });
      expect(result.completion).toMatchObject({
        actualReturnTime: null,
        minutesLate: null,
      });
    });

    it('shows where a rescheduled trip was moved from', async () => {
      const result = await viewOne({
        status: 'APPROVED',
        rescheduleCount: 1,
        rescheduledAt: new Date('2026-10-02T13:00:00.000Z'),
        rescheduledByName: 'Kojo Asante',
        previousTravelDate: at('2026-10-20'),
        previousDepartureTime: '10:00',
        previousReturnTime: '12:00',
      });
      expect(result.reschedule).toEqual({
        count: 1,
        at: '2026-10-02T13:00:00.000Z',
        byName: 'Kojo Asante',
        previous: {
          travelDate: '2026-10-20',
          departureTime: '10:00',
          returnTime: '12:00',
        },
      });
    });

    it('has no reschedule details for a trip never moved', async () => {
      expect((await viewOne({ status: 'APPROVED' })).reschedule).toBeNull();
    });
  });

  describe('complete', () => {
    const at = (date: string) => new Date(`${date}T00:00:00.000Z`);
    const approver = () =>
      user({ id: 'user-9', permissions: ['marketing.requests.all:APPROVE'] });
    const overdueTrip = (overrides: Record<string, unknown> = {}) =>
      row({
        status: 'APPROVED',
        travelDate: at(today),
        departureTime: '08:00',
        returnTime: '11:00',
        startedAt: new Date(),
        ...overrides,
      });

    function arrange(requestRow = overdueTrip()) {
      prisma.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(requestRow)
        .mockResolvedValueOnce(
          row({
            status: 'COMPLETED',
            completedAt: new Date(),
            completedByName: 'Ama Mensah',
            actualReturnTime: '11:40',
            returnTime: '11:00',
          }),
        );
      directory.resolve.mockResolvedValue({
        person: { employeeId: 'e1', name: 'Ama Mensah', department: null },
        people: [],
      });
      tx.marketingTransportRequest.updateMany.mockResolvedValue({ count: 1 });
    }

    it('lets the requester complete an overdue trip and records the actual return', async () => {
      arrange();

      const result = await service.complete(user(), 'req-1', {
        ...returnDetails,
        actualReturnTime: '11:40',
      });

      expect(callArg(tx.marketingTransportRequest.updateMany)).toMatchObject({
        where: { id: 'req-1', tenantId: TENANT, status: 'APPROVED' },
        data: {
          status: 'COMPLETED',
          completedByUserId: 'user-1',
          completedByName: 'Ama Mensah',
          actualReturnTime: '11:40',
        },
      });
      expect(result.status).toBe('COMPLETED');
      expect(result.completion?.minutesLate).toBe(40);
    });

    it('records the return details and updates the vehicle mileage and condition', async () => {
      arrange(overdueTrip({ startingMileage: 48210, vehicleAssetId: 'veh-1' }));
      fleet.updateVehicle.mockResolvedValue({});
      tx.marketingFleetVehicle.updateMany.mockResolvedValue({ count: 1 });

      await service.complete(user(), 'req-1', {
        ...returnDetails,
        actualReturnTime: '11:40',
        notes: 'Small scratch on the door',
      });

      expect(callArg(tx.marketingTransportRequest.updateMany)).toMatchObject({
        data: {
          endingMileage: 48390,
          endingCondition: 'GOOD',
          completionNotes: 'Small scratch on the door',
        },
      });
      expect(callArg(tx.marketingFleetVehicle.updateMany)).toMatchObject({
        data: { currentMileage: 48390 },
      });
      expect(fleet.updateVehicle).toHaveBeenCalledWith(TENANT, 'veh-1', {
        condition: 'GOOD',
      });
    });

    it('completes without an ending mileage and leaves the vehicle mileage alone', async () => {
      arrange(overdueTrip({ vehicleAssetId: 'veh-1' }));
      fleet.updateVehicle.mockResolvedValue({});

      await service.complete(user(), 'req-1', {
        endingCondition: 'FAIR',
        actualReturnTime: '11:40',
      });

      expect(callArg(tx.marketingTransportRequest.updateMany)).toMatchObject({
        data: { endingMileage: null, endingCondition: 'FAIR' },
      });
      expect(tx.marketingFleetVehicle.updateMany).not.toHaveBeenCalled();
      expect(fleet.updateVehicle).toHaveBeenCalledWith(TENANT, 'veh-1', {
        condition: 'FAIR',
      });
    });

    it('rejects an ending mileage below the starting mileage', async () => {
      arrange(overdueTrip({ startingMileage: 50000 }));

      await expect(
        service.complete(user(), 'req-1', {
          ...returnDetails,
          actualReturnTime: '11:40',
        }),
      ).rejects.toThrow(/below the starting mileage/);
    });

    it('still completes when the vehicle condition cannot be updated in HR', async () => {
      arrange();
      fleet.updateVehicle.mockRejectedValue(new Error('hr down'));

      await expect(
        service.complete(user(), 'req-1', {
          ...returnDetails,
          actualReturnTime: '11:40',
        }),
      ).resolves.toBeDefined();
    });

    it('lets an approver complete someone else’s trip', async () => {
      arrange();

      await expect(
        service.complete(approver(), 'req-1', {
          ...returnDetails,
          actualReturnTime: '11:30',
        }),
      ).resolves.toBeDefined();
    });

    it('hides the trip from someone who is neither the requester nor an approver', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        overdueTrip(),
      );

      await expect(
        service.complete(user({ id: 'someone-else' }), 'req-1', {
          ...returnDetails,
          actualReturnTime: '11:30',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        prisma.marketingTransportRequest.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('cannot complete a trip before its return time', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        overdueTrip({ returnTime: '12:01' }),
      );

      await expect(
        service.complete(user(), 'req-1', {
          ...returnDetails,
          actualReturnTime: '11:00',
        }),
      ).rejects.toThrow(/after its return time/);
    });

    it('can complete a trip on the minute it is due back', async () => {
      arrange(overdueTrip({ returnTime: '12:00' }));

      await expect(
        service.complete(user(), 'req-1', {
          ...returnDetails,
          actualReturnTime: '12:00',
        }),
      ).resolves.toBeDefined();
    });

    it.each(['PENDING', 'REJECTED', 'CANCELLED'])(
      'cannot complete a %s request',
      async (status) => {
        prisma.marketingTransportRequest.findFirst.mockResolvedValue(
          overdueTrip({ status }),
        );

        await expect(
          service.complete(user(), 'req-1', {
            ...returnDetails,
            actualReturnTime: '11:30',
          }),
        ).rejects.toThrow(/Only approved trips/);
      },
    );

    it('is final: a completed trip cannot be completed again', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        overdueTrip({ status: 'COMPLETED' }),
      );

      await expect(
        service.complete(user(), 'req-1', {
          ...returnDetails,
          actualReturnTime: '11:30',
        }),
      ).rejects.toThrow(/already completed/);
    });

    it('rejects a return time before or at the departure', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        overdueTrip(),
      );

      await expect(
        service.complete(user(), 'req-1', {
          ...returnDetails,
          actualReturnTime: '07:59',
        }),
      ).rejects.toThrow(/after the departure time/);
      await expect(
        service.complete(user(), 'req-1', {
          ...returnDetails,
          actualReturnTime: '08:00',
        }),
      ).rejects.toThrow(/after the departure time/);
    });

    it('rejects a return time in the future when the trip was today', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        overdueTrip(),
      );

      await expect(
        service.complete(user(), 'req-1', {
          ...returnDetails,
          actualReturnTime: '12:01',
        }),
      ).rejects.toThrow(/cannot be in the future/);
    });

    it('allows any return time after departure for a trip from an earlier day', async () => {
      arrange(overdueTrip({ travelDate: at('2020-01-01') }));

      await expect(
        service.complete(user(), 'req-1', {
          ...returnDetails,
          actualReturnTime: '23:30',
        }),
      ).resolves.toBeDefined();
    });

    it('loses cleanly if the trip changed while completing', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        overdueTrip(),
      );
      directory.resolve.mockResolvedValue({ person: null, people: [] });
      tx.marketingTransportRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.complete(user(), 'req-1', {
          ...returnDetails,
          actualReturnTime: '11:30',
        }),
      ).rejects.toThrow(/can no longer be completed/);
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
        service.update(user(), 'req-1', { purpose: 'PERSONAL' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects edits once the request is no longer pending', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        row({ status: 'APPROVED' }),
      );

      await expect(
        service.update(user(), 'req-1', { purpose: 'PERSONAL' }),
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
      await service.update(user(), 'req-1', { purpose: 'PERSONAL' });
      expect(
        tx.marketingTransportRequestPassenger.deleteMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    const at = (date: string) => new Date(`${date}T00:00:00.000Z`);

    it('can cancel a trip that is on route, even overdue', async () => {
      prisma.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(
          row({ status: 'APPROVED', travelDate: at('2020-01-01') }),
        )
        .mockResolvedValueOnce(row({ status: 'CANCELLED' }));
      prisma.marketingTransportRequest.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.cancel(user(), 'req-1');

      expect(result.status).toBe('CANCELLED');
      expect(notifier.cancelled).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ id: 'req-1' }),
        'user-1',
      );
    });

    it('lets an approver cancel someone else’s trip, for example one nobody went on', async () => {
      prisma.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(
          row({ status: 'APPROVED', requesterUserId: 'user-1' }),
        )
        .mockResolvedValueOnce(row({ status: 'CANCELLED' }));
      prisma.marketingTransportRequest.updateMany.mockResolvedValue({
        count: 1,
      });

      await expect(
        service.cancel(
          user({
            id: 'user-9',
            permissions: ['marketing.requests.all:APPROVE'],
          }),
          'req-1',
        ),
      ).resolves.toBeDefined();
    });

    it('hides the request from someone who is neither the requester nor an approver', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());

      await expect(
        service.cancel(user({ id: 'someone-else' }), 'req-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cannot cancel a completed trip', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        row({ status: 'COMPLETED' }),
      );

      await expect(service.cancel(user(), 'req-1')).rejects.toThrow(
        /completed request cannot be cancelled/,
      );
      expect(
        prisma.marketingTransportRequest.updateMany,
      ).not.toHaveBeenCalled();
    });

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
      tx.marketingTransportRequest.findFirst.mockResolvedValue(null);
      tx.marketingTransportRequest.updateMany.mockResolvedValue({ count: 1 });
    }

    it('approves with a vehicle and driver and records the allocation', async () => {
      arrangeApprove();

      const result = await service.approve(reviewer(), 'req-1', approveDto);

      expect(notifier.approved).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ id: 'req-1' }),
        'user-2',
      );

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
        driver: { employeeId: 'e5', name: 'Yaw Owusu', selfDriven: false },
      });
    });

    describe('self-driven trips', () => {
      const selfDrivenDto = { vehicleAssetId: 'veh-1', selfDriven: true };

      it('allocates only the vehicle and records the requester as the driver', async () => {
        arrangeApprove();

        await service.approve(reviewer(), 'req-1', selfDrivenDto);

        expect(
          callArg(tx.marketingTransportRequest.updateMany).data,
        ).toMatchObject({
          status: 'APPROVED',
          vehicleAssetId: 'veh-1',
          selfDriven: true,
          driverEmployeeId: 'e1',
          driverName: 'Ama Mensah',
        });
      });

      it('needs no transport officer, so the officer check is skipped', async () => {
        arrangeApprove();

        await service.approve(reviewer(), 'req-1', selfDrivenDto);

        expect(officers.assertActiveOfficer).not.toHaveBeenCalled();
        expect(directory.resolve).toHaveBeenCalledWith(TENANT, {
          userId: 'user-2',
        });
      });

      it('still stops the requester being double-booked as a driver', async () => {
        arrangeApprove();
        tx.marketingTransportRequest.findFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            vehicleAssetId: 'other',
            driverEmployeeId: 'e1',
            departureTime: '09:00',
            returnTime: '12:00',
            requesterName: 'Efua',
          });

        await expect(
          service.approve(reviewer(), 'req-1', selfDrivenDto),
        ).rejects.toThrow(/Ama Mensah is already allocated/);
        expect(
          ownersTerm(txLookup(tx.marketingTransportRequest.findFirst, 1)),
        ).toEqual([{ vehicleAssetId: 'veh-1' }, { driverEmployeeId: 'e1' }]);
      });

      it('skips the driver clash check when the requester has no employee record', async () => {
        arrangeApprove();
        prisma.marketingTransportRequest.findFirst.mockReset();
        prisma.marketingTransportRequest.findFirst
          .mockResolvedValueOnce(row({ requesterEmployeeId: null }))
          .mockResolvedValueOnce(
            row({
              status: 'APPROVED',
              selfDriven: true,
              vehicleAssetId: 'veh-1',
            }),
          );

        await service.approve(reviewer(), 'req-1', selfDrivenDto);

        expect(
          ownersTerm(txLookup(tx.marketingTransportRequest.findFirst, 1)),
        ).toEqual([{ vehicleAssetId: 'veh-1' }]);
      });

      it('still checks the vehicle', async () => {
        arrangeApprove();
        fleet.getVehicle.mockResolvedValue(
          hrVehicle({ status: 'MAINTENANCE' }),
        );

        await expect(
          service.approve(reviewer(), 'req-1', selfDrivenDto),
        ).rejects.toThrow(/under maintenance/);
      });

      it('shows the allocation as self-driven', async () => {
        prisma.marketingTransportRequest.findFirst
          .mockResolvedValueOnce(row())
          .mockResolvedValueOnce(
            row({
              status: 'APPROVED',
              vehicleAssetId: 'veh-1',
              vehicleName: 'Toyota Hilux',
              vehicleAssetNumber: 'VEH-0001',
              driverEmployeeId: 'e1',
              driverName: 'Ama Mensah',
              selfDriven: true,
            }),
          );
        directory.resolve.mockResolvedValue(resolvedFor());
        fleet.getVehicle.mockResolvedValue(hrVehicle());
        prisma.marketingFleetVehicle.findUnique.mockResolvedValue(null);
        tx.marketingTransportRequest.findFirst.mockResolvedValue(null);
        tx.marketingTransportRequest.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.approve(
          reviewer(),
          'req-1',
          selfDrivenDto,
        );

        expect(result.allocation?.driver).toEqual({
          employeeId: 'e1',
          name: 'Ama Mensah',
          selfDriven: true,
        });
      });

      it('shows a self-driven allocation even when the requester has no employee record', async () => {
        prisma.marketingTransportRequest.findFirst.mockResolvedValue(
          row({
            status: 'APPROVED',
            vehicleAssetId: 'veh-1',
            driverEmployeeId: null,
            driverName: 'Ama',
            selfDriven: true,
          }),
        );

        const result = await service.findOne(user(), 'req-1');

        expect(result.allocation?.driver).toEqual({
          employeeId: null,
          name: 'Ama',
          selfDriven: true,
        });
      });
    });

    it.each([
      [
        'both a driver and self-driven',
        { driverEmployeeId: 'e5', selfDriven: true },
        /not both/,
      ],
      ['neither a driver nor self-driven', {}, /Select a driver/],
      [
        'self-driven explicitly false and no driver',
        { selfDriven: false },
        /Select a driver/,
      ],
    ])('rejects %s', async (_label, patch, message) => {
      arrangeApprove();

      await expect(
        service.approve(reviewer(), 'req-1', {
          vehicleAssetId: 'veh-1',
          ...patch,
        }),
      ).rejects.toThrow(message);
      expect(prisma.$transaction).not.toHaveBeenCalled();
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

    it('checks clashes against approved trips whose window overlaps', async () => {
      arrangeApprove();

      await service.approve(reviewer(), 'req-1', approveDto);

      const where = txLookup(tx.marketingTransportRequest.findFirst, 1);
      expect(timeTerm(where)).toMatchObject({
        tenantId: TENANT,
        status: 'APPROVED',
        id: { not: 'req-1' },
        AND: [
          {
            // The other trip ends after this one starts, or has no end.
            OR: [
              { returnTime: null },
              { travelDate: { gt: at(future) } },
              { travelDate: at(future), returnTime: { gt: '08:00' } },
            ],
          },
          {
            // The other trip starts before this one ends.
            OR: [
              { travelDate: { lt: at(future) } },
              { travelDate: at(future), departureTime: { lt: '17:00' } },
            ],
          },
        ],
      });
      expect(ownersTerm(where)).toEqual([
        { vehicleAssetId: 'veh-1' },
        { driverEmployeeId: 'e5' },
      ]);
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
      tx.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          ...clash,
          departureTime: '09:00',
          returnTime: '12:00',
          requesterName: 'Efua',
        });

      await expect(
        service.approve(reviewer(), 'req-1', approveDto),
      ).rejects.toThrow(message);
      expect(tx.marketingTransportRequest.updateMany).not.toHaveBeenCalled();
    });

    it('will not approve onto a vehicle or driver still out on an overdue, unresolved trip', async () => {
      arrangeApprove();
      tx.marketingTransportRequest.findFirst.mockResolvedValueOnce({
        vehicleAssetId: 'veh-1',
        travelDate: new Date('2026-10-01T00:00:00.000Z'),
        departureTime: '10:00',
        returnTime: '12:00',
        requesterName: 'Kwame',
      });

      await expect(
        service.approve(reviewer(), 'req-1', approveDto),
      ).rejects.toThrow(
        /Toyota Hilux is still out on Kwame's trip \(2026-10-01 10:00–12:00\)\. Complete it first/,
      );
      expect(tx.marketingTransportRequest.updateMany).not.toHaveBeenCalled();
    });

    it('looks for still-out trips for this vehicle or driver, keeping the time test (regression)', async () => {
      arrangeApprove();

      await service.approve(reviewer(), 'req-1', approveDto);

      const where = txLookup(tx.marketingTransportRequest.findFirst, 0);
      const stale = timeTerm(where);
      expect(stale).toMatchObject({
        tenantId: TENANT,
        status: 'APPROVED',
        id: { not: 'req-1' },
      });
      // Only a started trip is still out. Two cases: no return time, or past the return time. These
      // used to be overwritten by the vehicle/driver OR, so ANY other approved trip blocked the approval.
      expect(stale).toMatchObject({ startedAt: { not: null } });
      expect(stale.OR).toHaveLength(2);
      expect(stale.OR).toEqual([
        { returnTime: null },
        expect.objectContaining({ returnTime: { not: null } }),
      ]);
      expect(ownersTerm(where)).toEqual([
        { vehicleAssetId: 'veh-1' },
        { driverEmployeeId: 'e5' },
      ]);
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
      expect(notifier.rejected).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ id: 'req-1' }),
        'user-2',
      );
    });

    it('lets the requester approve their own request, since the permission is the only gate', async () => {
      arrangeApprove();
      // arrangeApprove's first lookup is a request raised by user-1; approve as that same user.
      const requester = user({ id: 'user-1', firstName: 'Ama' });

      await expect(
        service.approve(requester, 'req-1', approveDto),
      ).resolves.toBeDefined();
      expect(
        callArg(tx.marketingTransportRequest.updateMany).data,
      ).toMatchObject({ status: 'APPROVED', reviewedByUserId: 'user-1' });
    });

    it('lets the requester reject their own request too', async () => {
      prisma.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(row())
        .mockResolvedValueOnce(row({ status: 'REJECTED' }));
      directory.resolve.mockResolvedValue({ person: null, people: [] });
      prisma.marketingTransportRequest.updateMany.mockResolvedValue({
        count: 1,
      });

      await expect(
        service.reject(user({ id: 'user-1' }), 'req-1', {}),
      ).resolves.toBeDefined();
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
    const at = (date: string) => new Date(`${date}T00:00:00.000Z`);
    const hrVehicles = [
      { id: 'v1', name: 'Hilux', assetNumber: 'VEH-1', status: 'AVAILABLE' },
      { id: 'v2', name: 'Van', assetNumber: 'VEH-2', status: 'MAINTENANCE' },
      { id: 'v3', name: 'Old bus', assetNumber: 'VEH-3', status: 'RETIRED' },
      { id: 'v4', name: 'Pickup', assetNumber: 'VEH-4', status: 'AVAILABLE' },
      { id: 'v5', name: 'Truck', assetNumber: 'VEH-5', status: 'AVAILABLE' },
    ];

    function arrange(overlapping: unknown[] = [], overdue: unknown[] = []) {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());
      fleet.listVehicles.mockResolvedValue(hrVehicles);
      officers.activeDrivers.mockResolvedValue([
        { employeeId: 'e1', name: 'Ama Mensah', department: null },
        { employeeId: 'e2', name: 'Kofi Boateng', department: null },
        { employeeId: 'e3', name: 'Yaw Owusu', department: null },
      ]);
      prisma.marketingFleetVehicle.findMany.mockResolvedValue([
        { assetId: 'v1', make: 'Toyota', model: 'Hilux' },
      ]);
      // First lookup = overlapping approved trips, second = overdue unresolved trips.
      prisma.marketingTransportRequest.findMany
        .mockResolvedValueOnce(overlapping)
        .mockResolvedValueOnce(overdue);
    }

    it('flags maintenance, overdue and double-booked vehicles and drivers, and hides retired', async () => {
      arrange(
        [
          {
            vehicleAssetId: 'v4',
            driverEmployeeId: 'e2',
            departureTime: '09:00',
            returnTime: '12:00',
            requesterName: 'Efua',
          },
        ],
        [
          {
            vehicleAssetId: 'v5',
            driverEmployeeId: 'e3',
            travelDate: at('2026-10-01'),
            departureTime: '10:00',
            returnTime: '12:00',
            requesterName: 'Kwame',
          },
        ],
      );

      const result = await service.allocationOptions(user(), 'req-1');

      expect(
        result.vehicles.map((v) => [v.assetId, v.available, v.unavailableKind]),
      ).toEqual([
        ['v1', true, null],
        ['v2', false, 'MAINTENANCE'],
        ['v4', false, 'BOOKED'],
        ['v5', false, 'OVERDUE'],
      ]);
      expect(result.vehicles[0].name).toBe('Toyota Hilux');
      expect(result.vehicles[1].unavailableReason).toBe('Under maintenance');
      expect(result.vehicles[2].unavailableReason).toContain("Efua's trip");
      expect(result.vehicles[3].unavailableReason).toContain(
        "Still out on Kwame's trip (2026-10-01 10:00–12:00). Complete it first",
      );
      expect(
        result.drivers.map((d) => [
          d.employeeId,
          d.available,
          d.unavailableKind,
        ]),
      ).toEqual([
        ['e1', true, null],
        ['e2', false, 'BOOKED'],
        ['e3', false, 'OVERDUE'],
      ]);
    });

    it('treats an overdue unresolved trip as blocking even when it also overlaps', async () => {
      const both = {
        vehicleAssetId: 'v1',
        driverEmployeeId: 'e1',
        travelDate: at(today),
        departureTime: '08:00',
        returnTime: '11:00',
        requesterName: 'Kwame',
      };
      arrange([both], [both]);

      const result = await service.allocationOptions(user(), 'req-1');

      expect(result.vehicles[0].unavailableKind).toBe('OVERDUE');
      expect(result.drivers[0].unavailableKind).toBe('OVERDUE');
    });

    it('excludes the request itself from the overdue and overlap lookups', async () => {
      arrange();

      await service.allocationOptions(user(), 'req-1');

      const [overlap, overdue] = prisma.marketingTransportRequest.findMany.mock
        .calls as [{ where: Record<string, unknown> }][];
      expect(overlap[0].where).toMatchObject({ id: { not: 'req-1' } });
      expect(overdue[0].where).toMatchObject({
        id: { not: 'req-1' },
        status: 'APPROVED',
      });
    });

    it('checks a different window when rescheduling', async () => {
      arrange();

      await service.allocationOptions(user(), 'req-1', {
        travelDate: future,
        departureTime: '14:00',
        returnTime: '17:00',
      });

      const [overlap] = prisma.marketingTransportRequest.findMany.mock
        .calls as [{ where: Record<string, unknown> }][];
      expect(overlap[0].where).toMatchObject({
        AND: [
          {
            OR: [
              { returnTime: null },
              { travelDate: { gt: at(future) } },
              { travelDate: at(future), returnTime: { gt: '14:00' } },
            ],
          },
          {
            OR: [
              { travelDate: { lt: at(future) } },
              { travelDate: at(future), departureTime: { lt: '17:00' } },
            ],
          },
        ],
      });
    });

    it('needs the whole window, not part of it', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());

      await expect(
        service.allocationOptions(user(), 'req-1', { departureTime: '14:00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.allocationOptions(user(), 'req-1', {
          travelDate: future,
          departureTime: '17:00',
          returnTime: '14:00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns 404 for a request in another tenant', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.allocationOptions(user(), 'req-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reschedule', () => {
    const at = (date: string) => new Date(`${date}T00:00:00.000Z`);
    const reviewer = () => user({ id: 'user-2', firstName: 'Kojo' });
    const dto = {
      travelDate: future,
      departureTime: '14:00',
      returnTime: '17:00',
      vehicleAssetId: 'veh-1',
      driverEmployeeId: 'e5',
    };
    const driver = { employeeId: 'e5', name: 'Yaw Owusu', department: null };
    const approvedRow = (overrides: Record<string, unknown> = {}) =>
      row({
        status: 'APPROVED',
        travelDate: at('2020-01-01'),
        departureTime: '10:00',
        returnTime: '12:00',
        vehicleAssetId: 'veh-1',
        driverEmployeeId: 'e5',
        ...overrides,
      });

    function arrange(existing = approvedRow()) {
      prisma.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(row({ status: 'APPROVED', rescheduleCount: 1 }));
      directory.resolve.mockResolvedValue({
        person: { employeeId: 'e9', name: 'Kojo Asante', department: null },
        people: [driver],
      });
      fleet.getVehicle.mockResolvedValue({
        id: 'veh-1',
        assetNumber: 'VEH-0001',
        name: 'Toyota Hilux',
        status: 'AVAILABLE',
      });
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(null);
      tx.marketingTransportRequest.findFirst.mockResolvedValue(null);
      tx.marketingTransportRequest.updateMany.mockResolvedValue({ count: 1 });
    }

    it('moves the trip to the new window and keeps where it was', async () => {
      arrange();

      await service.reschedule(reviewer(), 'req-1', dto);

      expect(callArg(tx.marketingTransportRequest.updateMany)).toMatchObject({
        where: { id: 'req-1', tenantId: TENANT, status: 'APPROVED' },
        data: {
          travelDate: at(future),
          departureTime: '14:00',
          returnTime: '17:00',
          previousTravelDate: at('2020-01-01'),
          previousDepartureTime: '10:00',
          previousReturnTime: '12:00',
          rescheduleCount: { increment: 1 },
          rescheduledByName: 'Kojo Asante',
          vehicleAssetId: 'veh-1',
          driverEmployeeId: 'e5',
          selfDriven: false,
        },
      });
    });

    it('does not change the approval, so no re-approval is needed', async () => {
      arrange();

      await service.reschedule(reviewer(), 'req-1', dto);

      const { data } = callArg(tx.marketingTransportRequest.updateMany);
      expect(data).not.toHaveProperty('status');
      expect(data).not.toHaveProperty('reviewedByUserId');
    });

    it('checks clashes against the NEW window, not the old one', async () => {
      arrange();

      await service.reschedule(reviewer(), 'req-1', dto);

      const where = txLookup(tx.marketingTransportRequest.findFirst, 1);
      expect(timeTerm(where)).toMatchObject({
        id: { not: 'req-1' },
        AND: [
          {
            OR: [
              { returnTime: null },
              { travelDate: { gt: at(future) } },
              { travelDate: at(future), returnTime: { gt: '14:00' } },
            ],
          },
          {
            OR: [
              { travelDate: { lt: at(future) } },
              { travelDate: at(future), departureTime: { lt: '17:00' } },
            ],
          },
        ],
      });
      expect(ownersTerm(where)).toEqual([
        { vehicleAssetId: 'veh-1' },
        { driverEmployeeId: 'e5' },
      ]);
    });

    it('lets the trip’s own overdue window stop blocking itself', async () => {
      arrange();

      await service.reschedule(reviewer(), 'req-1', dto);

      expect(
        timeTerm(txLookup(tx.marketingTransportRequest.findFirst, 0)),
      ).toMatchObject({
        id: { not: 'req-1' },
        status: 'APPROVED',
      });
    });

    it('can switch the trip to self-driven', async () => {
      arrange();

      await service.reschedule(reviewer(), 'req-1', {
        travelDate: future,
        departureTime: '14:00',
        returnTime: '17:00',
        vehicleAssetId: 'veh-1',
        selfDriven: true,
      });

      expect(
        callArg(tx.marketingTransportRequest.updateMany).data,
      ).toMatchObject({
        selfDriven: true,
        driverEmployeeId: 'e1',
      });
    });

    it('refuses a vehicle that is booked at the new time', async () => {
      arrange();
      tx.marketingTransportRequest.findFirst
        .mockReset()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          vehicleAssetId: 'veh-1',
          departureTime: '15:00',
          returnTime: '16:00',
          requesterName: 'Efua',
        });

      await expect(
        service.reschedule(reviewer(), 'req-1', dto),
      ).rejects.toThrow(/Toyota Hilux is already allocated to Efua's trip/);
      expect(tx.marketingTransportRequest.updateMany).not.toHaveBeenCalled();
    });

    it('only reschedules approved trips', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        approvedRow({ status: 'COMPLETED' }),
      );

      await expect(
        service.reschedule(reviewer(), 'req-1', dto),
      ).rejects.toThrow(/Only approved trips/);
    });

    it('rejects a past date or a return before departure before touching HR', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        approvedRow(),
      );

      await expect(
        service.reschedule(reviewer(), 'req-1', {
          ...dto,
          travelDate: '2020-01-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.reschedule(reviewer(), 'req-1', {
          ...dto,
          departureTime: '17:00',
          returnTime: '14:00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(directory.resolve).not.toHaveBeenCalled();
    });

    it('returns 404 for a trip in another tenant', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.reschedule(reviewer(), 'req-1', dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('still demands an active transport officer for the driver', async () => {
      arrange();
      officers.assertActiveOfficer.mockRejectedValue(
        new BadRequestException('not an officer'),
      );

      await expect(
        service.reschedule(reviewer(), 'req-1', dto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('destinations', () => {
    const acme = {
      id: 'c1',
      companyName: 'Acme Ltd',
      locationLabel: 'Osu, Accra',
      latitude: '5.556000',
      longitude: '-0.187000',
    };
    const newco = {
      id: 'c2',
      companyName: 'Newco',
      locationLabel: 'Adum, Kumasi',
      latitude: '6.693000',
      longitude: '-1.623000',
    };
    const beta = {
      id: 'p1',
      companyName: 'Beta Co',
      locationLabel: 'Takoradi',
      latitude: '4.898000',
      longitude: '-1.760000',
    };
    const savedStop = (overrides: Record<string, unknown> = {}) => ({
      id: 's1',
      kind: 'CLIENT',
      refId: 'c1',
      name: 'Acme Ltd',
      locationLabel: 'Osu, Accra',
      latitude: '5.556000',
      longitude: '-0.187000',
      source: 'PLANNED',
      ...overrides,
    });
    const clientQuery = () =>
      (
        prisma.marketingClient.findMany.mock.calls[0] as [
          { where: Record<string, unknown> },
        ]
      )[0].where;

    beforeEach(() => {
      directory.resolve.mockResolvedValue({ person: ama, people: [] });
      prisma.marketingTransportRequest.create.mockResolvedValue(row());
    });

    describe('when creating', () => {
      it('saves the chosen clients and prospects with their locations and summarises them as the destination', async () => {
        prisma.marketingClient.findMany.mockResolvedValue([acme]);
        prisma.marketingProspect.findMany.mockResolvedValue([beta]);

        await service.create(user({ role: 'TENANT_ADMIN' }), {
          ...createDto,
          stops: [
            { kind: 'CLIENT', id: 'c1' },
            { kind: 'PROSPECT', id: 'p1' },
          ],
        });

        const { data } = callArg(prisma.marketingTransportRequest.create) as {
          data: Record<string, unknown> & { stops: { create: unknown[] } };
        };
        expect(data.destination).toBe('Acme Ltd, Beta Co');
        expect(data.stops.create).toEqual([
          {
            tenantId: TENANT,
            kind: 'CLIENT',
            refId: 'c1',
            name: 'Acme Ltd',
            locationLabel: 'Osu, Accra',
            latitude: 5.556,
            longitude: -0.187,
            sortOrder: 0,
            source: 'PLANNED',
          },
          {
            tenantId: TENANT,
            kind: 'PROSPECT',
            refId: 'p1',
            name: 'Beta Co',
            locationLabel: 'Takoradi',
            latitude: 4.898,
            longitude: -1.76,
            sortOrder: 1,
            source: 'PLANNED',
          },
        ]);
      });

      it('keeps the order they were picked in, not the order the database returns', async () => {
        prisma.marketingClient.findMany.mockResolvedValue([acme, newco]);

        await service.create(user({ role: 'TENANT_ADMIN' }), {
          ...createDto,
          stops: [
            { kind: 'CLIENT', id: 'c2' },
            { kind: 'CLIENT', id: 'c1' },
          ],
        });

        const { data } = callArg(prisma.marketingTransportRequest.create) as {
          data: { destination: string };
        };
        expect(data.destination).toBe('Newco, Acme Ltd');
      });

      it('lists a place picked twice only once', async () => {
        prisma.marketingClient.findMany.mockResolvedValue([acme]);

        await service.create(user({ role: 'TENANT_ADMIN' }), {
          ...createDto,
          stops: [
            { kind: 'CLIENT', id: 'c1' },
            { kind: 'CLIENT', id: 'c1' },
          ],
        });

        const { data } = callArg(prisma.marketingTransportRequest.create) as {
          data: { stops: { create: unknown[] } };
        };
        expect(data.stops.create).toHaveLength(1);
      });

      it('refuses a client or prospect the person cannot see, creating nothing', async () => {
        prisma.marketingClient.findMany.mockResolvedValue([]);

        await expect(
          service.create(user(), {
            ...createDto,
            stops: [{ kind: 'CLIENT', id: 'someone-elses' }],
          }),
        ).rejects.toThrow(/locations were not found/);
        expect(prisma.marketingTransportRequest.create).not.toHaveBeenCalled();
      });

      it('allows a request with no destination for now, leaving it empty', async () => {
        await service.create(user(), createDto);

        const { data } = callArg(prisma.marketingTransportRequest.create) as {
          data: { destination: string; stops: { create: unknown[] } };
        };
        expect(data.destination).toBe('');
        expect(data.stops.create).toEqual([]);
        expect(prisma.marketingClient.findMany).not.toHaveBeenCalled();
      });

      it('only lets someone without view-all pick clients assigned to them', async () => {
        prisma.marketingClient.findMany.mockResolvedValue([acme]);

        await service.create(user(), {
          ...createDto,
          stops: [{ kind: 'CLIENT', id: 'c1' }],
        });

        expect(clientQuery()).toMatchObject({
          tenantId: TENANT,
          id: { in: ['c1'] },
          assignedUserId: 'user-1',
        });
      });

      it.each([
        [
          'view-all on clients',
          { permissions: ['marketing.clients.all:VIEW'] },
        ],
        ['an admin role', { role: 'TENANT_ADMIN' }],
      ])('lets %s pick any client in the tenant', async (_label, overrides) => {
        prisma.marketingClient.findMany.mockResolvedValue([acme]);

        await service.create(user(overrides as never), {
          ...createDto,
          stops: [{ kind: 'CLIENT', id: 'c1' }],
        });

        expect(clientQuery()).not.toHaveProperty('assignedUserId');
      });

      it('scopes prospects separately, by view-all on prospects', async () => {
        prisma.marketingProspect.findMany.mockResolvedValue([beta]);

        await service.create(
          user({ permissions: ['marketing.clients.all:VIEW'] }),
          { ...createDto, stops: [{ kind: 'PROSPECT', id: 'p1' }] },
        );

        const where = (
          prisma.marketingProspect.findMany.mock.calls[0] as [
            { where: Record<string, unknown> },
          ]
        )[0].where;
        expect(where).toMatchObject({ assignedUserId: 'user-1' });
      });
    });

    describe('in the response', () => {
      it('shows each stop with its location as numbers, and the summary as the destination', async () => {
        prisma.marketingTransportRequest.findFirst.mockResolvedValue(
          row({
            destination: 'Acme Ltd',
            stops: [savedStop()],
          }),
        );

        const result = await service.findOne(user(), 'req-1');

        expect(result.destination).toBe('Acme Ltd');
        expect(result.stops).toEqual([
          {
            kind: 'CLIENT',
            refId: 'c1',
            name: 'Acme Ltd',
            locationLabel: 'Osu, Accra',
            latitude: 5.556,
            longitude: -0.187,
            source: 'PLANNED',
          },
        ]);
      });

      it('keeps the typed destination of an older request that has no stops', async () => {
        prisma.marketingTransportRequest.findFirst.mockResolvedValue(
          row({ destination: 'Kumasi', stops: [] }),
        );

        const result = await service.findOne(user(), 'req-1');

        expect(result.destination).toBe('Kumasi');
        expect(result.stops).toEqual([]);
      });
    });

    describe('when editing a pending request', () => {
      it('replaces the destinations and updates the summary', async () => {
        prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());
        prisma.marketingClient.findMany.mockResolvedValue([newco]);
        tx.marketingTransportRequest.update.mockResolvedValue(row());

        await service.update(user(), 'req-1', {
          stops: [{ kind: 'CLIENT', id: 'c2' }],
        });

        expect(
          tx.marketingTransportRequestStop.deleteMany,
        ).toHaveBeenCalledWith({
          where: { requestId: 'req-1' },
        });
        const { data } = callArg(tx.marketingTransportRequest.update) as {
          data: { destination: string };
        };
        expect(data.destination).toBe('Newco');
      });

      it('clears them all with an empty list', async () => {
        prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());
        tx.marketingTransportRequest.update.mockResolvedValue(row());

        await service.update(user(), 'req-1', { stops: [] });

        expect(tx.marketingTransportRequestStop.deleteMany).toHaveBeenCalled();
        const { data } = callArg(tx.marketingTransportRequest.update) as {
          data: { destination: string };
        };
        expect(data.destination).toBe('');
      });

      it('leaves them alone when not mentioned', async () => {
        prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());
        tx.marketingTransportRequest.update.mockResolvedValue(row());

        await service.update(user(), 'req-1', { purpose: 'PERSONAL' });

        expect(
          tx.marketingTransportRequestStop.deleteMany,
        ).not.toHaveBeenCalled();
        const { data } = callArg(tx.marketingTransportRequest.update) as {
          data: Record<string, unknown>;
        };
        expect(data).not.toHaveProperty('destination');
      });
    });

    describe('destinationOptions', () => {
      const queryOf = (fn: jest.Mock) =>
        (
          fn.mock.calls[0] as [{ where: Record<string, unknown>; take: number }]
        )[0];

      it('shows only the clients and prospects assigned to someone without view-all', async () => {
        await service.destinationOptions(user());

        expect(queryOf(prisma.marketingClient.findMany).where).toMatchObject({
          tenantId: TENANT,
          assignedUserId: 'user-1',
        });
        expect(queryOf(prisma.marketingProspect.findMany).where).toMatchObject({
          tenantId: TENANT,
          assignedUserId: 'user-1',
        });
      });

      it('shows everyone’s to someone with view-all, each kind on its own permission', async () => {
        await service.destinationOptions(
          user({ permissions: ['marketing.prospects.all:VIEW'] }),
        );

        expect(queryOf(prisma.marketingClient.findMany).where).toMatchObject({
          assignedUserId: 'user-1',
        });
        expect(
          queryOf(prisma.marketingProspect.findMany).where,
        ).not.toHaveProperty('assignedUserId');
      });

      it('shows everything to an admin', async () => {
        await service.destinationOptions(user({ role: 'TENANT_ADMIN' }));

        expect(
          queryOf(prisma.marketingClient.findMany).where,
        ).not.toHaveProperty('assignedUserId');
        expect(
          queryOf(prisma.marketingProspect.findMany).where,
        ).not.toHaveProperty('assignedUserId');
      });

      it('leaves out a prospect that has already become a client', async () => {
        await service.destinationOptions(user());

        expect(queryOf(prisma.marketingProspect.findMany).where).toMatchObject({
          client: { is: null },
        });
      });

      it('matches the company name however it is typed', async () => {
        await service.destinationOptions(user(), { search: '  Acme   LTD ' });

        const nameFilter = { normalizedCompanyName: { contains: 'acme ltd' } };
        expect(queryOf(prisma.marketingClient.findMany).where).toMatchObject(
          nameFilter,
        );
        expect(queryOf(prisma.marketingProspect.findMany).where).toMatchObject(
          nameFilter,
        );
      });

      it('returns clients and prospects together, by name, with their locations', async () => {
        prisma.marketingClient.findMany.mockResolvedValue([newco, acme]);
        prisma.marketingProspect.findMany.mockResolvedValue([beta]);

        const { data } = await service.destinationOptions(user());

        expect(data.map((d) => [d.kind, d.name])).toEqual([
          ['CLIENT', 'Acme Ltd'],
          ['PROSPECT', 'Beta Co'],
          ['CLIENT', 'Newco'],
        ]);
        expect(data[0]).toMatchObject({
          id: 'c1',
          locationLabel: 'Osu, Accra',
          latitude: 5.556,
          longitude: -0.187,
        });
      });

      it('caps the list', async () => {
        prisma.marketingClient.findMany.mockResolvedValue([acme, newco]);
        prisma.marketingProspect.findMany.mockResolvedValue([beta]);

        const { data } = await service.destinationOptions(user(), { limit: 2 });

        expect(data).toHaveLength(2);
        expect(queryOf(prisma.marketingClient.findMany).take).toBe(2);
      });
    });

    describe('places visited, added when completing', () => {
      const overdueTrip = (overrides: Record<string, unknown> = {}) =>
        row({
          status: 'APPROVED',
          travelDate: at(today),
          departureTime: '08:00',
          returnTime: '11:00',
          startedAt: new Date(),
          ...overrides,
        });

      function arrange(
        planned: unknown[] = [
          { kind: 'CLIENT', refId: 'c1', name: 'Acme Ltd' },
        ],
      ) {
        prisma.marketingTransportRequest.findFirst
          .mockResolvedValueOnce(overdueTrip())
          .mockResolvedValueOnce(row({ status: 'COMPLETED' }));
        prisma.marketingTransportRequestStop.findMany.mockResolvedValue(
          planned,
        );
        directory.resolve.mockResolvedValue({ person: null, people: [] });
        tx.marketingTransportRequest.updateMany.mockResolvedValue({ count: 1 });
      }

      it('records new places as visited and skips ones already planned', async () => {
        arrange();
        prisma.marketingClient.findMany.mockResolvedValue([acme, newco]);

        await service.complete(user({ role: 'TENANT_ADMIN' }), 'req-1', {
          ...returnDetails,
          actualReturnTime: '11:00',
          stops: [
            { kind: 'CLIENT', id: 'c1' },
            { kind: 'CLIENT', id: 'c2' },
          ],
        });

        const { data } = callArg(
          tx.marketingTransportRequestStop.createMany,
        ) as unknown as { data: Record<string, unknown>[] };
        expect(data).toHaveLength(1);
        expect(data[0]).toMatchObject({
          tenantId: TENANT,
          requestId: 'req-1',
          kind: 'CLIENT',
          refId: 'c2',
          name: 'Newco',
          source: 'VISITED',
          // After the one already planned.
          sortOrder: 1,
        });
      });

      it('adds the new places to the destination summary', async () => {
        arrange();
        prisma.marketingClient.findMany.mockResolvedValue([newco]);

        await service.complete(user({ role: 'TENANT_ADMIN' }), 'req-1', {
          ...returnDetails,
          actualReturnTime: '11:00',
          stops: [{ kind: 'CLIENT', id: 'c2' }],
        });

        const { data } = callArg(tx.marketingTransportRequest.update) as {
          data: { destination: string };
        };
        expect(data.destination).toBe('Acme Ltd, Newco');
      });

      it('changes nothing about places when none are added', async () => {
        arrange();

        await service.complete(user(), 'req-1', {
          ...returnDetails,
          actualReturnTime: '11:00',
        });

        expect(
          tx.marketingTransportRequestStop.createMany,
        ).not.toHaveBeenCalled();
        expect(tx.marketingTransportRequest.update).not.toHaveBeenCalled();
      });

      it('refuses a place the person cannot see, and does not complete the trip', async () => {
        arrange();
        prisma.marketingClient.findMany.mockResolvedValue([]);

        await expect(
          service.complete(user(), 'req-1', {
            ...returnDetails,
            actualReturnTime: '11:00',
            stops: [{ kind: 'CLIENT', id: 'someone-elses' }],
          }),
        ).rejects.toThrow(/locations were not found/);
        expect(tx.marketingTransportRequest.updateMany).not.toHaveBeenCalled();
      });

      it('uses the visibility of whoever completes it', async () => {
        arrange();
        prisma.marketingClient.findMany.mockResolvedValue([newco]);

        await service.complete(user({ id: 'user-1' }), 'req-1', {
          ...returnDetails,
          actualReturnTime: '11:00',
          stops: [{ kind: 'CLIENT', id: 'c2' }],
        });

        expect(clientQuery()).toMatchObject({ assignedUserId: 'user-1' });
      });
    });
  });

  describe('purpose', () => {
    it('saves whether the trip is personal or marketing', async () => {
      directory.resolve.mockResolvedValue({ person: ama, people: [] });
      prisma.marketingTransportRequest.create.mockResolvedValue(
        row({ purpose: 'PERSONAL' }),
      );

      const result = await service.create(user(), {
        ...createDto,
        purpose: 'PERSONAL',
      });

      expect(
        callArg(prisma.marketingTransportRequest.create).data,
      ).toMatchObject({
        purpose: 'PERSONAL',
      });
      expect(result.purpose).toBe('PERSONAL');
    });

    it('no longer stores a free-text purpose on new requests', async () => {
      directory.resolve.mockResolvedValue({ person: ama, people: [] });
      prisma.marketingTransportRequest.create.mockResolvedValue(row());

      await service.create(user(), createDto);

      expect(
        callArg(prisma.marketingTransportRequest.create).data,
      ).not.toHaveProperty('businessPurpose');
    });

    it('can be changed while the request is pending', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());
      tx.marketingTransportRequest.update.mockResolvedValue(
        row({ purpose: 'PERSONAL' }),
      );

      const result = await service.update(user(), 'req-1', {
        purpose: 'PERSONAL',
      });

      expect(callArg(tx.marketingTransportRequest.update).data).toMatchObject({
        purpose: 'PERSONAL',
      });
      expect(result.purpose).toBe('PERSONAL');
    });

    it('still shows the old free-text purpose of requests made before this changed', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        row({ businessPurpose: 'Client site visit', purpose: 'MARKETING' }),
      );

      const result = await service.findOne(user(), 'req-1');

      expect(result.purpose).toBe('MARKETING');
      expect(result.businessPurpose).toBe('Client site visit');
    });
  });

  describe('start', () => {
    const approved = (overrides: Record<string, unknown> = {}) =>
      row({
        status: 'APPROVED',
        travelDate: at(today),
        departureTime: '08:00',
        returnTime: '17:00',
        vehicleAssetId: 'veh-1',
        vehicleName: 'Toyota Hilux',
        ...overrides,
      });
    const at = (date: string) => new Date(`${date}T00:00:00.000Z`);
    const startDto = {
      actualDepartureTime: '08:10',
      startingMileage: 48210,
      startingCondition: 'GOOD' as const,
      notes: 'Fuel full',
    };

    function arrange(request = approved()) {
      prisma.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(request)
        .mockResolvedValueOnce(
          approved({ startedAt: new Date(), startingMileage: 48210 }),
        );
      directory.resolve.mockResolvedValue({ person: ama, people: [] });
      prisma.marketingTransportRequest.updateMany.mockResolvedValue({
        count: 1,
      });
    }

    it('puts an approved trip on route and records the departure details', async () => {
      arrange();

      const result = await service.start(user(), 'req-1', startDto);

      expect(
        callArg(prisma.marketingTransportRequest.updateMany),
      ).toMatchObject({
        where: { id: 'req-1', status: 'APPROVED', startedAt: null },
        data: {
          startedByUserId: 'user-1',
          actualDepartureTime: '08:10',
          startingMileage: 48210,
          startingCondition: 'GOOD',
          startNotes: 'Fuel full',
        },
      });
      expect(result.status).toBe('ON_ROUTE');
    });

    it('cannot start a trip that is not approved', async () => {
      arrange(approved({ status: 'PENDING' }));
      await expect(service.start(user(), 'req-1', startDto)).rejects.toThrow(
        /Only approved/,
      );
    });

    it('cannot start a trip twice', async () => {
      arrange(approved({ startedAt: new Date() }));
      await expect(service.start(user(), 'req-1', startDto)).rejects.toThrow(
        /already started/,
      );
    });

    it('cannot start before the travel day', async () => {
      arrange(approved({ travelDate: at(future) }));
      await expect(service.start(user(), 'req-1', startDto)).rejects.toThrow(
        /before its travel day/,
      );
    });

    it('cannot record a departure time in the future on the travel day', async () => {
      arrange();
      await expect(
        service.start(user(), 'req-1', {
          ...startDto,
          actualDepartureTime: '12:01',
        }),
      ).rejects.toThrow(/cannot be in the future/);
    });

    it('loses cleanly if the trip changed while starting', async () => {
      arrange();
      prisma.marketingTransportRequest.updateMany.mockResolvedValue({
        count: 0,
      });
      await expect(service.start(user(), 'req-1', startDto)).rejects.toThrow(
        /can no longer be started/,
      );
    });

    it('cannot be rescheduled once started', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        approved({ startedAt: new Date() }),
      );
      await expect(
        service.reschedule(
          user({ permissions: ['requests:approve_all'] }),
          'req-1',
          {
            travelDate: future,
            departureTime: '09:00',
            vehicleAssetId: 'veh-1',
            selfDriven: true,
          },
        ),
      ).rejects.toThrow(/has started/);
    });
  });

  describe('trips with no return time', () => {
    const noReturn = (overrides: Record<string, unknown> = {}) =>
      row({
        status: 'APPROVED',
        travelDate: at(today),
        departureTime: '08:00',
        returnTime: null,
        startedAt: new Date(),
        ...overrides,
      });
    const viewOne = async (overrides: Record<string, unknown>) => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        noReturn(overrides),
      );
      return service.findOne(user(), 'req-1');
    };

    it('can be requested without one', async () => {
      directory.resolve.mockResolvedValue({ person: ama, people: [] });
      prisma.marketingTransportRequest.create.mockResolvedValue(
        row({ returnTime: null }),
      );

      const { returnTime, ...withoutReturn } = createDto;
      void returnTime;
      const result = await service.create(user(), withoutReturn);

      expect(
        callArg(prisma.marketingTransportRequest.create).data,
      ).toMatchObject({ returnTime: null });
      expect(result.returnTime).toBeNull();
    });

    it('still rejects a return time that is not after the departure when one is given', async () => {
      await expect(
        service.create(user(), {
          ...createDto,
          departureTime: '17:00',
          returnTime: '09:00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('can be edited to remove the return time, or to leave it as it was', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());
      tx.marketingTransportRequest.update.mockResolvedValue(
        row({ returnTime: null }),
      );

      await service.update(user(), 'req-1', { returnTime: null });
      expect(callArg(tx.marketingTransportRequest.update).data).toMatchObject({
        returnTime: null,
      });

      tx.marketingTransportRequest.update.mockClear();
      await service.update(user(), 'req-1', { purpose: 'PERSONAL' });
      expect(
        callArg(tx.marketingTransportRequest.update).data,
      ).not.toHaveProperty('returnTime');
    });

    it('is on route once started but is never overdue', async () => {
      const result = await viewOne({ travelDate: at('2020-01-01') });

      expect(result.status).toBe('ON_ROUTE');
      expect(result.overdue).toBe(false);
    });

    it('can be completed any time after it is started, but not before', async () => {
      expect((await viewOne({})).completable).toBe(true);
      expect((await viewOne({ startedAt: null })).completable).toBe(false);
    });

    it('only becomes completable after the return time when it has one', async () => {
      expect((await viewOne({ returnTime: '12:01' })).completable).toBe(false);
      expect((await viewOne({ returnTime: '12:00' })).completable).toBe(true);
    });

    it('is completed without a planned return to compare against', async () => {
      prisma.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(noReturn())
        .mockResolvedValueOnce(
          row({
            status: 'COMPLETED',
            returnTime: null,
            actualReturnTime: '11:30',
            completedAt: new Date(),
          }),
        );
      directory.resolve.mockResolvedValue({ person: null, people: [] });
      tx.marketingTransportRequest.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.complete(user(), 'req-1', {
        ...returnDetails,
        actualReturnTime: '11:30',
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.completion).toMatchObject({
        actualReturnTime: '11:30',
        minutesLate: null,
      });
    });

    it('cannot be completed before it has been started, and says why', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(
        noReturn({ startedAt: null }),
      );

      await expect(
        service.complete(user(), 'req-1', {
          ...returnDetails,
          actualReturnTime: '12:30',
        }),
      ).rejects.toThrow(/Start the trip/);
    });

    it('holds its vehicle and driver from departure onwards: nothing starts-before-end is required of the other trip', async () => {
      directory.resolve.mockResolvedValue({
        person: { employeeId: 'e9', name: 'Kojo', department: null },
        people: [{ employeeId: 'e5', name: 'Yaw', department: null }],
      });
      fleet.getVehicle.mockResolvedValue({
        id: 'veh-1',
        assetNumber: 'VEH-1',
        name: 'Hilux',
        status: 'AVAILABLE',
      });
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(null);
      prisma.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(
          noReturn({ status: 'PENDING', travelDate: at(future) }),
        )
        .mockResolvedValueOnce(row({ status: 'APPROVED' }));
      tx.marketingTransportRequest.findFirst.mockResolvedValue(null);
      tx.marketingTransportRequest.updateMany.mockResolvedValue({ count: 1 });

      await service.approve(
        user({ id: 'user-2', firstName: 'Kojo' }),
        'req-1',
        {
          vehicleAssetId: 'veh-1',
          driverEmployeeId: 'e5',
        },
      );

      const overlap = timeTerm(
        txLookup(tx.marketingTransportRequest.findFirst, 1),
      );
      // Only "the other trip ends after this one starts": with no end of its own there is
      // no "starts before it ends" half.
      expect(overlap.AND).toHaveLength(1);
    });

    it('is blocked by an earlier open-ended trip for any later booking', async () => {
      directory.resolve.mockResolvedValue({
        person: { employeeId: 'e9', name: 'Kojo', department: null },
        people: [{ employeeId: 'e5', name: 'Yaw', department: null }],
      });
      fleet.getVehicle.mockResolvedValue({
        id: 'veh-1',
        assetNumber: 'VEH-1',
        name: 'Hilux',
        status: 'AVAILABLE',
      });
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(null);
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());
      tx.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          vehicleAssetId: 'veh-1',
          departureTime: '09:00',
          returnTime: null,
          requesterName: 'Efua',
        });

      await expect(
        service.approve(user({ id: 'user-2' }), 'req-1', {
          vehicleAssetId: 'veh-1',
          driverEmployeeId: 'e5',
        }),
      ).rejects.toThrow(
        /allocated to Efua's trip \(from 09:00, no return time\)/,
      );
    });

    it('is reported as still out once it has departed, with no return time to wait for', async () => {
      directory.resolve.mockResolvedValue({
        person: { employeeId: 'e9', name: 'Kojo', department: null },
        people: [{ employeeId: 'e5', name: 'Yaw', department: null }],
      });
      fleet.getVehicle.mockResolvedValue({
        id: 'veh-1',
        assetNumber: 'VEH-1',
        name: 'Hilux',
        status: 'AVAILABLE',
      });
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(null);
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());
      tx.marketingTransportRequest.findFirst.mockResolvedValueOnce({
        vehicleAssetId: 'veh-1',
        travelDate: at('2026-10-01'),
        departureTime: '09:00',
        returnTime: null,
        requesterName: 'Efua',
      });

      await expect(
        service.approve(user({ id: 'user-2' }), 'req-1', {
          vehicleAssetId: 'veh-1',
          driverEmployeeId: 'e5',
        }),
      ).rejects.toThrow(
        /still out on Efua's trip \(2026-10-01 from 09:00, no return time\)\. Complete it first/,
      );
    });

    it('can be rescheduled to one with no return time, keeping the old schedule', async () => {
      directory.resolve.mockResolvedValue({
        person: { employeeId: 'e9', name: 'Kojo', department: null },
        people: [{ employeeId: 'e5', name: 'Yaw', department: null }],
      });
      fleet.getVehicle.mockResolvedValue({
        id: 'veh-1',
        assetNumber: 'VEH-1',
        name: 'Hilux',
        status: 'AVAILABLE',
      });
      prisma.marketingFleetVehicle.findUnique.mockResolvedValue(null);
      prisma.marketingTransportRequest.findFirst
        .mockResolvedValueOnce(
          row({
            status: 'APPROVED',
            travelDate: at('2020-01-01'),
            departureTime: '10:00',
            returnTime: '12:00',
          }),
        )
        .mockResolvedValueOnce(row({ status: 'APPROVED' }));
      tx.marketingTransportRequest.findFirst.mockResolvedValue(null);
      tx.marketingTransportRequest.updateMany.mockResolvedValue({ count: 1 });

      await service.reschedule(user({ id: 'user-2' }), 'req-1', {
        travelDate: future,
        departureTime: '14:00',
        vehicleAssetId: 'veh-1',
        driverEmployeeId: 'e5',
      });

      expect(
        callArg(tx.marketingTransportRequest.updateMany).data,
      ).toMatchObject({
        departureTime: '14:00',
        returnTime: null,
        previousReturnTime: '12:00',
      });
    });

    it('can have its availability checked for a window with no return time', async () => {
      prisma.marketingTransportRequest.findFirst.mockResolvedValue(row());
      fleet.listVehicles.mockResolvedValue([]);
      officers.activeDrivers.mockResolvedValue([]);
      prisma.marketingFleetVehicle.findMany.mockResolvedValue([]);
      prisma.marketingTransportRequest.findMany.mockResolvedValue([]);

      await expect(
        service.allocationOptions(user(), 'req-1', {
          travelDate: future,
          departureTime: '14:00',
        }),
      ).resolves.toBeDefined();

      const [overlap] = prisma.marketingTransportRequest.findMany.mock
        .calls as [{ where: { AND: unknown[] } }][];
      expect(overlap[0].where.AND).toHaveLength(1);
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
