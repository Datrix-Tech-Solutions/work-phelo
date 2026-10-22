import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PROJECT_TEMPLATES } from '@/lib/defaultProjectTemplates';
import {
  CreateProjectTemplateDto,
  PriorityColor,
  PriorityLevel,
  ProjectTemplate,
  ProjectWorkType,
} from '@/types/hr';

interface ProjectTemplatesStore {
  /** Custom templates only; the built-in ones come from DEFAULT_PROJECT_TEMPLATES. */
  templates: ProjectTemplate[];
  /** Edits to built-in templates, by template id; layered over the defaults when read. */
  defaultOverrides: Record<string, CreateProjectTemplateDto>;
  addTemplate: (dto: CreateProjectTemplateDto) => void;
  /** Edits a custom template, or records an override when `id` is a built-in one. */
  updateTemplate: (id: string, dto: CreateProjectTemplateDto) => void;
  removeTemplate: (id: string) => void;
  /** Drops a built-in template's edits, restoring it to how it shipped. */
  resetDefault: (id: string) => void;
}

/** Colours given to plain-name priorities when migrating older saved templates. */
const LEGACY_PRIORITY_COLORS: Record<string, PriorityColor> = {
  Low: 'GREEN',
  Medium: 'YELLOW',
  High: 'ORANGE',
  Urgent: 'RED',
};

// Local-storage only until the project backend is rebuilt.
export const useProjectTemplatesStore = create<ProjectTemplatesStore>()(
  persist(
    (set) => ({
      templates: [],
      defaultOverrides: {},
      addTemplate: (dto) =>
        set((s) => ({
          templates: [
            ...s.templates,
            {
              ...dto,
              id: crypto.randomUUID(),
              isDefault: false,
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      updateTemplate: (id, dto) =>
        set((s) =>
          DEFAULT_PROJECT_TEMPLATES.some((t) => t.id === id)
            ? { defaultOverrides: { ...s.defaultOverrides, [id]: dto } }
            : { templates: s.templates.map((t) => (t.id === id ? { ...t, ...dto } : t)) },
        ),
      resetDefault: (id) =>
        set((s) => ({
          defaultOverrides: Object.fromEntries(
            Object.entries(s.defaultOverrides).filter(([key]) => key !== id),
          ),
        })),
      removeTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
    }),
    {
      name: 'project-templates-store',
      version: 5,
      // v0 templates had `stages` and no work types or features; v1 work types were plain names;
      // v2 had starter `tasks` instead of `priorities`; v3 priorities were plain names; v4 templates
      // could turn on a Sprints tab, which is gone (sprints are managed in the Backlog).
      migrate: (persisted) => {
        const state = persisted as {
          templates?: Array<Record<string, unknown>>;
          defaultOverrides?: Record<string, Record<string, unknown>>;
        };
        const withoutSprints = (features: unknown) =>
          Array.isArray(features) ? features.filter((f) => f !== 'SPRINTS') : features;
        return {
          defaultOverrides: Object.fromEntries(
            Object.entries(state.defaultOverrides ?? {}).map(([id, o]) => [
              id,
              { ...o, features: withoutSprints(o.features) },
            ]),
          ),
          templates: (state.templates ?? []).map((t) => ({
            ...t,
            features: withoutSprints(t.features ?? ['BOARD']),
            workflow: t.workflow ?? t.stages ?? [],
            priorities: (
              (t.priorities as Array<string | PriorityLevel> | undefined) ?? [
                'Low',
                'Medium',
                'High',
              ]
            ).map((p) =>
              typeof p === 'string' ? { name: p, color: LEGACY_PRIORITY_COLORS[p] ?? 'GRAY' } : p,
            ),
            workTypes: ((t.workTypes as Array<string | ProjectWorkType>) ?? ['Task']).map((w) =>
              typeof w === 'string' ? { name: w, icon: 'TASK' } : w,
            ),
          })),
        };
      },
    },
  ),
);
