import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ClientListItem,
  ClientListResponse,
  ClientsQuery,
  ConvertedClient,
  ConvertProspectPayload,
  CreateClientPayload,
} from '@/types/marketing';

const ENDPOINT = '/marketing/clients';
const CLIENTS_KEY = ['marketing', 'clients'] as const;

export function useClients(query: ClientsQuery = {}) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, query] as const,
    queryFn: async () => {
      const res = await api.get<ClientListResponse>(ENDPOINT, { params: query });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateClientPayload) => {
      const res = await api.post<ClientListItem>(ENDPOINT, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

export function useConvertProspectToClient(prospectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ConvertProspectPayload) => {
      const res = await api.post<ConvertedClient>(
        `/marketing/prospects/${prospectId}/convert`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
      // The prospect leaves the active list and its follow-ups move over to the client.
      queryClient.invalidateQueries({ queryKey: ['marketing', 'prospects'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'follow-ups'] });
    },
  });
}
