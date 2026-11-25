import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn } from 'class-validator';
import { MarketingTransportRequestStatus } from '../../../prisma/generated/client';

/** Approved-and-not-yet-resolved trips and requests, as the transport dashboard shows them. */

export const TRANSPORT_TRIP_LISTS = [
  'REQUESTED',
  'ON_ROUTE',
  'OVERDUE',
  'COMPLETED',
  'CLOSED',
] as const;
export type TransportTripList = (typeof TRANSPORT_TRIP_LISTS)[number];

export class QueryTransportDashboardTripsDto {
  @ApiProperty({
    enum: TRANSPORT_TRIP_LISTS,
    description:
      'Which count to list. REQUESTED is every request raised; CLOSED is cancelled or rejected.',
  })
  @IsIn(TRANSPORT_TRIP_LISTS)
  list!: TransportTripList;

  @ApiProperty({
    example: '2026-10-01',
    description: 'First day, inclusive. Ignored by ON_ROUTE and OVERDUE.',
  })
  @IsDateString({ strict: true })
  fromDate!: string;

  @ApiProperty({
    example: '2026-10-09',
    description: 'Last day, inclusive. Ignored by ON_ROUTE and OVERDUE.',
  })
  @IsDateString({ strict: true })
  toDate!: string;
}

export interface TransportDashboardTrip {
  requestId: string;
  requesterName: string;
  destination: string;
  /** YYYY-MM-DD */
  travelDate: string;
  departureTime: string;
  returnTime: string | null;
  vehicleName: string | null;
  status: MarketingTransportRequestStatus;
}

export interface TransportPendingRequest {
  requestId: string;
  requesterName: string;
  destination: string;
  /** YYYY-MM-DD */
  travelDate: string;
  departureTime: string;
  requestedAt: Date;
}

export interface TransportTodayTrip {
  requestId: string;
  requesterName: string;
  destination: string;
  departureTime: string;
  returnTime: string | null;
  vehicleName: string | null;
  /** The allocated driver; the requester's own name for a self-driven trip. */
  driverName: string | null;
  selfDriven: boolean;
  state: 'BOOKED' | 'ON_ROUTE';
  overdue: boolean;
}

export interface TransportOverdueTrip {
  requestId: string;
  requesterName: string;
  destination: string;
  travelDate: string;
  returnTime: string | null;
  vehicleName: string | null;
}

export interface TransportVehicleDocument {
  assetId: string;
  name: string;
  assetNumber: string;
  alerts: Array<{
    label: string;
    state: 'EXPIRED' | 'EXPIRING_SOON';
    expiresOn: string;
    daysLeft: number;
  }>;
}

export interface TransportMaintenanceVehicle {
  assetId: string;
  name: string;
  assetNumber: string;
}

export interface TransportFleetCounts {
  /** Vehicles in service: everything but retired. */
  total: number;
  available: number;
  booked: number;
  onRoute: number;
  documentsExpired: number;
  maintenance: number;
}

export interface TransportDashboardSummary {
  kpis: {
    /** Waiting for approval right now, whatever the period. */
    pending: number;
    /** Approved trips for today that are not completed. */
    tripsToday: number;
    onRoute: number;
    overdue: number;
    completed: { current: number; previous: number };
    /** Requests cancelled or rejected in the period. */
    closed: { current: number; previous: number };
  };
  /** Awaiting approval, oldest first, capped; `kpis.pending` has the full count. */
  pendingRequests: TransportPendingRequest[];
  /** Today's approved trips that are not completed, earliest first, capped. */
  tripsToday: TransportTodayTrip[];
  attention: {
    overdueTrips: TransportOverdueTrip[];
    vehicleDocuments: TransportVehicleDocument[];
    maintenance: TransportMaintenanceVehicle[];
  };
  /** Null when the fleet could not be read (HR unreachable). */
  fleet: TransportFleetCounts | null;
}

export interface TransportTrendPoint {
  fromDate: string;
  toDate: string;
  requested: number;
  completed: number;
}
