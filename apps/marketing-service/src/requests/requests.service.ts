import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { TransportOfficersService } from '../transport-officers/transport-officers.service';
import {
  ApproveTransportRequestDto,
  CreateTransportRequestDto,
  QueryTransportRequestsDto,
  ReviewTransportRequestDto,
  UpdateTransportRequestDto,
} from './dto/transport-request.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOT_FOUND_MESSAGE = 'Transport request not found';

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
  ) {}

  async list(user: RequestUser, query: QueryTransportRequestsDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.MarketingTransportRequestWhereInput = {
      tenantId: user.tenantId,
      ...this.visibilityWhere(user),
      ...(query.status?.length ? { status: { in: query.status } } : {}),
      ...(query.search
        ? {
            OR: [
              {
                businessPurpose: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { destination: { contains: query.search, mode: 'insensitive' } },
              {
                requesterName: { contains: query.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
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
      data: rows.map((row) => this.toResponse(row)),
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
    return this.toResponse(row);
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

    return this.toResponse(created);
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

    return this.toResponse(updated);
  }

  async cancel(user: RequestUser, id: string) {
    const existing = await this.findOwn(user, id);
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
    return this.findOne(user, id);
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
    await this.officers.assertActiveOfficer(
      user.tenantId,
      dto.driverEmployeeId,
    );

    const [resolved, vehicle] = await Promise.all([
      this.callHr(() =>
        this.directory.resolve(user.tenantId, {
          userId: user.id,
          employeeIds: [dto.driverEmployeeId],
        }),
      ),
      this.callHr(() =>
        this.fleet.getVehicle(user.tenantId, dto.vehicleAssetId),
      ),
    ]);
    const driver = resolved.people[0];
    this.assertVehicleUsable(vehicle);

    const details = await this.prisma.marketingFleetVehicle.findUnique({
      where: {
        tenantId_assetId: { tenantId: user.tenantId, assetId: vehicle.id },
      },
    });
    const vehicleName = details
      ? `${details.make} ${details.model}`
      : vehicle.name;

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const clashes = await tx.marketingTransportRequest.findMany({
            where: {
              ...this.overlapWhere(existing),
              OR: [
                { vehicleAssetId: vehicle.id },
                { driverEmployeeId: driver.employeeId },
              ],
            },
            select: {
              vehicleAssetId: true,
              driverEmployeeId: true,
              departureTime: true,
              returnTime: true,
              requesterName: true,
            },
          });
          if (clashes.length) {
            const clash = clashes[0];
            const who =
              clash.vehicleAssetId === vehicle.id
                ? `${vehicleName} is`
                : `${driver.name} is`;
            throw new ConflictException(
              `${who} already allocated to ${clash.requesterName}'s trip ` +
                `(${clash.departureTime}–${clash.returnTime}) on that day`,
            );
          }

          // The status condition makes a concurrent review lose cleanly instead of overwriting.
          const result = await tx.marketingTransportRequest.updateMany({
            where: { id, tenantId: user.tenantId, status: Status.PENDING },
            data: {
              status: Status.APPROVED,
              reviewedByUserId: user.id,
              reviewedByName: this.requesterFrom(user, resolved.person).name,
              reviewedAt: new Date(),
              reviewNote: dto.note || null,
              vehicleAssetId: vehicle.id,
              vehicleName,
              vehicleAssetNumber: vehicle.assetNumber,
              driverEmployeeId: driver.employeeId,
              driverName: driver.name,
            },
          });
          if (result.count === 0) {
            throw new ConflictException(
              'This request has already been reviewed',
            );
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
    return this.findOne(user, id);
  }

  /** Vehicles and drivers the approver can pick, flagged when busy on this request's slot. */
  async allocationOptions(user: RequestUser, id: string) {
    const request = await this.prisma.marketingTransportRequest.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!request) throw new NotFoundException(NOT_FOUND_MESSAGE);

    const [vehicles, people, fleetDetails, overlapping] = await Promise.all([
      this.callHr(() => this.fleet.listVehicles(user.tenantId)),
      this.officers.activeDrivers(user.tenantId),
      this.prisma.marketingFleetVehicle.findMany({
        where: { tenantId: user.tenantId },
      }),
      this.prisma.marketingTransportRequest.findMany({
        where: this.overlapWhere(request),
        select: {
          vehicleAssetId: true,
          driverEmployeeId: true,
          departureTime: true,
          returnTime: true,
          requesterName: true,
        },
      }),
    ]);
    const detailsByAsset = new Map(
      fleetDetails.map((row) => [row.assetId, row]),
    );
    const busyText = (row: (typeof overlapping)[number]) =>
      `Already allocated to ${row.requesterName}'s trip (${row.departureTime}–${row.returnTime})`;

    return {
      vehicles: vehicles
        .filter((vehicle) => vehicle.status !== 'RETIRED')
        .map((vehicle) => {
          const details = detailsByAsset.get(vehicle.id);
          const busy = overlapping.find(
            (row) => row.vehicleAssetId === vehicle.id,
          );
          const reason =
            vehicle.status === 'MAINTENANCE'
              ? 'Under maintenance'
              : busy
                ? busyText(busy)
                : null;
          return {
            assetId: vehicle.id,
            name: details ? `${details.make} ${details.model}` : vehicle.name,
            assetNumber: vehicle.assetNumber,
            available: reason === null,
            unavailableReason: reason,
          };
        }),
      drivers: people.map((person) => {
        const busy = overlapping.find(
          (row) => row.driverEmployeeId === person.employeeId,
        );
        return {
          employeeId: person.employeeId,
          name: person.name,
          department: person.department,
          available: !busy,
          unavailableReason: busy ? busyText(busy) : null,
        };
      }),
    };
  }

  private async getReviewable(user: RequestUser, id: string) {
    const existing = await this.prisma.marketingTransportRequest.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) throw new NotFoundException(NOT_FOUND_MESSAGE);
    if (existing.requesterUserId === user.id) {
      throw new ForbiddenException('You cannot review your own request');
    }
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

  private toResponse(row: RequestWithPassengers) {
    return {
      id: row.id,
      status: row.status,
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
      allocation:
        row.vehicleAssetId && row.driverEmployeeId
          ? {
              vehicle: {
                assetId: row.vehicleAssetId,
                name: row.vehicleName,
                assetNumber: row.vehicleAssetNumber,
              },
              driver: {
                employeeId: row.driverEmployeeId,
                name: row.driverName,
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
