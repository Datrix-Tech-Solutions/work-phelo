export interface PipelineStage {
  id: string;
  name: string;
  probability: number;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStagesResponse {
  items: PipelineStage[];
}

export interface CreatePipelineStagePayload {
  name: string;
  probability: number;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export type UpdatePipelineStagePayload = Partial<CreatePipelineStagePayload>;

export type ProspectingSettingSlug =
  | 'business-types'
  | 'products'
  | 'source-types'
  | 'interaction-media'
  | 'decision-makers';

export interface ProspectingSetting {
  id: string;
  category: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectingSettingsResponse {
  items: ProspectingSetting[];
}

export interface CreateProspectingSettingPayload {
  name: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export type UpdateProspectingSettingPayload = Partial<CreateProspectingSettingPayload>;

// ── Prospects ────────────────────────────────────────────────────────────────

export interface ProspectListProduct {
  id: string;
  name: string;
}

export interface ProspectListDecisionMaker {
  id: string;
  name: string;
}

export interface ProspectListPrimaryContact {
  name: string;
  phone: string | null;
  decisionMaker: ProspectListDecisionMaker | null;
}

export interface ProspectSalesStage {
  id: string;
  name: string;
  probability: number;
}

export interface ProspectListItem {
  id: string;
  companyName: string;
  businessType: { id: string; name: string } | null;
  expectedValue: string;
  achievedValue: string;
  products: ProspectListProduct[];
  primaryContact: ProspectListPrimaryContact | null;
  salesStage: ProspectSalesStage;
  progress: number;
  lastInteractionDate: string | null;
  expectedCloseDate: string | null;
  assignedUserId: string;
  assignedUserName: string | null;
  createdAt: string;
}

export interface ProspectListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProspectListResponse {
  data: ProspectListItem[];
  meta: ProspectListMeta;
}

export interface ProspectsQuery {
  page?: number;
  limit?: number;
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  assignedUserId?: string;
  pipelineStageId?: string;
}

export interface CreateProspectContactPayload {
  name: string;
  phone?: string;
  email?: string;
  decisionMakerTypeId?: string;
}

export interface CreateProspectProductPayload {
  productId: string;
  expectedValue: number;
  achievedValue?: number;
  commissionRate?: number;
  commissionAmount?: number;
  expectedCloseDate?: string;
}

export interface CreateProspectLocationPayload {
  label: string;
  latitude: number;
  longitude: number;
}

export interface ProspectInteractionParticipantPayload {
  fullName: string;
  phone: string;
  role: string;
}

export interface CreateProspectInitialInteractionPayload {
  interactionMediumId?: string;
  occurredAt: string;
  notes?: string;
  decisionMakerInvolved?: boolean;
  participants?: ProspectInteractionParticipantPayload[];
}

export interface CreateProspectInteractionPayload {
  interactionMediumId: string;
  occurredAt: string;
  notes?: string;
  decisionMakerInvolved: boolean;
  participants?: ProspectInteractionParticipantPayload[];
}

export interface CreateProspectPayload {
  companyName: string;
  /** Defaults to the creator; someone else needs the assign permission. */
  assignedUserId?: string;
  businessTypeId?: string;
  sourceTypeId?: string;
  pipelineStageId: string;
  primaryContact: CreateProspectContactPayload;
  products: CreateProspectProductPayload[];
  location: CreateProspectLocationPayload;
  initialInteraction?: CreateProspectInitialInteractionPayload;
}

export interface ProspectResponse {
  id: string;
  tenantId: string;
  companyName: string;
  businessTypeId: string | null;
  sourceTypeId: string | null;
  pipelineStageId: string;
  assignedUserId: string;
  locationLabel: string;
  latitude: unknown;
  longitude: unknown;
  contacts: unknown[];
  products: unknown[];
  interactions: unknown[];
  createdAt: string;
  updatedAt: string;
}

// ── Prospect details / update ────────────────────────────────────────────────

export interface ProspectReference {
  id: string;
  name: string;
}

export interface ProspectDetailContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  decisionMaker: ProspectReference | null;
}

export interface ProspectDetailProduct {
  id: string;
  product: ProspectReference;
  expectedValue: string;
  achievedValue: string | null;
  commissionRate: string | null;
  commissionAmount: string | null;
  expectedCloseDate: string | null;
}

export interface ProspectDetailLocation {
  label: string;
  latitude: string;
  longitude: string;
}

export interface ProspectDetailSalesStage {
  id: string;
  name: string;
  probability: number;
  displayOrder: number;
}

export interface ProspectInteractionParticipant {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  createdAt: string;
}

export interface ProspectDetailInteraction {
  id: string;
  occurredAt: string;
  interactionMedium: ProspectReference | null;
  notes: string | null;
  decisionMakerInvolved: boolean;
  participants: ProspectInteractionParticipant[];
  createdByUserId: string | null;
  createdAt: string;
}

export interface ProspectDetail {
  id: string;
  companyName: string;
  businessType: ProspectReference | null;
  sourceType: ProspectReference | null;
  assignedUserId: string;
  /** The assigned marketer's name, when it can be found. */
  assignedUserName: string | null;
  /** Set once the prospect has been converted to a client. */
  clientId: string | null;
  location: ProspectDetailLocation;
  salesStage: ProspectDetailSalesStage;
  progress: number;
  contacts: ProspectDetailContact[];
  products: ProspectDetailProduct[];
  totalExpectedValue: string;
  totalAchievedValue: string;
  interactions: ProspectDetailInteraction[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProspectProductPayload {
  /** Existing association id; omit to add a new product/service. */
  id?: string;
  productId?: string;
  expectedValue?: number;
  achievedValue?: number | null;
  commissionRate?: number | null;
  commissionAmount?: number | null;
  expectedCloseDate?: string | null;
}

export interface UpdateProspectPayload {
  companyName?: string;
  /** Needs the assign permission. */
  assignedUserId?: string;
  businessTypeId?: string | null;
  sourceTypeId?: string | null;
  pipelineStageId?: string;
  primaryContact?: {
    name?: string;
    /** `null` removes the phone number. */
    phone?: string | null;
    /** `null` removes the email address. */
    email?: string | null;
    decisionMakerTypeId?: string | null;
  };
  /** The complete desired set — existing rows left out are removed. */
  products?: UpdateProspectProductPayload[];
  location?: Partial<CreateProspectLocationPayload>;
}

export type FollowUpStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type FollowUpSource = 'EXPLICIT' | 'DEFAULT';
export type FollowUpUrgency = 'OVERDUE' | 'UPCOMING' | 'FUTURE';

export interface FollowUpWorklistItem {
  prospectId: string;
  companyName: string;
  assignedUserId: string;
  /** Null for a default (latest interaction + 7 days) follow-up, which can't be edited or cancelled. */
  followUpId: string | null;
  dueAt: string;
  note: string | null;
  followUpSource: FollowUpSource;
  urgency: FollowUpUrgency;
  lastInteractionDate: string | null;
}

export interface FollowUpWorklistResponse {
  items: FollowUpWorklistItem[];
}

export interface ProspectFollowUp {
  id: string;
  prospectId: string;
  dueAt: string;
  note: string | null;
  status: FollowUpStatus;
  createdByUserId: string | null;
  completedByUserId: string | null;
  completedAt: string | null;
  completedInteractionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectFollowUpHistoryResponse {
  items: ProspectFollowUp[];
}

export interface CreateProspectFollowUpPayload {
  dueAt: string;
  note?: string;
}

/** Records the interaction and completes the pending follow-up in one request. */
export interface CompleteProspectFollowUpPayload {
  interaction: CreateProspectInteractionPayload;
  nextFollowUp?: CreateProspectFollowUpPayload;
}

export interface UpdateProspectFollowUpPayload {
  dueAt?: string;
  note?: string;
}

// ── Clients ──────────────────────────────────────────────────────────────────

export type ClientProductStatus = 'PENDING' | 'PURCHASED' | 'UNINTERESTED';

export interface ClientListProduct {
  id: string;
  name: string;
  status: ClientProductStatus;
}

export interface ClientListItem {
  id: string;
  companyName: string;
  businessType: ProspectReference | null;
  locationLabel: string;
  isBillable: boolean;
  /** True once the client has its entity in Accounting (its first transaction was sent). */
  hasAccountingEntity: boolean;
  primaryContact: (ProspectListPrimaryContact & { email: string | null }) | null;
  products: ClientListProduct[];
  /** Total across the client's products. Not supplied until the sales module exists. */
  achievedRevenue?: string | null;
  assignedUserId: string;
  assignedUserName: string | null;
  /** Set when the client was converted from a prospect. */
  convertedFromProspectId: string | null;
  createdAt: string;
}

export interface ClientListResponse {
  data: ClientListItem[];
  meta: ProspectListMeta;
}

export interface ClientsQuery {
  page?: number;
  limit?: number;
  search?: string;
  assignedUserId?: string;
}

export interface CreateClientPayload {
  /** Generated by the caller so a retry reuses the same client (and Accounting entity). */
  id?: string;
  /** Defaults to the creator; someone else needs the assign permission. */
  assignedUserId?: string;
  companyName: string;
  businessTypeId?: string;
  sourceTypeId?: string;
  isBillable: boolean;
  /** Required when the client is billable: the first transaction sent to Accounting. */
  billing?: ClientBillingInput;
  primaryContact: CreateProspectContactPayload;
  /** Products/services the client is linked to, with their terms — they start as PENDING. */
  products: AddClientProductPayload[];
  location: CreateProspectLocationPayload;
}

export interface ConvertProspectPayload {
  /** Generated by the caller so a retry reuses the same client (and Accounting entity). */
  clientId?: string;
  isBillable: boolean;
  billing?: ClientBillingInput;
}

export interface ConvertedClient {
  id: string;
  companyName: string;
  isBillable: boolean;
  convertedFromProspectId: string | null;
}

export interface ClientDetailProduct {
  id: string;
  product: ProspectReference;
  status: ClientProductStatus;
  /** Carried over from the prospect product at conversion; null for products added directly. */
  expectedValue: string | null;
  commissionRate: string | null;
  commissionAmount: string | null;
  createdAt: string;
}

export interface ClientDetail {
  id: string;
  companyName: string;
  businessType: ProspectReference | null;
  sourceType: ProspectReference | null;
  assignedUserId: string;
  /** The assigned marketer's name, when it can be found. */
  assignedUserName: string | null;
  isBillable: boolean;
  hasAccountingEntity: boolean;
  /** The entity type the client's Accounting entity sits under. Fixed after the first transaction. */
  accountingEntityTypeId: string | null;
  location: ProspectDetailLocation;
  contacts: ProspectDetailContact[];
  products: ClientDetailProduct[];
  /** Includes interactions recorded while the client was still a prospect. */
  interactions: ProspectDetailInteraction[];
  convertedFromProspectId: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddClientProductPayload {
  productId: string;
  expectedValue?: number;
  /** Percentage of the expected value. */
  commissionRate?: number;
  /** YYYY-MM-DD. */
  expectedCloseDate?: string;
}

export interface UpdateClientPayload {
  companyName?: string;
  /** Needs the assign permission. */
  assignedUserId?: string;
  businessTypeId?: string | null;
  sourceTypeId?: string | null;
  isBillable?: boolean;
  primaryContact?: {
    name?: string;
    /** `null` removes the phone number. */
    phone?: string | null;
    /** `null` removes the email address. */
    email?: string | null;
    decisionMakerTypeId?: string | null;
  };
  location?: Partial<CreateProspectLocationPayload>;
}

/** BOOKED / ON_ROUTE come from approved trips; MAINTENANCE / RETIRED from HR. */
export type FleetStatus = 'AVAILABLE' | 'BOOKED' | 'ON_ROUTE' | 'MAINTENANCE' | 'RETIRED';

export type TripState = 'BOOKED' | 'ON_ROUTE';

/** A booked or running approved trip, as shown on a vehicle. */
export interface FleetTrip {
  requestId: string;
  state: TripState;
  /** Return time has passed but the trip has not been completed. */
  overdue: boolean;
  /** YYYY-MM-DD */
  travelDate: string;
  departureTime: string;
  /** Null when the trip had no planned return time. */
  returnTime: string | null;
  destination: string;
  requesterName: string;
  driverName: string | null;
  selfDriven: boolean;
}

/** A vehicle: HR asset (identity, branch, driver, status) plus fleet-specific details. */
export interface FleetVehicle {
  /** Alias of assetId so the row works with DataTable. */
  id: string;
  assetId: string;
  assetNumber: string;
  name: string;
  vehicleType: string | null;
  make: string | null;
  model: string | null;
  yearOfRegistration: number | null;
  fuelType: string | null;
  currentMileage: number | null;
  branch: { id: string; name: string | null } | null;
  assignedDriver: { id: string; name: string | null } | null;
  status: FleetStatus;
  /** Raw HR state (e.g. whether maintenance can be cleared); `status` is the derived one. */
  hrStatus: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'RETIRED';
  /** Booked and on-route trips, soonest first (capped; see tripCount). */
  trips: FleetTrip[];
  tripCount: number;
  /** True for vehicles created in HR whose fleet details have not been filled in yet. */
  needsFleetDetails: boolean;
  createdAt: string;
}

export interface FleetQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: FleetStatus;
  branchId?: string;
  vehicleType?: string;
  fuelType?: string;
}

export interface FleetListResponse {
  data: FleetVehicle[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface FleetOptions {
  branches: { id: string; name: string }[];
  drivers: { id: string; name: string }[];
}

export interface FleetDetailsPayload {
  vehicleType: string;
  make: string;
  model: string;
  yearOfRegistration: number;
  fuelType: string;
  /** Optional; null clears it on update. */
  currentMileage?: number | null;
}

export interface CreateFleetVehiclePayload extends FleetDetailsPayload {
  branchId?: string;
  assignedDriverId?: string;
  status?: 'AVAILABLE' | 'MAINTENANCE';
}

export interface UpdateFleetVehiclePayload extends Partial<FleetDetailsPayload> {
  branchId?: string | null;
}

export interface CreateFleetVehicleResult extends FleetVehicle {
  /** Non-fatal follow-up steps that failed after the vehicle was created. */
  warnings: string[];
}

/**
 * ON_ROUTE is derived: an approved request that someone has started. It stays on
 * route until someone completes or cancels it. COMPLETED is a real, final status.
 */
export type TransportRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'ON_ROUTE'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export interface TransportRequestPerson {
  employeeId: string;
  name: string;
  department: string | null;
  /** Present on the selectable employees; saved passengers don't store it. */
  jobTitle?: string | null;
}

export type TransportPurpose = 'PERSONAL' | 'MARKETING' | 'OPERATIONS';

/** A client or prospect a trip goes to, with the location saved when it was chosen. */
export interface TransportStop {
  kind: 'CLIENT' | 'PROSPECT';
  refId: string;
  name: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  /** PLANNED when the request was made; VISITED when added while completing the trip. */
  source: 'PLANNED' | 'VISITED';
}

/** A client or prospect that can be chosen as a destination. */
export interface DestinationOption {
  kind: 'CLIENT' | 'PROSPECT';
  id: string;
  name: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
}

export interface TransportRequest {
  id: string;
  status: TransportRequestStatus;
  purpose: TransportPurpose;
  /** Free-text purpose that requests made before purpose became personal / official still carry. */
  businessPurpose: string | null;
  /** The appointment the trip was requested for, if any. */
  appointmentId: string | null;
  /** YYYY-MM-DD */
  travelDate: string;
  /** 24h HH:mm */
  departureTime: string;
  /** Null when no return time was given; the trip then stays out until it is completed. */
  returnTime: string | null;
  /** The places chosen, joined into one line (or the old typed destination). */
  destination: string;
  stops: TransportStop[];
  /** The trip has been started and its return time has passed (or it had none). */
  completable: boolean;
  /** Approved, not started, and its travel day has come. */
  startable: boolean;
  /** Set once someone starts the trip. minutesLate: positive = left late, negative = early. */
  start: {
    at: string;
    byName: string | null;
    actualDepartureTime: string | null;
    mileage: number | null;
    condition: VehicleCondition | null;
    notes: string | null;
    minutesLate: number | null;
  } | null;
  notes: string | null;
  requester: { userId: string; name: string; department: string | null };
  /** People in the vehicle excluding the driver; the requester counts unless they drive. */
  passengerCount: number;
  /** The requester is the one driving, so they are not a passenger. */
  requesterIsDriver: boolean;
  passengers: TransportRequestPerson[];
  review: { byName: string | null; at: string; note: string | null } | null;
  /** The return time has passed on a trip nobody has completed yet. */
  overdue: boolean;
  /** Set once completed. minutesLate: positive = late, negative = early, null = never recorded. */
  completion: {
    at: string;
    byName: string | null;
    actualReturnTime: string | null;
    endingMileage: number | null;
    endingCondition: VehicleCondition | null;
    notes: string | null;
    /** Kilometres covered (ending minus starting mileage); null when either is missing. */
    distance: number | null;
    minutesLate: number | null;
  } | null;
  /** Set when an approver moved the trip; `previous` is where it was before. */
  reschedule: {
    count: number;
    at: string | null;
    byName: string | null;
    previous: { travelDate: string; departureTime: string | null; returnTime: string | null };
  } | null;
  /** Set once approved: who is driving what. */
  allocation: {
    vehicle: { assetId: string; name: string | null; assetNumber: string | null };
    driver: { employeeId: string | null; name: string | null; selfDriven: boolean };
  } | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransportRequestsQuery {
  page?: number;
  limit?: number;
  search?: string;
  /** Sent comma-separated. */
  status?: TransportRequestStatus[];
}

export interface TransportRequestListResponse {
  data: TransportRequest[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface TransportRequestFormOptions {
  requester: { name: string; department: string | null };
  employees: TransportRequestPerson[];
}

export interface TransportStopRef {
  kind: 'CLIENT' | 'PROSPECT';
  id: string;
}

export interface CreateTransportRequestPayload {
  purpose: TransportPurpose;
  /** An approved appointment the trip is for; its prospect is always a destination. */
  appointmentId?: string;
  travelDate: string;
  departureTime: string;
  returnTime?: string;
  stops?: TransportStopRef[];
  /** Typed destination and purpose, used for personal trips instead of stops. */
  destination?: string;
  passengerIds?: string[];
  notes?: string;
}

export type UpdateTransportRequestPayload = Partial<
  Omit<CreateTransportRequestPayload, 'returnTime'>
> & {
  /** Null clears the return time. */
  returnTime?: string | null;
};

export interface TransportRequestAllocationOptions {
  vehicles: {
    assetId: string;
    name: string;
    assetNumber: string;
    available: boolean;
    unavailableKind: AllocationBlock | null;
    unavailableReason: string | null;
  }[];
  drivers: {
    employeeId: string;
    name: string;
    department: string | null;
    available: boolean;
    unavailableKind: AllocationBlock | null;
    unavailableReason: string | null;
  }[];
}

/** Why a vehicle or driver can't be picked: maintenance, still out on an overdue trip, or booked. */
export type AllocationBlock = 'MAINTENANCE' | 'OVERDUE' | 'BOOKED';

export interface TransportRequestWindow {
  travelDate: string;
  departureTime: string;
  /** Optional: a trip without one stays out until it is completed. */
  returnTime?: string;
}

export interface RescheduleTransportRequestPayload
  extends ApproveTransportRequestPayload, TransportRequestWindow {}

export type VehicleCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR';

/** What the start form is prefilled with. */
export interface TransportRequestStartOptions {
  vehicleName: string | null;
  /** The vehicle's current mileage, when one is recorded. */
  mileage: number | null;
  /** The vehicle's condition as recorded on its asset. */
  condition: VehicleCondition | null;
  /** The business-timezone clock, used to prefill the departure time. */
  now: { date: string; time: string };
}

export interface StartTransportRequestPayload {
  /** HH:mm the vehicle actually left. */
  actualDepartureTime: string;
  startingMileage: number;
  startingCondition: VehicleCondition;
  notes?: string;
}

export interface CompleteTransportRequestPayload {
  /** HH:mm on the travel date. */
  actualReturnTime: string;
  endingMileage?: number;
  endingCondition: VehicleCondition;
  notes?: string;
  /** Further places visited, added to the planned ones. */
  stops?: TransportStopRef[];
}

export interface ApproveTransportRequestPayload {
  vehicleAssetId: string;
  /** Required unless selfDriven is true. */
  driverEmployeeId?: string;
  /** The requester drives, so no driver is assigned. */
  selfDriven?: boolean;
  note?: string;
}

export type OfficerStatus = 'AVAILABLE' | 'BOOKED' | 'ON_ROUTE' | 'INACTIVE' | 'LEFT';

/** A booked or running approved trip, as shown on a driver. */
export interface OfficerTrip {
  requestId: string;
  state: TripState;
  overdue: boolean;
  travelDate: string;
  departureTime: string;
  returnTime: string | null;
  destination: string;
  requesterName: string;
  vehicleName: string | null;
  vehicleAssetNumber: string | null;
  selfDriven: boolean;
}

/** A driver: an HR employee marked as a transport officer. */
export interface TransportOfficer {
  id: string;
  employeeId: string;
  name: string;
  department: string | null;
  jobTitle: string | null;
  email: string | null;
  isActive: boolean;
  /** False once the employee has left HR; they no longer appear in driver dropdowns. */
  employeeActive: boolean;
  /** BOOKED / ON_ROUTE come from approved trips; INACTIVE and LEFT override them. */
  status: OfficerStatus;
  trips: OfficerTrip[];
  tripCount: number;
  deactivatedAt: string | null;
  createdAt: string;
}

export interface TransportOfficersQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: OfficerStatus;
}

export interface TransportOfficerListResponse {
  data: TransportOfficer[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface TransportOfficerCandidate {
  employeeId: string;
  name: string;
  department: string | null;
  jobTitle?: string | null;
}

export interface TransportOfficerToggleResult extends TransportOfficer {
  /** Approved, still-upcoming trips that list this driver (only when deactivating). */
  upcomingTrips: number;
}

/** A trip a vehicle or driver has been on: a completed request. */
export interface CompletedTrip {
  requestId: string;
  /** YYYY-MM-DD */
  travelDate: string;
  departureTime: string;
  returnTime: string | null;
  /** When it really got back (HH:mm); null for trips completed before this was recorded. */
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

export interface TripHistoryResponse {
  data: CompletedTrip[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export type CampaignChannel = 'SMS' | 'EMAIL';
export type CampaignDispatchMode = 'INSTANT' | 'SCHEDULED';
export type CampaignStatus =
  | 'DRAFT'
  | 'PENDING_DISPATCH'
  | 'SCHEDULED'
  | 'QUEUED'
  | 'SENDING'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface Campaign {
  id: string;
  name: string;
  channels: CampaignChannel[];
  /** The segments the campaign was sent to, by the name they had at the time. */
  segments: { id: string; name: string }[];
  businessTypes: { id: string; name: string }[];
  senderIdentityId: string | null;
  senderIdSnapshot: string | null;
  subject: string;
  message: string;
  dispatchMode: CampaignDispatchMode;
  /** YYYY-MM-DD; null for instant campaigns. */
  scheduledDate: string | null;
  estimatedCredits: number | null;
  reservedCredits: number;
  consumedCredits: number;
  status: CampaignStatus;
  recipients: {
    total: number;
    pending: number;
    queued: number;
    sending: number;
    accepted: number;
    delivered: number;
    sent: number;
    failed: number;
    skipped: number;
    cancelled: number;
  };
  dispatchedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface CampaignListResponse {
  data: Campaign[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CampaignsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: CampaignStatus;
}

export interface CreateCampaignPayload {
  name: string;
  channels: CampaignChannel[];
  /** Saved segment ids, or `business-type:<id>` for a built-in business-type segment. */
  segmentIds: string[];
  subject: string;
  message: string;
  dispatchMode: CampaignDispatchMode;
  senderIdentityId?: string;
  scheduledDate?: string;
}

export interface CampaignPreviewPayload {
  segmentIds: string[];
  channels: CampaignChannel[];
}

export type SegmentRecipientType = 'PROSPECT' | 'CLIENT';

/** A saved audience, or a built-in one (everyone with a business type). Shared across the tenant. */
export interface CampaignSegment {
  id: string;
  name: string;
  /** Built-in segments are read-only: one per business type. */
  builtIn: boolean;
  recipientType: SegmentRecipientType;
  businessTypeIds: string[];
  /** People who have any of these products or services. */
  productIds: string[];
  pipelineStageIds: string[];
  /** Prospects always in, whether or not the filters match. */
  includeProspectIds: string[];
  /** Prospects always out, even when the filters match. */
  excludeProspectIds: string[];
  /** Client segments: clients always in, whether or not the filters match. */
  includeClientIds: string[];
  /** Client segments: clients always out, even when the filters match. */
  excludeClientIds: string[];
  /** How many prospects it holds; 0 for a client segment. */
  prospectCount: number;
  /** How many clients it holds; 0 for a prospect segment. */
  clientCount: number;
}

export interface SegmentRulesPayload {
  recipientType?: SegmentRecipientType;
  businessTypeIds?: string[];
  productIds?: string[];
  pipelineStageIds?: string[];
  includeProspectIds?: string[];
  excludeProspectIds?: string[];
  includeClientIds?: string[];
  excludeClientIds?: string[];
}

export interface SaveSegmentPayload extends SegmentRulesPayload {
  name: string;
}

/** A prospect or client that can be chosen as a campaign recipient. */
export interface CampaignRecipientOption {
  id: string;
  companyName: string;
  locationLabel: string;
  /** The primary contact the campaign would message. */
  contactName: string | null;
}

export interface CampaignPreview {
  prospectCount: number;
  clientCount: number;
  /** Messages that will be queued. */
  reachable: number;
  /** Contacts with no phone/email for a chosen channel, or a repeated address. */
  skipped: number;
}

export interface CampaignEstimatePayload extends CampaignPreviewPayload {
  subject: string;
  message: string;
  senderIdentityId?: string;
}

export interface CampaignEstimateWarning {
  code: string;
  message: string;
  count?: number;
}

export interface CampaignEstimate {
  prospectCount: number;
  clientCount: number;
  recipientCount: number;
  smsRecipientCount: number;
  emailRecipientCount: number;
  smsEncoding: 'GSM7' | 'UCS2';
  segmentsPerMessage: number;
  estimatedSmsSegments: number;
  estimatedCredits: number;
  wallet: {
    availableCredits: number;
    reservedCredits: number;
    totalCredits: number;
    sufficientCredits: boolean;
    shortfallCredits: number;
  };
  senderIdentity: {
    id: string;
    senderId: string;
    displayName: string | null;
    isDefault: boolean;
  } | null;
  warnings: CampaignEstimateWarning[];
}

export type SmsSenderIdentityStatus =
  | 'DRAFT'
  | 'PENDING_PROVIDER_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'ARCHIVED';

export type CommunicationOwnershipStatus = 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';
export type CommunicationInternalReviewStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';
export type CommunicationProviderStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'UNKNOWN';

export interface SmsSenderIdentity {
  id: string;
  senderId: string;
  displayName: string | null;
  tenantDomainId: string | null;
  purpose: string | null;
  provider: string | null;
  providerReference: string | null;
  providerReferenceId: string | null;
  status: SmsSenderIdentityStatus;
  ownershipStatus: CommunicationOwnershipStatus;
  internalReviewStatus: CommunicationInternalReviewStatus;
  providerStatus: CommunicationProviderStatus;
  providerSubmittedAt: string | null;
  providerLastSyncedAt: string | null;
  providerStatusReason: string | null;
  isDefault: boolean;
  requestedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SmsSenderIdentityListResponse {
  items: SmsSenderIdentity[];
}

export interface CreateSmsSenderIdentityPayload {
  senderId: string;
  displayName?: string;
  provider?: string;
  providerReference?: string;
}

export interface UpdateSmsSenderIdentityPayload extends Partial<CreateSmsSenderIdentityPayload> {
  id: string;
}

export interface TenantDomainDnsRecord {
  type: 'TXT';
  host: string;
  value: string;
}

export interface TenantDomain {
  id: string;
  domain: string;
  normalizedDomain: string;
  ownershipStatus: CommunicationOwnershipStatus;
  verificationRecord: TenantDomainDnsRecord;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantDomainListResponse {
  items: TenantDomain[];
}

export interface TenantDomainVerificationResponse extends TenantDomain {
  verified: boolean;
  reason?: string;
}

export interface CreateTenantDomainPayload {
  domain: string;
}

export interface SmsWalletBalance {
  availableCredits: number;
  reservedCredits: number;
  totalCredits: number;
}

// ── Client billing (transactions raised in Accounting) ───────────────────────

export type BillingNotReadyReason = 'NOT_CONFIGURED' | 'NOT_SET_UP' | 'UNAVAILABLE';

export interface BillingEntityType {
  id: string;
  name: string;
}

export interface BillingTransactionType {
  id: string;
  name: string;
  /** Entity types this transaction type may be used with. */
  entityTypeIds: string[];
}

export interface BillingOptions {
  /** Whether the user holds the Manage Billing permission. */
  canBill: boolean;
  /** Whether Accounting is set up for billing clients. */
  ready: boolean;
  reason: BillingNotReadyReason | null;
  /** What to show when billing is not available, e.g. "Accounting not set up". */
  message: string | null;
  baseCurrency: string | null;
  entityTypes: BillingEntityType[];
  transactionTypes: BillingTransactionType[];
}

export interface ClientBillingInput {
  entityTypeId: string;
  transactionTypeId: string;
  amount: number;
  description?: string;
  /** Which of the client's products it is for. Stays in marketing — Accounting never receives it. */
  productId?: string;
}

export interface RaiseClientBillingPayload {
  /** Generated once per form, so a retry never creates a second transaction. */
  submissionId: string;
  /** Required for the client's first transaction only. */
  entityTypeId?: string;
  transactionTypeId: string;
  amount: number;
  description?: string;
  productId?: string;
}

/** A payment against an invoice: a request waiting on Accounting, or money it has received. */
export interface BillingInvoicePayment {
  id: string;
  kind: 'PAYMENT_REQUEST' | 'RECEIPT';
  /** PENDING, POSTED (received), REVERSED, REJECTED or CANCELLED. */
  state: string;
  stateLabel: string;
  amount: string;
  currency: string;
  /** YYYY-MM-DD */
  paymentDate: string;
  reference: string | null;
  requestedByName: string | null;
  /** Why it was rejected (or reversed). */
  reason: string | null;
  createdAt: string;
}

export interface RequestClientPaymentPayload {
  /** Generated once per form, so a retry never raises a second request. */
  submissionId: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  reference?: string;
  note?: string;
}

export interface BillingTransaction {
  id: string;
  kind: 'INVOICE' | 'CREDIT_NOTE' | 'RECEIPT' | 'CASHBOOK';
  /** Invoices only: what is still owed, what waiting requests hold, and what can still be asked for. */
  outstandingAmount?: string;
  pendingAmount?: string;
  claimableAmount?: string;
  canRequestPayment?: boolean;
  payments?: BillingInvoicePayment[];
  /** Accounting's machine code: DRAFT, POSTED, REVERSED, REJECTED, … */
  state: string;
  stateLabel: string;
  amount: string;
  currency: string;
  transactionTypeName: string;
  documentNumber: string | null;
  /** Why it was rejected, when it was. */
  reason: string | null;
  receivedAmount: string;
  createdAt: string;
  productId: string | null;
  productName: string | null;
  /** False for transactions an accountant created directly for the client's entity. */
  raisedFromMarketing: boolean;
}

export interface BillingTransactionsResponse {
  items: BillingTransaction[];
  meta: ProspectListMeta;
}

export interface ClientBillingSummary {
  currency: string | null;
  /** What Accounting has received for the client. Null until it has an entity. */
  achievedRevenue: string | null;
  products: { productId: string; achievedRevenue: string }[];
}

export type AppointmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

export interface Appointment {
  id: string;
  prospectId: string | null;
  prospectName: string;
  /** The prospect's current pipeline stage; null if the prospect was removed. */
  salesStage: ProspectSalesStage | null;
  date: string; // ISO: YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string | null; // HH:mm — optional
  /** Who the appointment is for: the requester, or the person booked on behalf of. */
  marketerUserId: string;
  marketerName: string;
  /** Assigned on approval — optional. */
  managerUserId: string | null;
  managerName: string | null;
  comment: string | null;
  status: AppointmentStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AppointmentsQuery {
  /** First day, inclusive (YYYY-MM-DD). */
  from?: string;
  /** Last day, inclusive (YYYY-MM-DD). */
  to?: string;
  status?: AppointmentStatus[];
  limit?: number;
}

export interface AppointmentListResponse {
  data: Appointment[];
}

export interface CreateAppointmentPayload {
  prospectId: string;
  date: string;
  startTime: string;
  endTime?: string;
  /** Only honoured for users who can book on behalf of others; otherwise it is the caller. */
  marketerUserId?: string;
  comment?: string;
}

export interface ApproveAppointmentPayload {
  managerUserId?: string;
  reviewNote?: string;
}

export interface AppointmentPerson {
  id: string;
  name: string;
}

export interface AppointmentFormOptions {
  /** Holds marketing.appointments.all:CREATE — may pick any marketer. */
  canCreateForOthers: boolean;
  canApprove: boolean;
  currentUser: AppointmentPerson;
  /** Whose prospects are listed. */
  marketerUserId: string;
  /** Just the caller unless they can book on behalf of others. */
  marketers: AppointmentPerson[];
  /** Only filled for approvers. */
  managers: AppointmentPerson[];
  /** The chosen marketer's assigned prospects. */
  prospects: AppointmentPerson[];
}

/** A person a prospect or client can be assigned to. */
export interface Assignee {
  userId: string;
  name: string;
  email: string;
}

/** A sales rep's revenue target for a period, with what they have achieved so far. */
export interface SalesTarget {
  id: string;
  userId: string;
  userName: string | null;
  /** Set for a product target; null is the rep's total across everything. */
  productId: string | null;
  productName: string | null;
  /** YYYY-MM-DD, inclusive. */
  startDate: string;
  endDate: string;
  amount: string;
  /** Money Accounting has received in the period; null when Accounting could not be reached. */
  achieved: string | null;
  remaining: string | null;
  percent: number | null;
  currency: string | null;
  canEdit: boolean;
}

export interface CreateSalesTargetPayload {
  userId: string;
  productId?: string;
  startDate: string;
  endDate: string;
  amount: number;
}

export interface MarketingDashboardStage {
  stageId: string;
  name: string;
  probability: number;
  prospects: number;
  expected: string;
  weighted: string;
}

/** Marketing dashboard figures for a period. Money is a 2dp string; null means it could not be read. */
export interface MarketingDashboardSummary {
  /** Currency Accounting reports in, when any client has an Accounting entity. */
  currency: string | null;
  newProspects: { current: number; previous: number };
  conversion: {
    created: number;
    converted: number;
    previousCreated: number;
    previousConverted: number;
  };
  sales: { won: string; previousWon: string; wonDeals: number; expected: string };
  achievedRevenue: { current: string | null; previous: string | null };
  /** A snapshot of open prospects; ignores the period. */
  pipeline: {
    stages: MarketingDashboardStage[];
    prospects: number;
    expected: string;
    weighted: string;
  };
  targets: {
    count: number;
    target: string;
    achieved: string | null;
    remaining: string | null;
    percent: number | null;
  };
  clients: { total: number; new: number; billable: number; nonBillable: number };
}
