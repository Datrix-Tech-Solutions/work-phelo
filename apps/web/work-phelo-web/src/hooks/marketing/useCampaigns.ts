import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Campaign,
  CampaignEstimate,
  CampaignEstimatePayload,
  CampaignListResponse,
  CampaignPreview,
  CampaignPreviewPayload,
  CampaignsQuery,
  CreateCampaignPayload,
} from '@/types/marketing';

const ENDPOINT = '/marketing/campaigns';
const CAMPAIGNS_KEY = ['marketing', 'campaigns'] as const;

export function useCampaigns(query: CampaignsQuery = {}) {
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, 'list', query] as const,
    queryFn: async () => {
      const res = await api.get<CampaignListResponse>(ENDPOINT, { params: query });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}

/** Counts the messages a campaign would queue; runs only once the audience is chosen. */
export function useCampaignPreview(payload: Partial<CampaignPreviewPayload>) {
  const { businessTypeIds, channels } = payload;
  const ready = (businessTypeIds?.length ?? 0) > 0 && (channels?.length ?? 0) > 0;
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, 'preview', businessTypeIds, channels] as const,
    queryFn: async () => {
      const res = await api.post<CampaignPreview>(`${ENDPOINT}/preview`, {
        businessTypeIds,
        channels,
      });
      return res.data;
    },
    enabled: ready,
    staleTime: 0,
  });
}

export function useCampaignEstimate(payload: Partial<CampaignEstimatePayload>) {
  const { businessTypeIds, channels, subject, message, senderIdentityId } = payload;
  const ready =
    (businessTypeIds?.length ?? 0) > 0 &&
    (channels?.length ?? 0) > 0 &&
    Boolean(subject?.trim()) &&
    Boolean(message?.trim());
  return useQuery({
    queryKey: [
      ...CAMPAIGNS_KEY,
      'estimate',
      businessTypeIds,
      channels,
      subject,
      message,
      senderIdentityId,
    ] as const,
    queryFn: async () => {
      const res = await api.post<CampaignEstimate>(`${ENDPOINT}/estimate`, {
        businessTypeIds,
        channels,
        subject,
        message,
        senderIdentityId,
      });
      return res.data;
    },
    enabled: ready,
    staleTime: 0,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCampaignPayload) => {
      const res = await api.post<Campaign>(ENDPOINT, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}

export function useSendCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Campaign>(`${ENDPOINT}/${id}/send`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}

export function useCancelCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Campaign>(`${ENDPOINT}/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}
