import { ProjectBillingType, ProjectType } from '@/types/hr';

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  CLIENT: 'Client Project',
  INTERNAL: 'Internal Project',
  RESEARCH: 'Research Project',
  IMPLEMENTATION: 'Implementation Project',
  OPERATIONS: 'Operations Project',
  OTHER: 'Other',
};

export const PROJECT_TYPE_OPTIONS = (Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map(
  (value) => ({ value, label: PROJECT_TYPE_LABELS[value] }),
);

export const BILLING_TYPE_LABELS: Record<ProjectBillingType, string> = {
  FLAT_RATE: 'Flat Rate',
  TIMED: 'Timed',
  MILESTONE: 'Milestone',
  RETAINER: 'Retainer',
};

export const BILLING_TYPE_OPTIONS = (Object.keys(BILLING_TYPE_LABELS) as ProjectBillingType[]).map(
  (value) => ({ value, label: BILLING_TYPE_LABELS[value] }),
);
