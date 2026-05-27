import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Broker, CreateBrokerPayload, UpdateBrokerPayload } from '@/types/reinsurance';

const BROKERS_KEY = ['reinsurance', 'brokers'] as const;

export function useBrokers() {
  return useQuery({
    queryKey: BROKERS_KEY,
    queryFn: async () => {
      const res = await api.get<Broker[]>('/operations/reinsurance/brokers');
      return Array.isArray(res.data) ? res.data : ((res.data as { data: Broker[] })?.data ?? []);
    },
  });
}

export function useCreateBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateBrokerPayload) => {
      const res = await api.post<Broker>('/operations/reinsurance/brokers', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BROKERS_KEY });
    },
  });
}

export function useUpdateBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateBrokerPayload & { id: string }) => {
      const res = await api.patch<Broker>(`/operations/reinsurance/brokers/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BROKERS_KEY });
    },
  });
}

export function useDeleteBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/operations/reinsurance/brokers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BROKERS_KEY });
    },
  });
}
