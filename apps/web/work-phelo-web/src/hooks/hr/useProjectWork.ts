import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import type { ProjectObjective, ProjectSprint, ProjectSubtask } from '@/types/hr';

const KEY = 'projects';

// ── Objectives ──────────────────────────────────────────────────────────

export function useProjectObjectives(projectId: string) {
  return useQuery({
    queryKey: [KEY, projectId, 'objectives'],
    queryFn: async () => {
      const res = await api.get<ProjectObjective[]>(`/hr/projects/${projectId}/objectives`);
      return res.data;
    },
    enabled: !!projectId,
  });
}

export function useAddObjective(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: { name: string; description?: string }) => {
      const res = await api.post<ProjectObjective>(`/hr/projects/${projectId}/objectives`, dto);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'objectives'] }),
  });
}

export function useUpdateObjective(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: string;
      dto: { name: string; description?: string };
    }) => {
      const res = await api.patch<ProjectObjective>(
        `/hr/projects/${projectId}/objectives/${id}`,
        dto,
      );
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'objectives'] }),
  });
}

/** Deletes the objective; its tasks stay in the project, no longer under it. */
export function useRemoveObjective(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/projects/${projectId}/objectives/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'objectives'] });
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'tasks'] });
    },
  });
}

// ── Subtasks ────────────────────────────────────────────────────────────

export function useProjectSubtasks(projectId: string) {
  return useQuery({
    queryKey: [KEY, projectId, 'subtasks'],
    queryFn: async () => {
      const res = await api.get<ProjectSubtask[]>(`/hr/projects/${projectId}/subtasks`);
      return res.data;
    },
    enabled: !!projectId,
  });
}

export function useAddSubtask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: { taskId: string; name: string }) => {
      const res = await api.post<ProjectSubtask>(`/hr/projects/${projectId}/subtasks`, dto);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'subtasks'] }),
  });
}

export function useUpdateSubtask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<ProjectSubtask, 'name' | 'done'>>;
    }) => {
      const res = await api.patch<ProjectSubtask>(
        `/hr/projects/${projectId}/subtasks/${id}`,
        patch,
      );
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'subtasks'] }),
  });
}

export function useRemoveSubtask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/projects/${projectId}/subtasks/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'subtasks'] }),
  });
}

// ── Sprints ─────────────────────────────────────────────────────────────

export type SprintInput = Pick<ProjectSprint, 'name' | 'startDate' | 'endDate' | 'taskIds'>;

export function useProjectSprints(projectId: string) {
  return useQuery({
    queryKey: [KEY, projectId, 'sprints'],
    queryFn: async () => {
      const res = await api.get<ProjectSprint[]>(`/hr/projects/${projectId}/sprints`);
      return res.data;
    },
    enabled: !!projectId,
  });
}

/** A sprint holds tasks, so every change to one also refreshes the tasks. */
function useRefreshSprints(projectId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'sprints'] });
    queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'tasks'] });
  };
}

export function useAddSprint(projectId: string) {
  const refresh = useRefreshSprints(projectId);
  return useMutation({
    mutationFn: async (dto: SprintInput) => {
      const res = await api.post<ProjectSprint>(`/hr/projects/${projectId}/sprints`, dto);
      return res.data;
    },
    onSuccess: refresh,
  });
}

export function useUpdateSprint(projectId: string) {
  const refresh = useRefreshSprints(projectId);
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: SprintInput }) => {
      const res = await api.put<ProjectSprint>(`/hr/projects/${projectId}/sprints/${id}`, dto);
      return res.data;
    },
    onSuccess: refresh,
  });
}

export function useRemoveSprint(projectId: string) {
  const refresh = useRefreshSprints(projectId);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/projects/${projectId}/sprints/${id}`);
    },
    onSuccess: refresh,
  });
}

/** Completes the sprint. Only `keepTaskIds` stay in it; the rest go back to the backlog. */
export function useCompleteSprint(projectId: string) {
  const refresh = useRefreshSprints(projectId);
  return useMutation({
    mutationFn: async ({ id, keepTaskIds }: { id: string; keepTaskIds: string[] }) => {
      const res = await api.post<ProjectSprint>(
        `/hr/projects/${projectId}/sprints/${id}/complete`,
        { keepTaskIds },
      );
      return res.data;
    },
    onSuccess: refresh,
  });
}

/** Wraps a save so a failure shows as a toast instead of going unseen. */
export function useSaveWithToast() {
  const toast = useToastStore((s) => s.addToast);
  return async <T>(save: Promise<T>): Promise<T | undefined> => {
    try {
      return await save;
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
      return undefined;
    }
  };
}
