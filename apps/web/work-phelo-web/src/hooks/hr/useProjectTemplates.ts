import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DEFAULT_PROJECT_TEMPLATES } from '@/lib/defaultProjectTemplates';
import type { CreateProjectTemplateDto, ProjectTemplate } from '@/types/hr';

const KEY = ['project-templates'];

/** A template row as the backend sends it: the template's set-up is spread into the row. */
type TemplateRow = ProjectTemplate & { defaultKey: string | null };

/** The backend wants the set-up under `config`, beside the starter content. */
function toPayload({ name, description, content, ...config }: CreateProjectTemplateDto) {
  return { name, description, config, content };
}

/**
 * Every template a project can start from: the built-in ones, with any edit the company made to them
 * applied, then the ones the company created.
 */
export function useProjectTemplates() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<TemplateRow[]>('/hr/project-templates');
      return res.data;
    },
  });

  return useMemo(() => {
    const custom = rows.filter((r) => !r.defaultKey);
    const edits = new Map(rows.filter((r) => r.defaultKey).map((r) => [r.defaultKey, r]));
    const defaults = DEFAULT_PROJECT_TEMPLATES.map((t) => {
      const edit = edits.get(t.id);
      return edit
        ? {
            ...t,
            name: edit.name,
            description: edit.description,
            workflow: edit.workflow,
            workTypes: edit.workTypes,
            features: edit.features,
            priorities: edit.priorities,
            content: edit.content,
          }
        : t;
    });
    return {
      templates: [...defaults, ...custom] as ProjectTemplate[],
      /** Only the templates the company created. */
      custom: custom as ProjectTemplate[],
      isLoading,
    };
  }, [rows, isLoading]);
}

export function useAddProjectTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateProjectTemplateDto) =>
      (await api.post<TemplateRow>('/hr/project-templates', toPayload(dto))).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateProjectTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: CreateProjectTemplateDto }) =>
      (await api.patch<TemplateRow>(`/hr/project-templates/${id}`, toPayload(dto))).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveProjectTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/project-templates/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
