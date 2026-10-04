import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreateProspectInteractionPayload,
  CreateProspectPayload,
  ProspectDetail,
  ProspectListResponse,
  ProspectResponse,
  ProspectsQuery,
  UpdateProspectPayload,
} from '@/types/marketing';

const ENDPOINT = '/marketing/prospects';
const PROSPECTS_KEY = ['marketing', 'prospects'] as const;

export function useProspects(query: ProspectsQuery = {}, enabled = true) {
  return useQuery({
    enabled,
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

export function useProspect(id: string) {
  return useQuery({
    queryKey: [...PROSPECTS_KEY, 'detail', id] as const,
    queryFn: async () => {
      const res = await api.get<ProspectDetail>(`${ENDPOINT}/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useUpdateProspect(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateProspectPayload) => {
      const res = await api.patch<ProspectDetail>(`${ENDPOINT}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROSPECTS_KEY }),
  });
}

export function useDeleteProspect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${ENDPOINT}/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROSPECTS_KEY }),
  });
}

export function useAddProspectInteraction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateProspectInteractionPayload) => {
      const res = await api.post(`${ENDPOINT}/${id}/interactions`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROSPECTS_KEY });
      // A new interaction moves the automatic follow-up date.
      queryClient.invalidateQueries({ queryKey: ['marketing', 'follow-ups'] });
    },
  });
}
