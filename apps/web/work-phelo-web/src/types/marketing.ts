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
