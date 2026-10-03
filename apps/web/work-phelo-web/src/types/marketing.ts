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
  companyName: string;
  businessTypeId?: string;
  sourceTypeId?: string;
  isBillable: boolean;
  primaryContact: CreateProspectContactPayload;
  /** Products/services the client is linked to — they start as PENDING. */
  productIds: string[];
  location: CreateProspectLocationPayload;
}

export interface ConvertProspectPayload {
  isBillable: boolean;
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
  /** Not supplied until the sales module exists. */
  achievedRevenue?: string | null;
  createdAt: string;
}

export interface ClientDetail {
  id: string;
  companyName: string;
  businessType: ProspectReference | null;
  sourceType: ProspectReference | null;
  assignedUserId: string;
  isBillable: boolean;
  location: ProspectDetailLocation;
  contacts: ProspectDetailContact[];
  products: ClientDetailProduct[];
  /** Total across the client's products. Not supplied until the sales module exists. */
  achievedRevenue?: string | null;
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

export type FleetStatus = 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'RETIRED';

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

export type TransportRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface TransportRequestPerson {
  employeeId: string;
  name: string;
  department: string | null;
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
  passengers: TransportRequestPerson[];
  review: { byName: string | null; at: string; note: string | null } | null;
  /** Set once approved: who is driving what. */
  allocation: {
    vehicle: { assetId: string; name: string | null; assetNumber: string | null };
    driver: { employeeId: string; name: string | null };
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
    unavailableReason: string | null;
  }[];
  drivers: {
    employeeId: string;
    name: string;
    department: string | null;
    available: boolean;
    unavailableReason: string | null;
  }[];
}

export interface ApproveTransportRequestPayload {
  vehicleAssetId: string;
  driverEmployeeId: string;
  note?: string;
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
  deactivatedAt: string | null;
  createdAt: string;
}

export interface TransportOfficersQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE';
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
