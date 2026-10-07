import { Injectable, Logger } from '@nestjs/common';
import {
  MarketingTransportRequestStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_TRANSPORT_TIMEZONE,
  isOverdue,
  minutesBetween,
  TripState,
  tripState,
  wallClockNow,
} from './trip-schedule';

export interface ScheduledTrip {
  requestId: string;
  travelDate: string;
  departureTime: string;
  /** Null when the trip had no planned return time. */
  returnTime: string | null;
  destination: string;
  requesterName: string;
  vehicle: {
    assetId: string;
    name: string | null;
    assetNumber: string | null;
  } | null;
  driver: { employeeId: string | null; name: string | null } | null;
  selfDriven: boolean;
  state: TripState;
  /** The return time has passed but the trip has not been completed. */
  overdue: boolean;
}

/** A trip that was completed, with how its return compared with the plan. */
export interface CompletedTrip {
  requestId: string;
  travelDate: string;
  departureTime: string;
  returnTime: string | null;
  /** When the vehicle really got back (HH:mm); null for trips completed before this was recorded. */
  actualReturnTime: string | null;
  /** Positive = late, negative = early, null = not recorded. */
  minutesLate: number | null;
  destination: string;
  requesterName: string;
  vehicleName: string | null;
  vehicleAssetNumber: string | null;
  driverName: string | null;
  selfDriven: boolean;
  completedAt: string | null;
}

/**
 * Approved trips that are booked or running, with their live state. Vehicle and
 * driver statuses are derived from these on every read: they flip to "on route"
 * when the trip is started and stay that way until the trip is completed, cancelled
 * or rescheduled, so an overdue trip keeps its vehicle and driver occupied.
 */
@Injectable()
export class TripScheduleService {
  private readonly logger = new Logger(TripScheduleService.name);
  private readonly timeZone = this.resolveTimeZone();

  constructor(private readonly prisma: PrismaService) {}

  now() {
    return wallClockNow(this.timeZone);
  }

  /** Unresolved approved trips (booked, on route, overdue), soonest first. Optionally limited to some vehicles/drivers. */
  async activeTrips(
    tenantId: string,
    only: { vehicleAssetIds?: string[]; driverEmployeeIds?: string[] } = {},
  ): Promise<ScheduledTrip[]> {
    const now = this.now();
    const limited =
      only.vehicleAssetIds !== undefined ||
      only.driverEmployeeIds !== undefined;
    // Limited to the given vehicles/drivers, or any trip that has a vehicle or a driver.
    const owners = limited
      ? [
          ...(only.vehicleAssetIds?.length
            ? [{ vehicleAssetId: { in: only.vehicleAssetIds } }]
            : []),
          ...(only.driverEmployeeIds?.length
            ? [{ driverEmployeeId: { in: only.driverEmployeeIds } }]
            : []),
        ]
      : [
          { vehicleAssetId: { not: null } },
          { driverEmployeeId: { not: null } },
          { selfDriven: true },
        ];
    if (owners.length === 0) return [];

    const rows = await this.prisma.marketingTransportRequest.findMany({
      where: {
        tenantId,
        status: MarketingTransportRequestStatus.APPROVED,
        OR: owners,
      },
      orderBy: [{ travelDate: 'asc' }, { departureTime: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => {
      const window = {
        travelDate: row.travelDate.toISOString().slice(0, 10),
        departureTime: row.departureTime,
        returnTime: row.returnTime,
        started: row.startedAt !== null,
      };
      return {
        requestId: row.id,
        travelDate: window.travelDate,
        departureTime: window.departureTime,
        returnTime: window.returnTime,
        destination: row.destination,
        requesterName: row.requesterName,
        vehicle: row.vehicleAssetId
          ? {
              assetId: row.vehicleAssetId,
              name: row.vehicleName,
              assetNumber: row.vehicleAssetNumber,
            }
          : null,
        driver:
          row.driverEmployeeId || row.driverName
            ? { employeeId: row.driverEmployeeId, name: row.driverName }
            : null,
        selfDriven: row.selfDriven,
        state: tripState(window),
        // Only a trip that is out can be overdue; an unstarted one is simply not started.
        overdue: window.started && isOverdue(now, window),
      };
    });
  }

  /**
   * Trips a vehicle or driver has actually been on: completed requests, most recent
   * first. Cancelled and rejected requests never happened, so they aren't included.
   */
  async completedTrips(
    tenantId: string,
    owner: { vehicleAssetId: string } | { driverEmployeeId: string },
    page = 1,
    limit = 10,
  ) {
    const where: Prisma.MarketingTransportRequestWhereInput = {
      tenantId,
      status: MarketingTransportRequestStatus.COMPLETED,
      ...owner,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.marketingTransportRequest.count({ where }),
      this.prisma.marketingTransportRequest.findMany({
        where,
        orderBy: [
          { travelDate: 'desc' },
          { departureTime: 'desc' },
          { id: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data: CompletedTrip[] = rows.map((row) => ({
      requestId: row.id,
      travelDate: row.travelDate.toISOString().slice(0, 10),
      departureTime: row.departureTime,
      returnTime: row.returnTime,
      actualReturnTime: row.actualReturnTime,
      minutesLate:
        row.actualReturnTime && row.returnTime
          ? minutesBetween(row.returnTime, row.actualReturnTime)
          : null,
      destination: row.destination,
      requesterName: row.requesterName,
      vehicleName: row.vehicleName,
      vehicleAssetNumber: row.vehicleAssetNumber,
      driverName: row.driverName,
      selfDriven: row.selfDriven,
      completedAt: row.completedAt?.toISOString() ?? null,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private resolveTimeZone() {
    const configured = process.env.TRANSPORT_TIMEZONE?.trim();
    if (!configured) return DEFAULT_TRANSPORT_TIMEZONE;
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: configured });
      return configured;
    } catch {
      this.logger.warn(
        `Invalid TRANSPORT_TIMEZONE "${configured}", using ${DEFAULT_TRANSPORT_TIMEZONE}`,
      );
      return DEFAULT_TRANSPORT_TIMEZONE;
    }
  }
}

export const tripsForVehicle = (trips: ScheduledTrip[], assetId: string) =>
  trips.filter((trip) => trip.vehicle?.assetId === assetId);

export const tripsForDriver = (trips: ScheduledTrip[], employeeId: string) =>
  trips.filter((trip) => trip.driver?.employeeId === employeeId);
