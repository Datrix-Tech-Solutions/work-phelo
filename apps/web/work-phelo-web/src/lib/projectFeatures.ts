import { ProjectFeature } from '@/types/hr';

export const PROJECT_FEATURE_LABELS: Record<ProjectFeature, string> = {
  OBJECTIVES: 'Objectives',
  BOARD: 'Board',
  BACKLOG: 'Backlog',
  CALENDAR: 'Calendar',
  LIST: 'List',
};

export const PROJECT_FEATURE_OPTIONS = (
  Object.keys(PROJECT_FEATURE_LABELS) as ProjectFeature[]
).map((value) => ({ value, label: PROJECT_FEATURE_LABELS[value] }));

/** The project detail tab each feature turns on, by route segment under /projects/[id]. */
export const PROJECT_FEATURE_TAB_SEGMENTS: Record<ProjectFeature, string> = {
  OBJECTIVES: 'objectives',
  BOARD: 'board',
  BACKLOG: 'backlog',
  CALENDAR: 'calendar',
  LIST: 'tasks',
};
