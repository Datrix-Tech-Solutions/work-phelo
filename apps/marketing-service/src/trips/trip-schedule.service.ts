import { Injectable, Logger } from '@nestjs/common';
import { MarketingTransportRequestStatus } from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_TRANSPORT_TIMEZONE,
  TripState,
  tripState,
  wallClockNow,
} from './trip-schedule';

export interface ScheduledTrip {
  requestId: string;
  travelDate: string;
  departureTime: string;
  returnTime: string;
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
}

/**
 * Approved trips that are booked or running, with their live state. Vehicle and
 * driver statuses are derived from these on every read, so they flip to "on
 * route" at the departure time and back when the trip ends without any job.
 */
@Injectable()
export class TripScheduleService {
  private readonly logger = new Logger(TripScheduleService.name);
  private readonly timeZone = this.resolveTimeZone();

  constructor(private readonly prisma: PrismaService) {}

  now() {
    return wallClockNow(this.timeZone);
  }

  /** Booked and on-route trips, soonest first. Optionally limited to some vehicles/drivers. */
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
        travelDate: { gte: new Date(`${now.date}T00:00:00.000Z`) },
        OR: owners,
      },
      orderBy: [{ travelDate: 'asc' }, { departureTime: 'asc' }, { id: 'asc' }],
    });

    return rows.flatMap((row) => {
      const travelDate = row.travelDate.toISOString().slice(0, 10);
      const state = tripState(now, {
        travelDate,
        departureTime: row.departureTime,
        returnTime: row.returnTime,
      });
      if (state === 'ENDED') return [];
      return [
        {
          requestId: row.id,
          travelDate,
          departureTime: row.departureTime,
          returnTime: row.returnTime,
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
          state,
        },
      ];
    });
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
