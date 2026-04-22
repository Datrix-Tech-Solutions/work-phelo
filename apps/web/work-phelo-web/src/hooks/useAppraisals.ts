import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AppraisalCycle, CreateAppraisalCycleDto } from '@/types/hr';

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

export function useSubmitSelfAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, score, comment }: { id: string; score: number; comment?: string }) =>
      api.patch(`/hr/appraisals/${id}/self-assessment`, { score, comment }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-appraisals'] });
    },
  });
}

export function useSubmitManagerReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, score, comment }: { id: string; score: number; comment?: string }) =>
      api.patch(`/hr/appraisals/${id}/manager-review`, { score, comment }).then((r) => r.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['team-appraisals'] });
      queryClient.invalidateQueries({ queryKey: ['cycle-appraisals'] });
      queryClient.invalidateQueries({ queryKey: ['appraisal', id] });
    },
  });
}
