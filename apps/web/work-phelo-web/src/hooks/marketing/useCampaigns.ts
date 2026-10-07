import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Campaign,
  CampaignEstimate,
  CampaignEstimatePayload,
  CampaignListResponse,
  CampaignPreview,
  CampaignPreviewPayload,
  CampaignRecipientOption,
  CampaignSegment,
  CampaignsQuery,
  CreateCampaignPayload,
  SaveSegmentPayload,
  SegmentRulesPayload,
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

/** Who can be picked when building a segment, within some filters; `ids` looks specific ones up. */
export function useCampaignRecipientOptions(
  filters: { businessTypeIds?: string[]; pipelineStageIds?: string[]; ids?: string[] },
  search: string,
  enabled = true,
) {
  const { businessTypeIds = [], pipelineStageIds = [], ids = [] } = filters;
  return useQuery({
    queryKey: [
      ...CAMPAIGNS_KEY,
      'recipient-options',
      businessTypeIds,
      pipelineStageIds,
      ids,
      search,
    ] as const,
    queryFn: async () => {
      const res = await api.get<CampaignRecipientOption[]>(`${ENDPOINT}/recipient-options`, {
        params: {
          ...(businessTypeIds.length ? { businessTypeIds: businessTypeIds.join(',') } : {}),
          ...(pipelineStageIds.length ? { pipelineStageIds: pipelineStageIds.join(',') } : {}),
          ...(ids.length ? { ids: ids.join(',') } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      });
      return res.data;
    },
    enabled,
    placeholderData: (previous) => previous,
  });
}

const SEGMENTS_KEY = [...CAMPAIGNS_KEY, 'segments'] as const;

/** Saved segments (shared across the tenant) plus a built-in one per business type. */
export function useCampaignSegments(enabled = true) {
  return useQuery({
    queryKey: SEGMENTS_KEY,
    queryFn: async () => {
      const res = await api.get<CampaignSegment[]>(`${ENDPOINT}/segments`);
      return res.data;
    },
    enabled,
  });
}

/** How many prospects some segment rules match; runs only once there is a rule. */
export function useSegmentCount(rules: SegmentRulesPayload) {
  const ready =
    (rules.businessTypeIds?.length ?? 0) > 0 ||
    (rules.pipelineStageIds?.length ?? 0) > 0 ||
    (rules.includeProspectIds?.length ?? 0) > 0;
  return useQuery({
    queryKey: [...SEGMENTS_KEY, 'count', rules] as const,
    queryFn: async () => {
      const res = await api.post<{ prospectCount: number }>(`${ENDPOINT}/segments/count`, rules);
      return res.data.prospectCount;
    },
    enabled: ready,
    staleTime: 0,
  });
}

export function useCreateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SaveSegmentPayload) => {
      const res = await api.post<CampaignSegment>(`${ENDPOINT}/segments`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SEGMENTS_KEY }),
  });
}

export function useUpdateSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: SaveSegmentPayload & { id: string }) => {
      const res = await api.patch<CampaignSegment>(`${ENDPOINT}/segments/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SEGMENTS_KEY }),
  });
}

export function useDeleteSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${ENDPOINT}/segments/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SEGMENTS_KEY }),
  });
}

/** Counts the messages a campaign would queue; runs only once the audience is chosen. */
export function useCampaignPreview(payload: Partial<CampaignPreviewPayload>) {
  const { segmentIds, channels } = payload;
  const ready = (segmentIds?.length ?? 0) > 0 && (channels?.length ?? 0) > 0;
  return useQuery({
    queryKey: [...CAMPAIGNS_KEY, 'preview', segmentIds, channels] as const,
    queryFn: async () => {
      const res = await api.post<CampaignPreview>(`${ENDPOINT}/preview`, {
        segmentIds,
        channels,
      });
      return res.data;
    },
    enabled: ready,
    staleTime: 0,
  });
}

export function useCampaignEstimate(payload: Partial<CampaignEstimatePayload>) {
  const { segmentIds, channels, subject, message, senderIdentityId } = payload;
  const ready =
    (segmentIds?.length ?? 0) > 0 &&
    (channels?.length ?? 0) > 0 &&
    Boolean(subject?.trim()) &&
    Boolean(message?.trim());
  return useQuery({
    queryKey: [
      ...CAMPAIGNS_KEY,
      'estimate',
      segmentIds,
      channels,
      subject,
      message,
      senderIdentityId,
    ] as const,
    queryFn: async () => {
      const res = await api.post<CampaignEstimate>(`${ENDPOINT}/estimate`, {
        segmentIds,
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
