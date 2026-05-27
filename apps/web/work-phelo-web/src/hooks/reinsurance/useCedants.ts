import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Cedant, CreateCedantPayload, UpdateCedantPayload } from '@/types/reinsurance';

const CEDANTS_KEY = ['reinsurance', 'cedants'] as const;

export function useCedants() {
  return useQuery({
    queryKey: CEDANTS_KEY,
    queryFn: async () => {
      const res = await api.get<Cedant[]>('/operations/reinsurance/cedants');
      return Array.isArray(res.data) ? res.data : ((res.data as { data: Cedant[] })?.data ?? []);
    },
  });
}

export function useCreateCedant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCedantPayload) => {
      const res = await api.post<Cedant>('/operations/reinsurance/cedants', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CEDANTS_KEY });
    },
  });
}

export function useUpdateCedant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCedantPayload & { id: string }) => {
      const res = await api.patch<Cedant>(`/operations/reinsurance/cedants/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CEDANTS_KEY });
    },
  });
}

export function useDeleteCedant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/operations/reinsurance/cedants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CEDANTS_KEY });
    },
  });
}
