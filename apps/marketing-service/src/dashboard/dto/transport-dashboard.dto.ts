/** Approved-and-not-yet-resolved trips and requests, as the transport dashboard shows them. */

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
