import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Reinsurer, CreateReinsurerPayload, UpdateReinsurerPayload } from '@/types/reinsurance';

const REINSURERS_KEY = ['reinsurance', 'reinsurers'] as const;

export function useReinsurers() {
  return useQuery({
    queryKey: REINSURERS_KEY,
    queryFn: async () => {
      const res = await api.get<Reinsurer[]>('/operations/reinsurance/reinsurers');
      return Array.isArray(res.data) ? res.data : ((res.data as { data: Reinsurer[] })?.data ?? []);
    },
  });
}

export function useCreateReinsurer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateReinsurerPayload) => {
      const res = await api.post<Reinsurer>('/operations/reinsurance/reinsurers', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REINSURERS_KEY });
    },
  });
}

export function useUpdateReinsurer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateReinsurerPayload & { id: string }) => {
      const res = await api.patch<Reinsurer>(`/operations/reinsurance/reinsurers/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REINSURERS_KEY });
    },
  });
}

export function useDeleteReinsurer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/operations/reinsurance/reinsurers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REINSURERS_KEY });
    },
  });
}
