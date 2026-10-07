import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingTransportPurpose,
  MarketingTransportRequestStatus as Status,
  MarketingTransportStopKind as StopKind,
  MarketingTransportStopSource as StopSource,
  Prisma,
} from '../../prisma/generated/client';
import { HrFleetClient, HrVehicleAsset } from '../fleet/hr-fleet.client';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { callHr } from '../hr/call-hr';
import { HrDirectoryClient } from '../hr/hr-directory.client';
import { PrismaService } from '../prisma/prisma.service';
import {
  canComplete,
  isOverdue,
  minutesBetween,
  WallClock,
} from '../trips/trip-schedule';
import { TripScheduleService } from '../trips/trip-schedule.service';
import { RequestNotifier } from './request-notifier.service';
import { TransportOfficersService } from '../transport-officers/transport-officers.service';
import {
  AllocationOptionsQueryDto,
  ApproveTransportRequestDto,
  CompleteTransportRequestDto,
  CreateTransportRequestDto,
  DestinationOptionsQueryDto,
  QueryTransportRequestsDto,
  RequestStatusFilter,
  RescheduleTransportRequestDto,
  ReviewTransportRequestDto,
  StartTransportRequestDto,
  TransportStopDto,
  UpdateTransportRequestDto,
} from './dto/transport-request.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOT_FOUND_MESSAGE = 'Transport request not found';

type RequestRow = Prisma.MarketingTransportRequestGetPayload<object>;

/** Everything a request response is built from. */
const REQUEST_INCLUDE = {
  passengers: { orderBy: { name: 'asc' as const } },
  stops: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
  },
} satisfies Prisma.MarketingTransportRequestInclude;

type RequestWithPassengers = Prisma.MarketingTransportRequestGetPayload<{
  include: typeof REQUEST_INCLUDE;
}>;

/** What is read from a client or prospect to describe a place. */
interface PlaceRow {
  id: string;
  companyName: string;
  locationLabel: string;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
}

/** A client or prospect as stored on a request: name and location are snapshots. */
export interface StopSnapshot {
  kind: StopKind;
  refId: string;
  name: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  sortOrder: number;
}

