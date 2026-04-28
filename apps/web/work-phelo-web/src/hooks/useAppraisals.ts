import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AppraisalCycle,
  AppraisalTemplate,
  CreateAppraisalCycleDto,
  CreateAppraisalTemplateDto,
} from '@/types/hr';

// ── Templates ─────────────────────────────────────────────────────────────────

export function useAppraisalTemplates(params?: { page?: number; search?: string }) {
  return useQuery<AppraisalTemplate[]>({
    queryKey: params ? ['appraisal-templates', params] : ['appraisal-templates'],
    queryFn: async () => {
      const res = await api.get('/hr/appraisals/templates', {
        params: params ? { page: params.page, search: params.search || undefined } : undefined,
      });
      return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
    },
  });
}

export function useCreateAppraisalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<CreateAppraisalTemplateDto>) =>
      api.post('/hr/appraisals/templates', dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-templates'] });
    },
  });
}

export function useUpdateAppraisalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Partial<CreateAppraisalTemplateDto>) =>
      api.put(`/hr/appraisals/templates/${id}`, dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-templates'] });
    },
  });
}

export function useDeleteAppraisalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/hr/appraisals/templates/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-templates'] });
    },
  });
}

// ── Cycles ────────────────────────────────────────────────────────────────────

export function useAppraisalCycles(params?: { page?: number; search?: string }) {
  return useQuery<AppraisalCycle[]>({
    queryKey: params ? ['appraisal-cycles', params] : ['appraisal-cycles'],
    queryFn: async () => {
      const res = await api.get('/hr/appraisals/cycles', {
        params: params ? { page: params.page, search: params.search || undefined } : undefined,
      });
      const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? res.data?.cycles ?? []);
      return list.map((c: Record<string, unknown>) => ({
        ...c,
        name: (c.name as string) ?? (c.title as string) ?? '',
      })) as AppraisalCycle[];
    },
  });
}

export function useCreateAppraisalCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<CreateAppraisalCycleDto>) =>
      api.post('/hr/appraisals/cycles', dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles'] });
    },
  });
}

export function useUpdateAppraisalCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Partial<CreateAppraisalCycleDto>) =>
      api.patch(`/hr/appraisals/cycles/${id}`, dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles'] });
    },
  });
}

export function useDeleteAppraisalCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/hr/appraisals/cycles/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles'] });
    },
  });
}

export function useStartAppraisalCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cycleId: string) =>
      api.post(`/hr/appraisals/cycles/${cycleId}/start`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles'] });
    },
  });
}

export function useCycleAppraisals(cycleId: string) {
  return useQuery({
    queryKey: ['cycle-appraisals', cycleId],
    queryFn: () => api.get(`/hr/appraisals/cycles/${cycleId}/appraisals`).then((r) => r.data),
    enabled: !!cycleId,
  });
}

export function useCycleKpis(cycleId: string) {
  return useQuery({
    queryKey: ['cycle-kpis', cycleId],
    queryFn: () => api.get(`/hr/appraisals/cycles/${cycleId}/kpis`).then((r) => r.data),
    enabled: !!cycleId,
  });
}

export function useSeedCycleFromTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cycleId: string) =>
      api.post(`/hr/appraisals/cycles/${cycleId}/seed-from-template`).then((r) => r.data),
    onSuccess: (_, cycleId) => {
      queryClient.invalidateQueries({ queryKey: ['cycle-kpis', cycleId] });
    },
  });
}

export function useAppraisal(id: string) {
  return useQuery({
    queryKey: ['appraisal', id],
    queryFn: () => api.get(`/hr/appraisals/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

// ── Employee appraisals ───────────────────────────────────────────────────────

export function useMyAppraisals() {
  return useQuery({
    queryKey: ['my-appraisals'],
    queryFn: async () => {
      const res = await api.get('/hr/appraisals/my');
      const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      // Normalise cycle title → name for nested cycle objects
      return list.map((a: Record<string, unknown>) => {
        const cycle = a.cycle as Record<string, unknown> | undefined;
        return {
          ...a,
          cycleName:
            (a.cycleName as string) ?? (cycle?.title as string) ?? (cycle?.name as string) ?? '',
          cycleStatus: (a.cycleStatus as string) ?? 'Upcoming',
          overallStatus: (a.overallStatus as string) ?? 'NotStarted',
        };
      });
    },
  });
}

type KpiScoreInput = { kpiId: string; score: number; comment?: string };

export function useSubmitSelfAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      kpiScores,
      comment,
    }: {
      id: string;
      kpiScores: KpiScoreInput[];
      comment?: string;
    }) =>
      api.patch(`/hr/appraisals/${id}/self-assessment`, { kpiScores, comment }).then((r) => r.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['my-appraisals'] });
      queryClient.invalidateQueries({ queryKey: ['appraisal', id] });
    },
  });
}

export function useSubmitManagerReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      kpiScores,
      comment,
    }: {
      id: string;
      kpiScores: KpiScoreInput[];
      comment?: string;
    }) =>
      api.patch(`/hr/appraisals/${id}/manager-review`, { kpiScores, comment }).then((r) => r.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['team-appraisals'] });
      queryClient.invalidateQueries({ queryKey: ['cycle-appraisals'] });
      queryClient.invalidateQueries({ queryKey: ['appraisal', id] });
    },
  });
}
