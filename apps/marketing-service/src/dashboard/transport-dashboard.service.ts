import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  MarketingTransportRequestStatus as Status,
  Prisma,
} from '../../prisma/generated/client';
import { FleetService } from '../fleet/fleet.service';
import { PrismaService } from '../prisma/prisma.service';
import { TripScheduleService } from '../trips/trip-schedule.service';
import { Range, toRange } from './range';
import {
  QueryDashboardGrowthDto,
  QueryDashboardSummaryDto,
} from './dto/dashboard-summary.dto';
import {
  QueryTransportDashboardTripsDto,
  TransportDashboardSummary,
  TransportDashboardTrip,
  TransportFleetCounts,
  TransportTrendPoint,
} from './dto/transport-dashboard.dto';

/** How many rows each "needs attention" list carries. */
const ATTENTION_LIMIT = 5;
/** How many rows the pending-approval and today's-trips lists carry. */
const LIST_LIMIT = 8;
/** Larger than any fleet, so the internal listing is never paged. */
const ALL_VEHICLES = 100_000;

const requestedWhere = (
  tenantId: string,
  range: Range,
): Prisma.MarketingTransportRequestWhereInput => ({
  tenantId,
  createdAt: { gte: range.from, lt: range.to },
});

const completedWhere = (
  tenantId: string,
  range: Range,
): Prisma.MarketingTransportRequestWhereInput => ({
  tenantId,
  status: Status.COMPLETED,
  completedAt: { gte: range.from, lt: range.to },
});

/** Cancelled or rejected within the range. */
const closedWhere = (
  tenantId: string,
  range: Range,
): Prisma.MarketingTransportRequestWhereInput => ({
  tenantId,
  OR: [
    {
      status: Status.CANCELLED,
      cancelledAt: { gte: range.from, lt: range.to },
    },
    {
      status: Status.REJECTED,
      reviewedAt: { gte: range.from, lt: range.to },
    },
  ],
});

/** Figures for the Transport dashboard, across the whole company's requests and fleet. */
@Injectable()
export class TransportDashboardService {
  private readonly logger = new Logger(TransportDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trips: TripScheduleService,
    private readonly fleet: FleetService,
  ) {}

  async summary(
    user: RequestUser,
    query: QueryDashboardSummaryDto,
  ): Promise<TransportDashboardSummary> {
    const tenantId = user.tenantId;
    const current = toRange(query.fromDate, query.toDate);
    const previous = toRange(query.prevFromDate, query.prevToDate);
    const completedIn = (range: Range) =>
      this.prisma.marketingTransportRequest.count({
        where: completedWhere(tenantId, range),
      });
    const closedIn = (range: Range) =>
      this.prisma.marketingTransportRequest.count({
        where: closedWhere(tenantId, range),
      });

    const [
      pending,
      pendingRows,
      active,
      completed,
      completedBefore,
      closed,
      closedBefore,
      fleet,
    ] = await Promise.all([
      this.prisma.marketingTransportRequest.count({
        where: { tenantId, status: Status.PENDING },
      }),
      this.prisma.marketingTransportRequest.findMany({
        where: { tenantId, status: Status.PENDING },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: LIST_LIMIT,
        select: {
          id: true,
          requesterName: true,
          destination: true,
          travelDate: true,
          departureTime: true,
          createdAt: true,
        },
      }),
      this.trips.activeTrips(tenantId),
      completedIn(current),
      completedIn(previous),
      closedIn(current),
      closedIn(previous),
      this.readFleet(user),
    ]);

    const today = this.trips.now().date;
    const overdue = active.filter((trip) => trip.overdue);
    const todays = active.filter((trip) => trip.travelDate === today);

    return {
      kpis: {
        pending,
        tripsToday: todays.length,
        onRoute: active.filter((trip) => trip.state === 'ON_ROUTE').length,
        overdue: overdue.length,
        completed: { current: completed, previous: completedBefore },
        closed: { current: closed, previous: closedBefore },
      },
      pendingRequests: pendingRows.map((row) => ({
        requestId: row.id,
        requesterName: row.requesterName,
        destination: row.destination,
        travelDate: row.travelDate.toISOString().slice(0, 10),
        departureTime: row.departureTime,
        requestedAt: row.createdAt,
      })),
      tripsToday: todays.slice(0, LIST_LIMIT).map((trip) => ({
        requestId: trip.requestId,
        requesterName: trip.requesterName,
        destination: trip.destination,
        departureTime: trip.departureTime,
        returnTime: trip.returnTime,
        vehicleName: trip.vehicle?.name ?? null,
        driverName: trip.driver?.name ?? null,
        selfDriven: trip.selfDriven,
        state: trip.state,
        overdue: trip.overdue,
      })),
      attention: {
        overdueTrips: overdue.slice(0, ATTENTION_LIMIT).map((trip) => ({
          requestId: trip.requestId,
          requesterName: trip.requesterName,
          destination: trip.destination,
          travelDate: trip.travelDate,
          returnTime: trip.returnTime,
          vehicleName: trip.vehicle?.name ?? null,
        })),
        vehicleDocuments: fleet.documents,
        maintenance: fleet.maintenance,
      },
      fleet: fleet.counts,
    };
  }

