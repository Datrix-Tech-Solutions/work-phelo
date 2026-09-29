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

export interface CreateProspectInitialInteractionPayload {
  interactionMediumId?: string;
  decisionMakerTypeId?: string;
  decisionMakerName?: string;
  occurredAt: string;
  notes?: string;
}

export type CreateProspectInteractionPayload = CreateProspectInitialInteractionPayload;

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

export interface ProspectDetailInteraction {
  id: string;
  occurredAt: string;
  interactionMedium: ProspectReference | null;
  decisionMaker: ProspectReference | null;
  decisionMakerName: string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface ProspectDetail {
  id: string;
  companyName: string;
  businessType: ProspectReference | null;
  sourceType: ProspectReference | null;
  assignedUserId: string;
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
