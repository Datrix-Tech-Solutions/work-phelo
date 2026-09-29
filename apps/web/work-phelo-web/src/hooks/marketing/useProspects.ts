import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreateProspectPayload,
  ProspectListResponse,
  ProspectResponse,
  ProspectsQuery,
} from '@/types/marketing';

const ENDPOINT = '/marketing/prospects';
const PROSPECTS_KEY = ['marketing', 'prospects'] as const;

export function useProspects(query: ProspectsQuery = {}) {
  return useQuery({
    queryKey: [...PROSPECTS_KEY, query] as const,
    queryFn: async () => {
      const res = await api.get<ProspectListResponse>(ENDPOINT, { params: query });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useCreateProspect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateProspectPayload) => {
      const res = await api.post<ProspectResponse>(ENDPOINT, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROSPECTS_KEY }),
  });
}
