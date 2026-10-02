import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CompleteProspectFollowUpPayload,
  CreateProspectFollowUpPayload,
  FollowUpWorklistResponse,
  ProspectFollowUp,
  ProspectFollowUpHistoryResponse,
  UpdateProspectFollowUpPayload,
} from '@/types/marketing';

const FOLLOW_UPS_ENDPOINT = '/marketing/follow-ups';
const PROSPECTS_ENDPOINT = '/marketing/prospects';
const FOLLOW_UPS_KEY = ['marketing', 'follow-ups'] as const;

export function useFollowUpWorklist() {
  return useQuery({
    queryKey: [...FOLLOW_UPS_KEY, 'worklist'] as const,
    queryFn: async () => {
      const res = await api.get<FollowUpWorklistResponse>(FOLLOW_UPS_ENDPOINT);
      return res.data.items;
    },
    // Urgency is worked out by the API at request time, so re-check so newly due items appear.
    refetchInterval: 60_000,
  });
}

/** Every follow-up (pending, completed, cancelled) ever scheduled for one prospect. */
export function useProspectFollowUps(prospectId: string) {
  return useQuery({
    queryKey: [...FOLLOW_UPS_KEY, 'prospect', prospectId] as const,
    queryFn: async () => {
      const res = await api.get<ProspectFollowUpHistoryResponse>(
        `${PROSPECTS_ENDPOINT}/${prospectId}/follow-ups`,
      );
      return res.data.items;
    },
    enabled: !!prospectId,
  });
}

/** Follow-ups whose due time has passed. Shares the worklist query, so it costs no extra request. */
export function useDueFollowUps() {
  const { data = [], ...rest } = useFollowUpWorklist();
  return { data: data.filter((item) => item.urgency === 'OVERDUE'), ...rest };
}

export function useCreateFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      prospectId,
      payload,
    }: {
      prospectId: string;
      payload: CreateProspectFollowUpPayload;
    }) => {
      const res = await api.post<ProspectFollowUp>(
        `${PROSPECTS_ENDPOINT}/${prospectId}/follow-ups`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOLLOW_UPS_KEY }),
  });
}

export function useUpdateFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateProspectFollowUpPayload }) => {
      const res = await api.patch<ProspectFollowUp>(`${FOLLOW_UPS_ENDPOINT}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOLLOW_UPS_KEY }),
  });
}

export function useCancelFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<ProspectFollowUp>(`${FOLLOW_UPS_ENDPOINT}/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOLLOW_UPS_KEY }),
  });
}

/** Completes a pending follow-up by recording the interaction that fulfils it. */
export function useCompleteFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: CompleteProspectFollowUpPayload;
    }) => {
      const res = await api.post(`${FOLLOW_UPS_ENDPOINT}/${id}/complete`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLLOW_UPS_KEY });
      // The interaction is recorded on the prospect too.
      queryClient.invalidateQueries({ queryKey: ['marketing', 'prospects'] });
    },
  });
}
