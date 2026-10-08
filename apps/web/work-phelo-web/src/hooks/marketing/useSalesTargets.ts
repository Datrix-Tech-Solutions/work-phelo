import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Assignee, CreateSalesTargetPayload, SalesTarget } from '@/types/marketing';

const ENDPOINT = '/marketing/sales-targets';
const KEY = ['marketing', 'sales-targets'] as const;

/** Targets the caller may see — their own, or everyone's with the view-all permission. */
export function useSalesTargets(query: { userId?: string; date?: string } = {}) {
  return useQuery({
    queryKey: [...KEY, 'list', query] as const,
    queryFn: async () => {
      const res = await api.get<SalesTarget[]>(ENDPOINT, { params: query });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}

/** Marketing users a target can be set for. Only fetched for users who can set targets. */
export function useTargetReps(enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, 'reps'] as const,
    queryFn: async () => {
      const res = await api.get<Assignee[]>(`${ENDPOINT}/reps`);
      return res.data;
    },
    enabled,
    staleTime: 60_000,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: KEY });
}

export function useCreateSalesTarget() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (payload: CreateSalesTargetPayload) => {
      const res = await api.post<SalesTarget>(ENDPOINT, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateSalesTarget() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const res = await api.patch<SalesTarget>(`${ENDPOINT}/${id}`, { amount });
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSalesTarget() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${ENDPOINT}/${id}`);
    },
    onSuccess: invalidate,
  });
}
