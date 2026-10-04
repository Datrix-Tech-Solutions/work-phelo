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
  businessTypeId?: string | null;
  sourceTypeId?: string | null;
  pipelineStageId?: string;
  primaryContact?: {
    name?: string;
    phone?: string;
    email?: string;
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
  companyName: string;
  businessTypeId?: string;
  sourceTypeId?: string;
  isBillable: boolean;
  /** Required when the client is billable: the first transaction sent to Accounting. */
  billing?: ClientBillingInput;
  primaryContact: CreateProspectContactPayload;
  /** Products/services the client is linked to — they start as PENDING. */
  productIds: string[];
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
}

export interface UpdateClientPayload {
  companyName?: string;
  businessTypeId?: string | null;
  sourceTypeId?: string | null;
  isBillable?: boolean;
  primaryContact?: {
    name?: string;
    phone?: string;
    email?: string;
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
  returnTime: string;
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
 * ON_ROUTE is derived: an approved request whose departure time has passed. It stays on
 * route until someone completes, cancels or reschedules it. COMPLETED is a real, final status.
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

export interface TransportRequest {
  id: string;
  status: TransportRequestStatus;
  businessPurpose: string;
  /** YYYY-MM-DD */
  travelDate: string;
  /** 24h HH:mm */
  departureTime: string;
  returnTime: string;
  destination: string;
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

export interface CreateTransportRequestPayload {
  businessPurpose: string;
  travelDate: string;
  departureTime: string;
  returnTime: string;
  destination: string;
  passengerIds?: string[];
  notes?: string;
}

export type UpdateTransportRequestPayload = Partial<CreateTransportRequestPayload>;

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
  returnTime: string;
}

export interface RescheduleTransportRequestPayload
  extends ApproveTransportRequestPayload, TransportRequestWindow {}

export interface CompleteTransportRequestPayload {
  /** HH:mm on the travel date. */
  actualReturnTime: string;
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
  returnTime: string;
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
  returnTime: string;
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
  | 'PENDING_DISPATCH'
  | 'SCHEDULED'
  | 'SENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface Campaign {
  id: string;
  name: string;
  channels: CampaignChannel[];
  businessTypes: { id: string; name: string }[];
  subject: string;
  message: string;
  dispatchMode: CampaignDispatchMode;
  /** YYYY-MM-DD; null for instant campaigns. */
  scheduledDate: string | null;
  status: CampaignStatus;
  recipients: { total: number; pending: number; sent: number; failed: number; skipped: number };
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
  businessTypeIds: string[];
  subject: string;
  message: string;
  dispatchMode: CampaignDispatchMode;
  scheduledDate?: string;
}

export interface CampaignPreviewPayload {
  businessTypeIds: string[];
  channels: CampaignChannel[];
}

export interface CampaignPreview {
  prospectCount: number;
  /** Messages that will be queued. */
  reachable: number;
  /** Contacts with no phone/email for a chosen channel, or a repeated address. */
  skipped: number;
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