  /** The trips behind one of the headline counts, selected the same way as the count. */
  async tripList(
    user: RequestUser,
    query: QueryTransportDashboardTripsDto,
  ): Promise<{ trips: TransportDashboardTrip[] }> {
    const tenantId = user.tenantId;

    if (query.list === 'ON_ROUTE' || query.list === 'OVERDUE') {
      const active = await this.trips.activeTrips(tenantId);
      const wanted = active.filter((trip) =>
        query.list === 'OVERDUE' ? trip.overdue : trip.state === 'ON_ROUTE',
      );
      return {
        trips: wanted.map((trip) => ({
          requestId: trip.requestId,
          requesterName: trip.requesterName,
          destination: trip.destination,
          travelDate: trip.travelDate,
          departureTime: trip.departureTime,
          returnTime: trip.returnTime,
          vehicleName: trip.vehicle?.name ?? null,
          // A started trip is still an approved request until it is completed.
          status: Status.APPROVED,
        })),
      };
    }

    const range = toRange(query.fromDate, query.toDate);
    const rows = await this.prisma.marketingTransportRequest.findMany({
      where:
        query.list === 'REQUESTED'
          ? requestedWhere(tenantId, range)
          : query.list === 'COMPLETED'
            ? completedWhere(tenantId, range)
            : closedWhere(tenantId, range),
      orderBy: [
        { travelDate: 'desc' },
        { departureTime: 'desc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        requesterName: true,
        destination: true,
        travelDate: true,
        departureTime: true,
        returnTime: true,
        vehicleName: true,
        status: true,
      },
    });

    return {
      trips: rows.map(({ id, travelDate, ...row }) => ({
        ...row,
        requestId: id,
        travelDate: travelDate.toISOString().slice(0, 10),
      })),
    };
  }

  /** Requests raised and trips completed in each range, for charting over consecutive periods. */
  async trend(
    user: RequestUser,
    query: QueryDashboardGrowthDto,
  ): Promise<TransportTrendPoint[]> {
    const ranges = query.ranges.split(',').map((pair) => {
      const [from, to] = pair.split(':');
      if (to < from) {
        throw new BadRequestException(`Range ${pair} ends before it starts`);
      }
      return { from, to };
    });

    return Promise.all(
      ranges.map(async ({ from, to }) => {
        const window = toRange(from, to);
        const [requested, completed] = await Promise.all([
          this.prisma.marketingTransportRequest.count({
            where: requestedWhere(user.tenantId, window),
          }),
          this.prisma.marketingTransportRequest.count({
            where: completedWhere(user.tenantId, window),
          }),
        ]);
        return { fromDate: from, toDate: to, requested, completed };
      }),
    );
  }

  /** Fleet counts and the vehicles needing attention. An unreachable HR leaves them empty. */
  private async readFleet(user: RequestUser): Promise<{
    counts: TransportFleetCounts | null;
    documents: TransportDashboardSummary['attention']['vehicleDocuments'];
    maintenance: TransportDashboardSummary['attention']['maintenance'];
  }> {
    try {
      const { data } = await this.fleet.list(user, { limit: ALL_VEHICLES });
      const inService = data.filter((row) => row.status !== 'RETIRED');
      const count = (status: string) =>
        inService.filter((row) => row.status === status).length;
      const label = (row: (typeof data)[number]) =>
        row.make && row.model ? `${row.make} ${row.model}` : row.name;

      return {
        counts: {
          total: inService.length,
          available: count('AVAILABLE'),
          booked: count('BOOKED'),
          onRoute: count('ON_ROUTE'),
          documentsExpired: count('DOCUMENTS_EXPIRED'),
          maintenance: count('MAINTENANCE'),
        },
        documents: inService
          .filter((row) => row.documentAlerts.length > 0)
          // Most urgent first: the vehicle whose nearest expiry is soonest (or longest gone).
          .sort(
            (a, b) =>
              Math.min(...a.documentAlerts.map((x) => x.daysLeft)) -
              Math.min(...b.documentAlerts.map((x) => x.daysLeft)),
          )
          .slice(0, ATTENTION_LIMIT)
          .map((row) => ({
            assetId: row.assetId,
            name: label(row),
            assetNumber: row.assetNumber,
            alerts: row.documentAlerts.map((alert) => ({
              label: alert.label,
              state: alert.state,
              expiresOn: alert.expiresOn,
              daysLeft: alert.daysLeft,
            })),
          })),
        maintenance: inService
          .filter((row) => row.status === 'MAINTENANCE')
          .slice(0, ATTENTION_LIMIT)
          .map((row) => ({
            assetId: row.assetId,
            name: label(row),
            assetNumber: row.assetNumber,
          })),
      };
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'unexpected error';
      this.logger.warn(
        `Transport dashboard could not read the fleet: ${reason}`,
      );
      return { counts: null, documents: [], maintenance: [] };
    }
  }
}