/** "10:00–12:00", or "from 10:00, no return time" when no return time was given. */
const windowText = (departureTime: string, returnTime: string | null) =>
  returnTime
    ? `${departureTime}–${returnTime}`
    : `from ${departureTime}, no return time`;

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly directory: HrDirectoryClient,
    private readonly fleet: HrFleetClient,
    private readonly officers: TransportOfficersService,
    private readonly trips: TripScheduleService,
    private readonly notifier: RequestNotifier,
  ) {}

  async list(user: RequestUser, query: QueryTransportRequestsDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const now = this.trips.now();
    const where: Prisma.MarketingTransportRequestWhereInput = {
      tenantId: user.tenantId,
      ...this.visibilityWhere(user),
      AND: [
        ...(query.status?.length ? [this.statusWhere(query.status)] : []),
        ...(query.search
          ? [
              {
                OR: [
                  {
                    businessPurpose: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    destination: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    requesterName: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.marketingTransportRequest.count({ where }),
      this.prisma.marketingTransportRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) => this.toResponse(row, now)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(user: RequestUser, id: string) {
    const row = await this.prisma.marketingTransportRequest.findFirst({
      where: { id, tenantId: user.tenantId, ...this.visibilityWhere(user) },
      include: REQUEST_INCLUDE,
    });
    if (!row) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return this.toResponse(row, this.trips.now());
  }

  /** What the request form needs: who is asking, and who can come along. */
  async formOptions(user: RequestUser) {
    const [people, resolved] = await Promise.all([
      this.callHr(() => this.directory.list(user.tenantId)),
      this.callHr(() =>
        this.directory.resolve(user.tenantId, { userId: user.id }),
      ),
    ]);
    const requester = this.requesterFrom(user, resolved.person);
    return {
      requester: {
        name: requester.name,
        department: requester.department,
      },
      employees: people.filter(
        (person) => person.employeeId !== requester.employeeId,
      ),
    };
  }

  async create(user: RequestUser, dto: CreateTransportRequestDto) {
    this.assertSchedule(
      dto.travelDate,
      dto.departureTime,
      dto.returnTime,
      true,
    );

    const appointment = dto.appointmentId
      ? await this.appointmentForTransport(user, dto.appointmentId)
      : null;

    const [resolved, stops] = await Promise.all([
      this.callHr(() =>
        this.directory.resolve(user.tenantId, {
          userId: user.id,
          employeeIds: dto.passengerIds,
        }),
      ),
      this.resolveStops(
        user,
        appointment
          ? [
              { kind: StopKind.PROSPECT, id: appointment.prospectId },
              ...(dto.stops ?? []),
            ]
          : (dto.stops ?? []),
        appointment?.prospectId,
      ),
    ]);
    const requester = this.requesterFrom(user, resolved.person);
    const passengers = resolved.people.filter(
      (person) => person.employeeId !== requester.employeeId,
    );

    const created = await this.prisma.marketingTransportRequest.create({
      data: {
        tenantId: user.tenantId,
        requesterUserId: user.id,
        requesterEmployeeId: requester.employeeId,
        requesterName: requester.name,
        requesterDepartment: requester.department,
        // A trip for an appointment is always a marketing trip.
        purpose: appointment
          ? MarketingTransportPurpose.MARKETING
          : dto.purpose,
        appointmentId: appointment?.id ?? null,
        travelDate: this.toDate(dto.travelDate),
        departureTime: dto.departureTime,
        returnTime: dto.returnTime ?? null,
        destination: appointment
          ? this.summarize(stops)
          : dto.destination || this.summarize(stops),
        notes: dto.notes || null,
        passengers: {
          create: passengers.map((person) => ({
            tenantId: user.tenantId,
            employeeId: person.employeeId,
            name: person.name,
            department: person.department,
          })),
        },
        stops: {
          create: stops.map((stop) => ({
            tenantId: user.tenantId,
            ...stop,
            source: StopSource.PLANNED,
          })),
        },
      },
      include: REQUEST_INCLUDE,
    });

    const response = this.toResponse(created, this.trips.now());
    // Tell the approvers (best-effort, not awaited so the request returns straight away).
    void this.notifier.requested(user.tenantId, response);
    return response;
  }

  /**
   * The appointment a trip is requested for: it must be approved and have a prospect, the person
   * must be its marketer, its manager or able to approve appointments, and it can't already have
   * a live trip.
   */
  private async appointmentForTransport(user: RequestUser, id: string) {
    const appointment = await this.prisma.marketingAppointment.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    const allowed =
      appointment &&
      (appointment.marketerUserId === user.id ||
        appointment.managerUserId === user.id ||
        this.hasPermission(
          user,
          MarketingCrmSettingsPermission.APPOINTMENTS_APPROVE_ALL,
        ));
    // Same response for "not yours" and "doesn't exist" so ids can't be probed.
    if (!appointment || !allowed) {
      throw new NotFoundException('Appointment not found');
    }
    if (appointment.status !== 'APPROVED') {
      throw new ConflictException(
        'Transport can only be requested for an approved appointment',
      );
    }
    if (!appointment.prospectId) {
      throw new ConflictException('This appointment no longer has a prospect');
    }
    const existing = await this.prisma.marketingTransportRequest.findFirst({
      where: {
        tenantId: user.tenantId,
        appointmentId: appointment.id,
        status: { in: [Status.PENDING, Status.APPROVED, Status.COMPLETED] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'This appointment already has a transport request',
      );
    }
    return { id: appointment.id, prospectId: appointment.prospectId };
  }

  async update(user: RequestUser, id: string, dto: UpdateTransportRequestDto) {
    const existing = await this.findOwn(user, id);
    if (existing.status !== Status.PENDING) {
      throw new ConflictException('Only pending requests can be edited');
    }

    const schedule = {
      travelDate: dto.travelDate ?? this.fromDate(existing.travelDate),
      departureTime: dto.departureTime ?? existing.departureTime,
      // null clears the return time; undefined leaves it alone.
      returnTime:
        dto.returnTime !== undefined ? dto.returnTime : existing.returnTime,
    };
    this.assertSchedule(
      schedule.travelDate,
      schedule.departureTime,
      schedule.returnTime,
      // Only re-check "not in the past" when the date itself is being changed.
      dto.travelDate !== undefined,
    );

    let passengers:
      | { employeeId: string; name: string; department: string | null }[]
      | undefined;
    if (dto.passengerIds !== undefined) {
      const resolved = await this.callHr(() =>
        this.directory.resolve(user.tenantId, {
          employeeIds: dto.passengerIds,
        }),
      );
      passengers = resolved.people.filter(
        (person) => person.employeeId !== existing.requesterEmployeeId,
      );
    }
    const stops =
      dto.stops !== undefined
        ? await this.resolveStops(user, dto.stops)
        : undefined;

    // Typed text (personal trips) wins; otherwise the places chosen, when they were sent.
    const destination =
      dto.destination !== undefined
        ? dto.destination
        : stops
          ? this.summarize(stops)
          : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (passengers) {
        await tx.marketingTransportRequestPassenger.deleteMany({
          where: { requestId: id },
        });
      }
      // A pending request has only planned destinations, so replacing them all is safe.
      if (stops) {
        await tx.marketingTransportRequestStop.deleteMany({
          where: { requestId: id },
        });
      }
      return tx.marketingTransportRequest.update({
        where: { id },
        data: {
          ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
          ...(dto.travelDate !== undefined
            ? { travelDate: this.toDate(dto.travelDate) }
            : {}),
          ...(dto.departureTime !== undefined
            ? { departureTime: dto.departureTime }
            : {}),
          ...(dto.returnTime !== undefined
            ? { returnTime: dto.returnTime }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
          ...(passengers
            ? {
                passengers: {
                  create: passengers.map((person) => ({
                    tenantId: user.tenantId,
                    employeeId: person.employeeId,
                    name: person.name,
                    department: person.department,
                  })),
                },
              }
            : {}),
          ...(destination !== undefined ? { destination } : {}),
          ...(stops
            ? {
                stops: {
                  create: stops.map((stop) => ({
                    tenantId: user.tenantId,
                    ...stop,
                    source: StopSource.PLANNED,
                  })),
                },
              }
            : {}),
        },
        include: REQUEST_INCLUDE,
      });
    });

    return this.toResponse(updated, this.trips.now());
  }

  /** The requester, or anyone who can approve, may cancel; a completed trip can't be cancelled. */
  async cancel(user: RequestUser, id: string) {
    const existing = await this.findForActor(user, id);
    if (
      existing.status !== Status.PENDING &&
      existing.status !== Status.APPROVED
    ) {
      throw new ConflictException(
        `A ${existing.status.toLowerCase()} request cannot be cancelled`,
      );
    }

    const result = await this.prisma.marketingTransportRequest.updateMany({
      where: {
        id,
        tenantId: user.tenantId,
        status: { in: [Status.PENDING, Status.APPROVED] },
      },
      data: { status: Status.CANCELLED, cancelledAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException('This request can no longer be cancelled');
    }
    const response = await this.findOne(user, id);
    void this.notifier.cancelled(user.tenantId, response, user.id);
    return response;
  }

  /**
   * Approving allocates a vehicle and a driver. The allocation lives on the
   * request: it deliberately does not touch the vehicle's HR assignment or
   * status, because fleet status reflects on-route state, not who is assigned.
   */
  async approve(
    user: RequestUser,
    id: string,
    dto: ApproveTransportRequestDto,
  ) {
    const existing = await this.getReviewable(user, id);

    await this.allocate({
      user,
      existing,
      dto,
      window: {
        travelDate: existing.travelDate,
        departureTime: existing.departureTime,
        returnTime: existing.returnTime,
      },
      expectedStatus: Status.PENDING,
      staleMessage: 'This request has already been reviewed',
      data: ({ reviewerName }) => ({
        status: Status.APPROVED,
        reviewedByUserId: user.id,
        reviewedByName: reviewerName,
        reviewedAt: new Date(),
        reviewNote: dto.note || null,
      }),
    });

    const response = await this.findOne(user, id);
    void this.notifier.approved(user.tenantId, response, user.id);
    return response;
  }

  /**
   * Moves an approved trip to a new date and times and re-allocates its vehicle
   * and driver, with the same checks as approving. The previous schedule is kept.
   */
  async reschedule(
    user: RequestUser,
    id: string,
    dto: RescheduleTransportRequestDto,
  ) {
    const existing = await this.prisma.marketingTransportRequest.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException(NOT_FOUND_MESSAGE);
    if (existing.status !== Status.APPROVED) {
      throw new ConflictException('Only approved trips can be rescheduled');
    }
    if (existing.startedAt) {
      throw new ConflictException('A trip that has started cannot be moved');
    }
    this.assertSchedule(
      dto.travelDate,
      dto.departureTime,
      dto.returnTime,
      true,
    );

    await this.allocate({
      user,
      existing,
      dto,
      window: {
        travelDate: this.toDate(dto.travelDate),
        departureTime: dto.departureTime,
        returnTime: dto.returnTime ?? null,
      },
      expectedStatus: Status.APPROVED,
      staleMessage: 'This trip is no longer approved',
      data: ({ reviewerName }) => ({
        travelDate: this.toDate(dto.travelDate),
        departureTime: dto.departureTime,
        returnTime: dto.returnTime ?? null,
        previousTravelDate: existing.travelDate,
        previousDepartureTime: existing.departureTime,
        previousReturnTime: existing.returnTime,
        rescheduleCount: { increment: 1 },
        rescheduledAt: new Date(),
        rescheduledByName: reviewerName,
        ...(dto.note ? { reviewNote: dto.note } : {}),
      }),
    });

    const response = await this.findOne(user, id);
    void this.notifier.rescheduled(user.tenantId, response, user.id);
    return response;
  }

  /**
   * What the start form is prefilled with: the vehicle's current mileage (from the fleet details)
   * and its condition (from the HR asset).
   */
  async startOptions(user: RequestUser, id: string) {
    const existing = await this.findForActor(user, id);
    if (!existing.vehicleAssetId) {
      throw new ConflictException('This trip has no vehicle allocated');
    }
    const [details, vehicle] = await Promise.all([
      this.prisma.marketingFleetVehicle.findUnique({
        where: {
          tenantId_assetId: {
            tenantId: user.tenantId,
            assetId: existing.vehicleAssetId,
          },
        },
      }),
      this.callHr(() =>
        this.fleet.getVehicle(user.tenantId, existing.vehicleAssetId),
      ),
    ]);
    return {
      vehicleName: existing.vehicleName,
      mileage: details?.currentMileage ?? null,
      condition: vehicle.condition ?? null,
      now: this.trips.now(),
    };
  }

  /**
   * Starts an approved trip: it is on route from now until it is completed. Records the starting
   * mileage and vehicle condition, when it actually left, and any notes. The requester can start
   * their own; anyone who can approve can start any.
   */
  async start(user: RequestUser, id: string, dto: StartTransportRequestDto) {
    const existing = await this.findForActor(user, id);
    if (existing.status !== Status.APPROVED) {
      throw new ConflictException('Only approved trips can be started');
    }
    if (existing.startedAt) {
      throw new ConflictException('This trip has already started');
    }
    const now = this.trips.now();
    const travelDate = this.fromDate(existing.travelDate);
    if (travelDate > now.date) {
      throw new ConflictException('A trip cannot start before its travel day');
    }
    // On the travel day the departure can't be in the future; a late start on a later day can be any time.
    if (travelDate === now.date && dto.actualDepartureTime > now.time) {
      throw new BadRequestException(
        'The departure time cannot be in the future',
      );
    }

    const starterName = this.requesterFrom(
      user,
      (
        await this.callHr(() =>
          this.directory.resolve(user.tenantId, { userId: user.id }),
        )
      ).person,
    ).name;

    // The status and startedAt conditions make a concurrent start lose cleanly.
    const result = await this.prisma.marketingTransportRequest.updateMany({
      where: {
        id,
        tenantId: user.tenantId,
        status: Status.APPROVED,
        startedAt: null,
      },
      data: {
        startedAt: new Date(),
        startedByUserId: user.id,
        startedByName: starterName,
        actualDepartureTime: dto.actualDepartureTime,
        startingMileage: dto.startingMileage,
        startingCondition: dto.startingCondition,
        startNotes: dto.notes || null,
      },
    });
    if (result.count === 0) {
      throw new ConflictException('This trip can no longer be started');
    }
    return this.findOne(user, id);
  }

  /**
   * Closes a trip once it can be closed (its return time has passed, or it never had one),
   * recording when it really got back so on-time returns can be seen, and any further places
   * that were visited. Final: a completed trip can't be changed.
   */
  async complete(
    user: RequestUser,
    id: string,
    dto: CompleteTransportRequestDto,
  ) {
    const existing = await this.findForActor(user, id);
    if (existing.status === Status.COMPLETED) {
      throw new ConflictException('This trip is already completed');
    }
    if (existing.status !== Status.APPROVED) {
      throw new ConflictException('Only approved trips can be completed');
    }

    const now = this.trips.now();
    const window = {
      travelDate: this.fromDate(existing.travelDate),
      departureTime: existing.departureTime,
      returnTime: existing.returnTime,
      started: existing.startedAt !== null,
    };
    if (!window.started) {
      throw new ConflictException('Start the trip before completing it');
    }
    if (!canComplete(now, window)) {
      throw new ConflictException(
        'A trip can only be completed after its return time',
      );
    }
    if (dto.actualReturnTime <= existing.departureTime) {
      throw new BadRequestException(
        'The actual return time must be after the departure time',
      );
    }
    if (window.travelDate === now.date && dto.actualReturnTime > now.time) {
      throw new BadRequestException(
        'The actual return time cannot be in the future',
      );
    }
    if (
      dto.endingMileage !== undefined &&
      existing.startingMileage !== null &&
      dto.endingMileage < existing.startingMileage
    ) {
      throw new BadRequestException(
        'The ending mileage cannot be below the starting mileage',
      );
    }

    // Places visited that weren't planned. Ones already on the trip are skipped.
    const [visited, planned] = await Promise.all([
      this.resolveStops(user, dto.stops ?? []),
      this.prisma.marketingTransportRequestStop.findMany({
        where: { requestId: id },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { kind: true, refId: true, name: true },
      }),
    ]);
    const known = new Set(planned.map((stop) => `${stop.kind}:${stop.refId}`));
    const added = visited
      .filter((stop) => !known.has(`${stop.kind}:${stop.refId}`))
      .map((stop, index) => ({ ...stop, sortOrder: planned.length + index }));

    const resolved = await this.callHr(() =>
      this.directory.resolve(user.tenantId, { userId: user.id }),
    );
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.marketingTransportRequest.updateMany({
        where: { id, tenantId: user.tenantId, status: Status.APPROVED },
        data: {
          status: Status.COMPLETED,
          completedAt: new Date(),
          completedByUserId: user.id,
          completedByName: this.requesterFrom(user, resolved.person).name,
          actualReturnTime: dto.actualReturnTime,
          endingMileage: dto.endingMileage ?? null,
          endingCondition: dto.endingCondition,
          completionNotes: dto.notes || null,
        },
      });
      if (result.count === 0) {
        throw new ConflictException('This trip can no longer be completed');
      }
      // The vehicle's mileage follows each trip, so the next start is prefilled with it.
      if (existing.vehicleAssetId && dto.endingMileage !== undefined) {
        await tx.marketingFleetVehicle.updateMany({
          where: {
            tenantId: user.tenantId,
            assetId: existing.vehicleAssetId,
          },
          data: { currentMileage: dto.endingMileage },
        });
      }
      if (added.length) {
        await tx.marketingTransportRequestStop.createMany({
          data: added.map((stop) => ({
            tenantId: user.tenantId,
            requestId: id,
            ...stop,
            source: StopSource.VISITED,
          })),
        });
        await tx.marketingTransportRequest.update({
          where: { id },
          data: { destination: this.summarize([...planned, ...added]) },
        });
      }
    });
    // The vehicle's condition lives on its HR asset. The trip is already completed, so a failure
    // here is logged rather than undoing it.
    if (existing.vehicleAssetId) {
      try {
        await this.fleet.updateVehicle(user.tenantId, existing.vehicleAssetId, {
          condition: dto.endingCondition,
        });
      } catch (error) {
        this.logger.warn(
          `Could not record the condition of vehicle ${existing.vehicleAssetId} after trip ${id}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }
    return this.findOne(user, id);
  }

  async reject(user: RequestUser, id: string, dto: ReviewTransportRequestDto) {
    await this.getReviewable(user, id);

    const resolved = await this.callHr(() =>
      this.directory.resolve(user.tenantId, { userId: user.id }),
    );

    const result = await this.prisma.marketingTransportRequest.updateMany({
      where: { id, tenantId: user.tenantId, status: Status.PENDING },
      data: {
        status: Status.REJECTED,
        reviewedByUserId: user.id,
        reviewedByName: this.requesterFrom(user, resolved.person).name,
        reviewedAt: new Date(),
        reviewNote: dto.note || null,
      },
    });
    if (result.count === 0) {
      throw new ConflictException('This request has already been reviewed');
    }
    const response = await this.findOne(user, id);
    void this.notifier.rejected(user.tenantId, response, user.id);
    return response;
  }

  /**
   * Vehicles and drivers the approver can pick, flagged when they can't be used. Pass
   * a window to check a different date and times (rescheduling); otherwise the
   * request's own are used.
   */
  async allocationOptions(
    user: RequestUser,
    id: string,
    query: AllocationOptionsQueryDto = {},
  ) {
    const request = await this.prisma.marketingTransportRequest.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!request) throw new NotFoundException(NOT_FOUND_MESSAGE);

    const custom = query.travelDate || query.departureTime || query.returnTime;
    if (custom) {
      // The return time is optional, but the day and departure are needed to check anything.
      if (!query.travelDate || !query.departureTime) {
        throw new BadRequestException(
          'Give the date and departure time together',
        );
      }
      this.assertSchedule(
        query.travelDate,
        query.departureTime,
        query.returnTime,
        false,
      );
    }
    const window = custom
      ? {
          id: request.id,
          tenantId: request.tenantId,
          travelDate: this.toDate(query.travelDate),
          departureTime: query.departureTime,
          returnTime: query.returnTime ?? null,
        }
      : request;
    const now = this.trips.now();

    const [vehicles, people, fleetDetails, overlapping, stale] =
      await Promise.all([
        this.callHr(() => this.fleet.listVehicles(user.tenantId)),
        this.officers.activeDrivers(user.tenantId),
        this.prisma.marketingFleetVehicle.findMany({
          where: { tenantId: user.tenantId },
        }),
        this.prisma.marketingTransportRequest.findMany({
          where: this.overlapWhere(window),
          select: {
            vehicleAssetId: true,
            driverEmployeeId: true,
            departureTime: true,
            returnTime: true,
            requesterName: true,
          },
        }),
        this.prisma.marketingTransportRequest.findMany({
          where: this.staleWhere(user.tenantId, request.id, now),
          select: {
            vehicleAssetId: true,
            driverEmployeeId: true,
            travelDate: true,
            departureTime: true,
            returnTime: true,
            requesterName: true,
          },
        }),
      ]);
    const detailsByAsset = new Map(
      fleetDetails.map((row) => [row.assetId, row]),
    );
    const bookedText = (row: (typeof overlapping)[number]) =>
      `Already allocated to ${row.requesterName}'s trip (${windowText(row.departureTime, row.returnTime)})`;
    const overdueText = (row: (typeof stale)[number]) =>
      `Still out on ${row.requesterName}'s trip (${this.fromDate(row.travelDate)} ${windowText(row.departureTime, row.returnTime)}). Complete it first`;

    type Kind = 'MAINTENANCE' | 'OVERDUE' | 'BOOKED';
    const verdict = (
      overdueRow: (typeof stale)[number] | undefined,
      bookedRow: (typeof overlapping)[number] | undefined,
      maintenance = false,
    ): { kind: Kind | null; reason: string | null } => {
      if (maintenance)
        return { kind: 'MAINTENANCE', reason: 'Under maintenance' };
      if (overdueRow)
        return { kind: 'OVERDUE', reason: overdueText(overdueRow) };
      if (bookedRow) return { kind: 'BOOKED', reason: bookedText(bookedRow) };
      return { kind: null, reason: null };
    };

    return {
      vehicles: vehicles
        .filter((vehicle) => vehicle.status !== 'RETIRED')
        .map((vehicle) => {
          const details = detailsByAsset.get(vehicle.id);
          const { kind, reason } = verdict(
            stale.find((row) => row.vehicleAssetId === vehicle.id),
            overlapping.find((row) => row.vehicleAssetId === vehicle.id),
            vehicle.status === 'MAINTENANCE',
          );
          return {
            assetId: vehicle.id,
            name: details ? `${details.make} ${details.model}` : vehicle.name,
            assetNumber: vehicle.assetNumber,
            available: kind === null,
            unavailableKind: kind,
            unavailableReason: reason,
          };
        }),
      drivers: people.map((person) => {
        const { kind, reason } = verdict(
          stale.find((row) => row.driverEmployeeId === person.employeeId),
          overlapping.find((row) => row.driverEmployeeId === person.employeeId),
        );
        return {
          employeeId: person.employeeId,
          name: person.name,
          department: person.department,
          available: kind === null,
          unavailableKind: kind,
          unavailableReason: reason,
        };
      }),
    };
  }

  /**
   * Validates a vehicle + driver (or self-driven) for a window and writes the
   * allocation along with `data`, all in one serializable transaction so two
   * approvers can't both take the same vehicle or driver.
   */
  private async allocate(input: {
    user: RequestUser;
    existing: RequestRow;
    dto: ApproveTransportRequestDto;
    window: {
      travelDate: Date;
      departureTime: string;
      returnTime: string | null;
    };
    expectedStatus: Status;
    staleMessage: string;
    data: (ctx: {
      reviewerName: string;
    }) => Prisma.MarketingTransportRequestUpdateManyMutationInput;
  }) {
    const { user, existing, dto, window } = input;

    const selfDriven = dto.selfDriven === true;
    if (selfDriven && dto.driverEmployeeId) {
      throw new BadRequestException(
        'Choose either a driver or self-driven, not both',
      );
    }
    if (!selfDriven && !dto.driverEmployeeId) {
      throw new BadRequestException(
        'Select a driver, or mark the trip as self-driven',
      );
    }
    if (dto.driverEmployeeId) {
      await this.officers.assertActiveOfficer(
        user.tenantId,
        dto.driverEmployeeId,
      );
    }

    const [resolved, vehicle] = await Promise.all([
      this.callHr(() =>
        this.directory.resolve(user.tenantId, {
          userId: user.id,
          ...(dto.driverEmployeeId
            ? { employeeIds: [dto.driverEmployeeId] }
            : {}),
        }),
      ),
      this.callHr(() =>
        this.fleet.getVehicle(user.tenantId, dto.vehicleAssetId),
      ),
    ]);
    // Self-driven: the requester is the driver, so they can't be double-booked either.
    const driver = selfDriven
      ? {
          employeeId: existing.requesterEmployeeId,
          name: existing.requesterName,
        }
      : resolved.people[0];
    this.assertVehicleUsable(vehicle);

    const details = await this.prisma.marketingFleetVehicle.findUnique({
      where: {
        tenantId_assetId: { tenantId: user.tenantId, assetId: vehicle.id },
      },
    });
    const vehicleName = details
      ? `${details.make} ${details.model}`
      : vehicle.name;
    const owners = [
      { vehicleAssetId: vehicle.id },
      ...(driver.employeeId ? [{ driverEmployeeId: driver.employeeId }] : []),
    ];
    const reviewerName = this.requesterFrom(user, resolved.person).name;
    const now = this.trips.now();

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const who = (clashVehicleId: string | null) =>
            clashVehicleId === vehicle.id
              ? `${vehicleName} is`
              : `${driver.name} is`;

          // A trip that is overdue (or, with no return time, already out) and unresolved still has
          // its vehicle and driver. The time test and the owners test are separate AND terms: they
          // are both `OR`s, so spreading one over the other would silently drop the time test.
          const stale = await tx.marketingTransportRequest.findFirst({
            where: {
              AND: [
                this.staleWhere(user.tenantId, existing.id, now),
                { OR: owners },
              ],
            },
            select: {
              vehicleAssetId: true,
              travelDate: true,
              departureTime: true,
              returnTime: true,
              requesterName: true,
            },
          });
          if (stale) {
            throw new ConflictException(
              `${who(stale.vehicleAssetId)} still out on ${stale.requesterName}'s trip ` +
                `(${this.fromDate(stale.travelDate)} ${windowText(stale.departureTime, stale.returnTime)}). Complete it first`,
            );
          }

          const clash = await tx.marketingTransportRequest.findFirst({
            where: {
              AND: [
                this.overlapWhere({
                  id: existing.id,
                  tenantId: user.tenantId,
                  ...window,
                }),
                { OR: owners },
              ],
            },
            select: {
              vehicleAssetId: true,
              departureTime: true,
              returnTime: true,
              requesterName: true,
            },
          });
          if (clash) {
            throw new ConflictException(
              `${who(clash.vehicleAssetId)} already allocated to ${clash.requesterName}'s trip ` +
                `(${windowText(clash.departureTime, clash.returnTime)}) on that day`,
            );
          }

          // The status condition makes a concurrent change lose cleanly instead of overwriting.
          const result = await tx.marketingTransportRequest.updateMany({
            where: {
              id: existing.id,
              tenantId: user.tenantId,
              status: input.expectedStatus,
            },
            data: {
              ...input.data({ reviewerName }),
              vehicleAssetId: vehicle.id,
              vehicleName,
              vehicleAssetNumber: vehicle.assetNumber,
              driverEmployeeId: driver.employeeId,
              driverName: driver.name,
              selfDriven,
            },
          });
          if (result.count === 0) {
            throw new ConflictException(input.staleMessage);
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      // Serialization failure: another approval touched the same schedule at the same moment.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Another approval changed the schedule at the same time. Please try again.',
        );
      }
      throw error;
    }
  }

  private async getReviewable(user: RequestUser, id: string) {
    const existing = await this.prisma.marketingTransportRequest.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException(NOT_FOUND_MESSAGE);
    // Whoever holds the approve permission may review, including the requester.
    if (existing.status !== Status.PENDING) {
      throw new ConflictException('Only pending requests can be reviewed');
    }
    return existing;
  }

  /**
   * Approved trips whose window overlaps `w`. A trip with no return time runs on until
   * someone completes it, so it overlaps everything from its departure onwards.
   * Both halves are separate terms of an AND so neither can overwrite the other.
   */
  private overlapWhere(w: {
    id: string;
    tenantId: string;
    travelDate: Date;
    departureTime: string;
    returnTime: string | null;
  }): Prisma.MarketingTransportRequestWhereInput {
    // The other trip ends after this one starts (or has no end).
    const endsAfterStart: Prisma.MarketingTransportRequestWhereInput = {
      OR: [
        { returnTime: null },
        { travelDate: { gt: w.travelDate } },
        { travelDate: w.travelDate, returnTime: { gt: w.departureTime } },
      ],
    };
    // The other trip starts before this one ends (always true if this one has no end).
    const startsBeforeEnd: Prisma.MarketingTransportRequestWhereInput[] =
      w.returnTime
        ? [
            {
              OR: [
                { travelDate: { lt: w.travelDate } },
                {
                  travelDate: w.travelDate,
                  departureTime: { lt: w.returnTime },
                },
              ],
            },
          ]
        : [];
    return {
      tenantId: w.tenantId,
      status: Status.APPROVED,
      id: { not: w.id },
      AND: [endsAfterStart, ...startsBeforeEnd],
    };
  }

  private assertVehicleUsable(vehicle: HrVehicleAsset) {
    if (vehicle.status === 'RETIRED') {
      throw new BadRequestException('This vehicle is retired');
    }
    if (vehicle.status === 'MAINTENANCE') {
      throw new BadRequestException('This vehicle is under maintenance');
    }
  }

  /**
   * Started trips that are still out and nobody has resolved: past their return time, or, with
   * no return time, simply still out. They keep their vehicle and driver occupied. A trip that
   * was never started has not left, so it holds nothing.
   */
  private staleWhere(
    tenantId: string,
    excludeId: string,
    now: WallClock,
  ): Prisma.MarketingTransportRequestWhereInput {
    const today = new Date(`${now.date}T00:00:00.000Z`);
    return {
      tenantId,
      status: Status.APPROVED,
      startedAt: { not: null },
      id: { not: excludeId },
      OR: [
        { returnTime: null },
        {
          returnTime: { not: null },
          OR: [
            { travelDate: { lt: today } },
            { travelDate: today, returnTime: { lte: now.time } },
          ],
        },
      ],
    };
  }

  /** The requester, or anyone allowed to approve, can act on a request. */
  private async findForActor(user: RequestUser, id: string) {
    const row = await this.prisma.marketingTransportRequest.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    const allowed =
      row &&
      (row.requesterUserId === user.id ||
        this.hasPermission(
          user,
          MarketingCrmSettingsPermission.REQUESTS_APPROVE_ALL,
        ));
    // Same response for "not yours" and "doesn't exist" so ids can't be probed.
    if (!row || !allowed) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return row;
  }

  private hasPermission(user: RequestUser, permission: string) {
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN')
      return true;
    return user.permissions.includes(permission);
  }

  private async findOwn(user: RequestUser, id: string) {
    const row = await this.prisma.marketingTransportRequest.findFirst({
      where: { id, tenantId: user.tenantId, requesterUserId: user.id },
    });
    // Same response for "not yours" and "doesn't exist" so ids can't be probed.
    if (!row) throw new NotFoundException(NOT_FOUND_MESSAGE);
    return row;
  }

  private visibilityWhere(
    user: RequestUser,
  ): Prisma.MarketingTransportRequestWhereInput {
    return this.canViewAll(user) ? {} : { requesterUserId: user.id };
  }

  private canViewAll(user: RequestUser) {
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN')
      return true;
    return user.permissions.includes(
      MarketingCrmSettingsPermission.REQUESTS_VIEW_ALL,
    );
  }

  /** Falls back to the login name when the user has no linked employee record. */
  private requesterFrom(
    user: RequestUser,
    person: {
      employeeId: string;
      name: string;
      department: string | null;
    } | null,
  ) {
    return {
      employeeId: person?.employeeId ?? null,
      name: person?.name ?? user.firstName,
      department: person?.department ?? null,
    };
  }

  private assertSchedule(
    travelDate: string,
    departureTime: string,
    returnTime: string | null | undefined,
    checkPast: boolean,
  ) {
    const date = this.toDate(travelDate);
    if (Number.isNaN(date.getTime()) || this.fromDate(date) !== travelDate) {
      throw new BadRequestException('Travel date is not a valid date');
    }
    if (checkPast) {
      // One day of slack so timezones don't reject "today" for users west of UTC.
      const todayUtc = Math.floor(Date.now() / DAY_MS) * DAY_MS;
      if (date.getTime() < todayUtc - DAY_MS) {
        throw new BadRequestException('Travel date cannot be in the past');
      }
    }
    // The return time is optional; when given it must come after the departure.
    if (returnTime && returnTime <= departureTime) {
      throw new BadRequestException(
        'Return time must be after the departure time',
      );
    }
  }

  private toDate(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private fromDate(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  /**
   * ON_ROUTE isn't stored as a status: an approved request reads as on route once
   * someone has started it, and stays that way until it is completed, cancelled
   * or rescheduled.
   */
  private displayStatus(row: {
    status: Status;
    startedAt: Date | null;
  }): Status | 'ON_ROUTE' {
    return row.status === Status.APPROVED && row.startedAt
      ? 'ON_ROUTE'
      : row.status;
  }

  /** Turns the requested statuses (including the derived ON_ROUTE) into a query. */
  private statusWhere(
    statuses: RequestStatusFilter[],
  ): Prisma.MarketingTransportRequestWhereInput {
    return {
      OR: statuses.map((status) => {
        if (status === 'ON_ROUTE')
          return { status: Status.APPROVED, startedAt: { not: null } };
        // APPROVED means approved and not yet started; started ones are ON_ROUTE.
        if (status === Status.APPROVED) {
          return { status: Status.APPROVED, startedAt: null };
        }
        return { status };
      }),
    };
  }

  /**
   * Who is travelling in the vehicle apart from the driver. The requester travels,
   * unless they are the one driving; an added passenger who is also the assigned
   * driver is counted as the driver, not as a passenger.
   */
  private occupants(row: RequestWithPassengers) {
    const driverId = row.driverEmployeeId;
    const requesterIsDriver =
      row.selfDriven || (!!driverId && driverId === row.requesterEmployeeId);
    const passengers = row.passengers.filter(
      (passenger) => passenger.employeeId !== driverId,
    );
    return {
      requesterIsDriver,
      passengers,
      count: passengers.length + (requesterIsDriver ? 0 : 1),
    };
  }

  /** "Acme Ltd, Beta Co": what is stored as the request's destination. */
  private summarize(stops: { name: string }[]) {
    return stops.map((stop) => stop.name).join(', ');
  }

  /**
   * Which clients and prospects a person can choose: everyone's if they can view all of them
   * (admins included), otherwise only the ones assigned to them, like the Clients and
   * Prospects pages themselves. Someone with none assigned simply gets an empty list.
   */
  private destinationScope(user: RequestUser) {
    return {
      allClients: this.hasPermission(
        user,
        MarketingCrmSettingsPermission.CLIENTS_VIEW_ALL,
      ),
      allProspects: this.hasPermission(
        user,
        MarketingCrmSettingsPermission.PROSPECTS_VIEW_ALL,
      ),
    };
  }

  private normalizeText(value: string) {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  /** Clients and prospects the person could choose as destinations, optionally matching a name. */
  async destinationOptions(
    user: RequestUser,
    query: DestinationOptionsQueryDto = {},
  ) {
    const limit = query.limit ?? 20;
    const scope = this.destinationScope(user);
    const nameFilter = query.search
      ? {
          normalizedCompanyName: { contains: this.normalizeText(query.search) },
        }
      : {};
    const select = {
      id: true,
      companyName: true,
      locationLabel: true,
      latitude: true,
      longitude: true,
    } as const;

    const [clients, prospects] = await Promise.all([
      this.prisma.marketingClient.findMany({
        where: {
          tenantId: user.tenantId,
          ...(scope.allClients ? {} : { assignedUserId: user.id }),
          ...nameFilter,
        },
        select,
        orderBy: { companyName: 'asc' },
        take: limit,
      }),
      this.prisma.marketingProspect.findMany({
        where: {
          tenantId: user.tenantId,
          // A converted prospect is listed as the client it became.
          client: { is: null },
          ...(scope.allProspects ? {} : { assignedUserId: user.id }),
          ...nameFilter,
        },
        select,
        orderBy: { companyName: 'asc' },
        take: limit,
      }),
    ]);

    const toOption = (
      kind: StopKind,
      row: PlaceRow,
    ): Omit<StopSnapshot, 'refId' | 'sortOrder'> & { id: string } => ({
      kind,
      id: row.id,
      name: row.companyName,
      locationLabel: row.locationLabel,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    });
    const data = [
      ...clients.map((row) => toOption(StopKind.CLIENT, row)),
      ...prospects.map((row) => toOption(StopKind.PROSPECT, row)),
    ]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
    return { data };
  }

  /**
   * Turns chosen clients and prospects into the snapshots stored on a request. Only ones the
   * person is allowed to see can be chosen, so an id from elsewhere is refused.
   */
  private async resolveStops(
    user: RequestUser,
    refs: TransportStopDto[],
    /** A prospect the person may use even when it is not assigned to them (an appointment's). */
    allowedProspectId?: string,
  ): Promise<StopSnapshot[]> {
    const seen = new Set<string>();
    const unique = refs.filter((ref) => {
      const key = `${ref.kind}:${ref.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (unique.length === 0) return [];

    const scope = this.destinationScope(user);
    const idsOf = (kind: StopKind) =>
      unique.filter((ref) => ref.kind === kind).map((ref) => ref.id);
    const select = {
      id: true,
      companyName: true,
      locationLabel: true,
      latitude: true,
      longitude: true,
    } as const;
    const clientIds = idsOf(StopKind.CLIENT);
    const prospectIds = idsOf(StopKind.PROSPECT);

    const [clients, prospects]: [PlaceRow[], PlaceRow[]] = await Promise.all([
      clientIds.length
        ? this.prisma.marketingClient.findMany({
            where: {
              tenantId: user.tenantId,
              id: { in: clientIds },
              ...(scope.allClients ? {} : { assignedUserId: user.id }),
            },
            select,
          })
        : Promise.resolve([] as PlaceRow[]),
      prospectIds.length
        ? this.prisma.marketingProspect.findMany({
            where: {
              tenantId: user.tenantId,
              id: { in: prospectIds },
              ...(scope.allProspects
                ? {}
                : allowedProspectId
                  ? {
                      OR: [
                        { assignedUserId: user.id },
                        { id: allowedProspectId },
                      ],
                    }
                  : { assignedUserId: user.id }),
            },
            select,
          })
        : Promise.resolve([] as PlaceRow[]),
    ]);

    const byKey = new Map<string, PlaceRow>([
      ...clients.map((row) => [`${StopKind.CLIENT}:${row.id}`, row] as const),
      ...prospects.map(
        (row) => [`${StopKind.PROSPECT}:${row.id}`, row] as const,
      ),
    ]);
    return unique.map((ref, index) => {
      const row = byKey.get(`${ref.kind}:${ref.id}`);
      if (!row) {
        throw new BadRequestException('One or more locations were not found');
      }
      return {
        kind: ref.kind,
        refId: ref.id,
        name: row.companyName,
        locationLabel: row.locationLabel,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        sortOrder: index,
      };
    });
  }

  private toResponse(row: RequestWithPassengers, now: WallClock) {
    const occupants = this.occupants(row);
    return {
      id: row.id,
      status: this.displayStatus(row),
      purpose: row.purpose,
      appointmentId: row.appointmentId,
      // Older requests kept a free-text purpose here; new ones leave it empty.
      businessPurpose: row.businessPurpose,
      travelDate: this.fromDate(row.travelDate),
      departureTime: row.departureTime,
      returnTime: row.returnTime,
      // A summary of the stops (or the old typed destination on older requests).
      destination: row.destination,
      stops: row.stops.map((stop) => ({
        kind: stop.kind,
        refId: stop.refId,
        name: stop.name,
        locationLabel: stop.locationLabel,
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
        source: stop.source,
      })),
      notes: row.notes,
      requester: {
        userId: row.requesterUserId,
        name: row.requesterName,
        department: row.requesterDepartment,
      },
      // People in the vehicle excluding the driver (the requester included unless driving).
      passengerCount: occupants.count,
      requesterIsDriver: occupants.requesterIsDriver,
      passengers: row.passengers.map((passenger) => ({
        employeeId: passenger.employeeId,
        name: passenger.name,
        department: passenger.department,
      })),
      review: row.reviewedAt
        ? {
            byName: row.reviewedByName,
            at: row.reviewedAt.toISOString(),
            note: row.reviewNote,
          }
        : null,
      // The trip can be completed now: it has been started and its return time passed (or it had none).
      completable:
        row.status === Status.APPROVED &&
        canComplete(now, {
          travelDate: this.fromDate(row.travelDate),
          departureTime: row.departureTime,
          returnTime: row.returnTime,
          started: row.startedAt !== null,
        }),
      // Return time has passed on a trip nobody has completed yet.
      overdue:
        row.status === Status.APPROVED &&
        row.startedAt !== null &&
        isOverdue(now, {
          travelDate: this.fromDate(row.travelDate),
          departureTime: row.departureTime,
          returnTime: row.returnTime,
          started: true,
        }),
      // The trip can be started now: approved, not started, and its day has come.
      startable:
        row.status === Status.APPROVED &&
        row.startedAt === null &&
        this.fromDate(row.travelDate) <= now.date,
      start: row.startedAt
        ? {
            at: row.startedAt.toISOString(),
            byName: row.startedByName,
            actualDepartureTime: row.actualDepartureTime,
            mileage: row.startingMileage,
            condition: row.startingCondition,
            notes: row.startNotes,
            // Positive = left late, negative = early.
            minutesLate: row.actualDepartureTime
              ? minutesBetween(row.departureTime, row.actualDepartureTime)
              : null,
          }
        : null,
      completion: row.completedAt
        ? {
            at: row.completedAt.toISOString(),
            byName: row.completedByName,
            actualReturnTime: row.actualReturnTime,
            endingMileage: row.endingMileage,
            endingCondition: row.endingCondition,
            notes: row.completionNotes,
            // Kilometres covered, from the starting and ending mileage.
            distance:
              row.startingMileage !== null && row.endingMileage !== null
                ? row.endingMileage - row.startingMileage
                : null,
            // Positive = came back late, negative = early, null = never recorded.
            minutesLate:
              row.actualReturnTime && row.returnTime
                ? minutesBetween(row.returnTime, row.actualReturnTime)
                : null,
          }
        : null,
      reschedule:
        row.rescheduleCount > 0 && row.previousTravelDate
          ? {
              count: row.rescheduleCount,
              at: row.rescheduledAt?.toISOString() ?? null,
              byName: row.rescheduledByName,
              previous: {
                travelDate: this.fromDate(row.previousTravelDate),
                departureTime: row.previousDepartureTime,
                returnTime: row.previousReturnTime,
              },
            }
          : null,
      allocation:
        row.vehicleAssetId && (row.driverEmployeeId || row.selfDriven)
          ? {
              vehicle: {
                assetId: row.vehicleAssetId,
                name: row.vehicleName,
                assetNumber: row.vehicleAssetNumber,
              },
              driver: {
                employeeId: row.driverEmployeeId,
                name: row.driverName,
                selfDriven: row.selfDriven,
              },
            }
          : null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private callHr<T>(action: () => Promise<T>) {
    return callHr(
      this.logger,
      action,
      'Employee details are temporarily unavailable. Please try again.',
    );
  }
}
