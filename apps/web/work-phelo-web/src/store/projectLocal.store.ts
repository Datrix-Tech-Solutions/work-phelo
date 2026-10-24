import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BLANK_PROJECT_CONFIG } from '@/lib/defaultProjectTemplates';
import { ProjectConfig, ProjectFeature, ProjectPricing, ProjectType } from '@/types/hr';

interface ProjectLocalDetails {
  /** Missing for a project that was made before types existed. */
  projectType?: ProjectType;
  /** Name of the template it started from; null for a blank slate. */
  templateName: string | null;
  /** For a client project: whether the work is billed, and the marketing client it is for (optional). */
  billable?: boolean;
  /** How a billable project is charged, and the price that goes with it. */
  pricing?: ProjectPricing;
  /** What the client's page needs to list the project, kept here so it doesn't depend on HR access. */
  summary?: { name: string; startDate: string; endDate?: string; createdAt: string };
  client?: { id: string; name: string };
  /** The project's own workflow, work types, features and priority levels. A copy, so editing it
   *  never changes the template, and later template edits don't change the project. */
  config: ProjectConfig;
}

interface ProjectLocalStore {
  byProjectId: Record<string, ProjectLocalDetails>;
  /** Board stage of each task, by task id, for projects whose workflow isn't the four fixed statuses. */
  stageByTaskId: Record<string, string>;
  setProjectDetails: (projectId: string, details: ProjectLocalDetails) => void;
  setTaskStage: (taskId: string, stage: string) => void;
  /** Turns a feature (a tab) on for one project, leaving its template alone. */
  addFeature: (projectId: string, feature: ProjectFeature) => void;
}

// Details the backend can't hold yet, kept in local storage until the project backend is rebuilt.
export const useProjectLocalStore = create<ProjectLocalStore>()(
  persist(
    (set) => ({
      byProjectId: {},
      stageByTaskId: {},
      setProjectDetails: (projectId, details) =>
        set((s) => ({ byProjectId: { ...s.byProjectId, [projectId]: details } })),
      addFeature: (projectId, feature) =>
        set((s) => {
          // A project made before templates has no setup yet: start it from the four statuses it
          // already had, with the Tasks and Board tabs it was showing.
          const current: ProjectLocalDetails = s.byProjectId[projectId] ?? {
            templateName: null,
            config: {
              ...BLANK_PROJECT_CONFIG,
              workflow: ['To Do', 'In Progress', 'On Hold', 'Done'],
              features: ['LIST', 'BOARD'],
            },
          };
          if (current.config.features.includes(feature)) return s;
          return {
            byProjectId: {
              ...s.byProjectId,
              [projectId]: {
                ...current,
                config: { ...current.config, features: [...current.config.features, feature] },
              },
            },
          };
        }),
      setTaskStage: (taskId, stage) =>
        set((s) => ({ stageByTaskId: { ...s.stageByTaskId, [taskId]: stage } })),
    }),
    {
      name: 'project-local-store-v2',
      version: 1,
      // v0 projects could have a Sprints tab among their features, which is gone.
      migrate: (persisted) => {
        const state = persisted as {
          byProjectId?: Record<
            string,
            { config?: { features?: string[] } } & Record<string, unknown>
          >;
        } & Record<string, unknown>;
        return {
          ...state,
          byProjectId: Object.fromEntries(
            Object.entries(state.byProjectId ?? {}).map(([id, d]) => [
              id,
              d.config?.features
                ? {
                    ...d,
                    config: {
                      ...d.config,
                      features: d.config.features.filter((f) => f !== 'SPRINTS'),
                    },
                  }
                : d,
            ]),
          ),
        };
      },
    },
  ),
);
