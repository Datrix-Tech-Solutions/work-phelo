import { ProjectType } from '@/types/hr';

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
