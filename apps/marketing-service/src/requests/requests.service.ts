import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingTransportRequestStatus as Status,
  Prisma,
} from '../../prisma/generated/client';
import { HrFleetClient, HrVehicleAsset } from '../fleet/hr-fleet.client';
import { MarketingCrmSettingsPermission } from '../crm-settings/crm-settings.permissions';
import { callHr } from '../hr/call-hr';
import { HrDirectoryClient } from '../hr/hr-directory.client';
import { PrismaService } from '../prisma/prisma.service';
import {
  isOverdue,
  minutesBetween,
  tripState,
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
  QueryTransportRequestsDto,
  RequestStatusFilter,
  RescheduleTransportRequestDto,
  ReviewTransportRequestDto,
  UpdateTransportRequestDto,
} from './dto/transport-request.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOT_FOUND_MESSAGE = 'Transport request not found';

type RequestRow = Prisma.MarketingTransportRequestGetPayload<object>;

type RequestWithPassengers = Prisma.MarketingTransportRequestGetPayload<{
  include: { passengers: true };
}>;

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
        ...(query.status?.length ? [this.statusWhere(query.status, now)] : []),
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
        include: { passengers: { orderBy: { name: 'asc' } } },
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
      include: { passengers: { orderBy: { name: 'asc' } } },
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

    const resolved = await this.callHr(() =>
      this.directory.resolve(user.tenantId, {
        userId: user.id,
        employeeIds: dto.passengerIds,
      }),
    );
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
        businessPurpose: dto.businessPurpose,
        travelDate: this.toDate(dto.travelDate),
        departureTime: dto.departureTime,
        returnTime: dto.returnTime,
        destination: dto.destination,
        notes: dto.notes || null,
        passengers: {
          create: passengers.map((person) => ({
            tenantId: user.tenantId,
            employeeId: person.employeeId,
            name: person.name,
            department: person.department,
          })),
        },
      },
      include: { passengers: { orderBy: { name: 'asc' } } },
    });

    const response = this.toResponse(created, this.trips.now());
    // Tell the approvers (best-effort, not awaited so the request returns straight away).
    void this.notifier.requested(user.tenantId, response);
    return response;
  }

  async update(user: RequestUser, id: string, dto: UpdateTransportRequestDto) {
    const existing = await this.findOwn(user, id);
    if (existing.status !== Status.PENDING) {
      throw new ConflictException('Only pending requests can be edited');
    }

    const schedule = {
      travelDate: dto.travelDate ?? this.fromDate(existing.travelDate),
      departureTime: dto.departureTime ?? existing.departureTime,
      returnTime: dto.returnTime ?? existing.returnTime,
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

    const updated = await this.prisma.$transaction(async (tx) => {
      if (passengers) {
        await tx.marketingTransportRequestPassenger.deleteMany({
          where: { requestId: id },
        });
      }
      return tx.marketingTransportRequest.update({
        where: { id },
        data: {
          ...(dto.businessPurpose !== undefined
            ? { businessPurpose: dto.businessPurpose }
            : {}),
          ...(dto.travelDate !== undefined
            ? { travelDate: this.toDate(dto.travelDate) }
            : {}),
          ...(dto.departureTime !== undefined
            ? { departureTime: dto.departureTime }
            : {}),
          ...(dto.returnTime !== undefined
            ? { returnTime: dto.returnTime }
            : {}),
          ...(dto.destination !== undefined
            ? { destination: dto.destination }
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
        },
        include: { passengers: { orderBy: { name: 'asc' } } },
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
        returnTime: dto.returnTime,
      },
      expectedStatus: Status.APPROVED,
      staleMessage: 'This trip is no longer approved',
      data: ({ reviewerName }) => ({
        travelDate: this.toDate(dto.travelDate),
        departureTime: dto.departureTime,
        returnTime: dto.returnTime,
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
   * Closes a trip once it is overdue, recording when it really got back so
   * on-time returns can be seen. Final: a completed trip can't be changed.
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
    };
    if (!isOverdue(now, window)) {
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

    const resolved = await this.callHr(() =>
      this.directory.resolve(user.tenantId, { userId: user.id }),
    );
    const result = await this.prisma.marketingTransportRequest.updateMany({
      where: { id, tenantId: user.tenantId, status: Status.APPROVED },
      data: {
        status: Status.COMPLETED,
        completedAt: new Date(),
        completedByUserId: user.id,
        completedByName: this.requesterFrom(user, resolved.person).name,
        actualReturnTime: dto.actualReturnTime,
      },
    });
    if (result.count === 0) {
      throw new ConflictException('This trip can no longer be completed');
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
      if (!query.travelDate || !query.departureTime || !query.returnTime) {
        throw new BadRequestException(
          'Give the date, departure time and return time together',
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
          returnTime: query.returnTime,
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
          where: this.overdueWhere(user.tenantId, request.id, now),
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
      `Already allocated to ${row.requesterName}'s trip (${row.departureTime}–${row.returnTime})`;
    const overdueText = (row: (typeof stale)[number]) =>
      `Still out on ${row.requesterName}'s trip (${this.fromDate(row.travelDate)} ${row.departureTime}–${row.returnTime}). Complete it first`;

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
    window: { travelDate: Date; departureTime: string; returnTime: string };
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

          // A trip that is overdue and unresolved still has its vehicle and driver out.
          const stale = await tx.marketingTransportRequest.findFirst({
            where: {
              ...this.overdueWhere(user.tenantId, existing.id, now),
              OR: owners,
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
                `(${this.fromDate(stale.travelDate)} ${stale.departureTime}–${stale.returnTime}). Complete it first`,
            );
          }

          const clash = await tx.marketingTransportRequest.findFirst({
            where: {
              ...this.overlapWhere({
                id: existing.id,
                tenantId: user.tenantId,
                ...window,
              }),
              OR: owners,
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
                `(${clash.departureTime}–${clash.returnTime}) on that day`,
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

  /** Approved trips on the same day whose time window overlaps this one. */
  private overlapWhere(request: {
    id: string;
    tenantId: string;
    travelDate: Date;
    departureTime: string;
    returnTime: string;
  }): Prisma.MarketingTransportRequestWhereInput {
    return {
      tenantId: request.tenantId,
      status: Status.APPROVED,
      id: { not: request.id },
      travelDate: request.travelDate,
      departureTime: { lt: request.returnTime },
      returnTime: { gt: request.departureTime },
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

  /** Approved trips whose return time has passed and that nobody has resolved. */
  private overdueWhere(
    tenantId: string,
    excludeId: string,
    now: WallClock,
  ): Prisma.MarketingTransportRequestWhereInput {
    const today = new Date(`${now.date}T00:00:00.000Z`);
    return {
      tenantId,
      status: Status.APPROVED,
      id: { not: excludeId },
      OR: [
        { travelDate: { lt: today } },
        { travelDate: today, returnTime: { lte: now.time } },
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
    returnTime: string,
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
    if (returnTime <= departureTime) {
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
   * ON_ROUTE isn't stored: an approved request reads as on route once its
   * departure time has passed, and stays that way until it is completed,
   * cancelled or rescheduled.
   */
  private displayStatus(
    row: {
      status: Status;
      travelDate: Date;
      departureTime: string;
      returnTime: string;
    },
    now: WallClock,
  ): Status | 'ON_ROUTE' {
    if (row.status !== Status.APPROVED) return row.status;
    const state = tripState(now, {
      travelDate: this.fromDate(row.travelDate),
      departureTime: row.departureTime,
      returnTime: row.returnTime,
    });
    return state === 'ON_ROUTE' ? 'ON_ROUTE' : row.status;
  }

  /** Turns the requested statuses (including the derived ON_ROUTE) into a query. */
  private statusWhere(
    statuses: RequestStatusFilter[],
    now: WallClock,
  ): Prisma.MarketingTransportRequestWhereInput {
    const today = new Date(`${now.date}T00:00:00.000Z`);
    const departed: Prisma.MarketingTransportRequestWhereInput = {
      OR: [
        { travelDate: { lt: today } },
        { travelDate: today, departureTime: { lte: now.time } },
      ],
    };
    const notDeparted: Prisma.MarketingTransportRequestWhereInput = {
      OR: [
        { travelDate: { gt: today } },
        { travelDate: today, departureTime: { gt: now.time } },
      ],
    };
    return {
      OR: statuses.map((status) => {
        if (status === 'ON_ROUTE')
          return { status: Status.APPROVED, ...departed };
        // APPROVED means approved and not yet departed; departed ones are ON_ROUTE.
        if (status === Status.APPROVED) {
          return { status: Status.APPROVED, ...notDeparted };
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

  private toResponse(row: RequestWithPassengers, now: WallClock) {
    const occupants = this.occupants(row);
    return {
      id: row.id,
      status: this.displayStatus(row, now),
      businessPurpose: row.businessPurpose,
      travelDate: this.fromDate(row.travelDate),
      departureTime: row.departureTime,
      returnTime: row.returnTime,
      destination: row.destination,
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
      // Return time has passed on a trip nobody has completed yet.
      overdue:
        row.status === Status.APPROVED &&
        isOverdue(now, {
          travelDate: this.fromDate(row.travelDate),
          departureTime: row.departureTime,
          returnTime: row.returnTime,
        }),
      completion: row.completedAt
        ? {
            at: row.completedAt.toISOString(),
            byName: row.completedByName,
            actualReturnTime: row.actualReturnTime,
            // Positive = came back late, negative = early, null = never recorded.
            minutesLate: row.actualReturnTime
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
