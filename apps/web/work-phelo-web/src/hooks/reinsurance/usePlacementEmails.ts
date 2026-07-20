import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  PlacementAttachment,
  PlacementDocument,
  PlacementEmailSendResponse,
  PlacementEmailThreadSummary,
  ReinsuranceMailboxConnection,
  SendPlacementEmailPayload,
} from '@/types/reinsurance';

const REINSURANCE_BASE = '/operations/reinsurance';
const PLACEMENTS_BASE = `${REINSURANCE_BASE}/placements`;

export const reinsuranceMailboxesKey = ['reinsurance', 'email', 'mailboxes'] as const;
export const placementEmailThreadsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'email', 'threads'] as const;
export const placementDocumentsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'documents'] as const;
export const placementAttachmentsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'attachments'] as const;

function extractItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const maybeList = data as { items?: T[]; data?: T[] };
  return maybeList?.items ?? maybeList?.data ?? [];
}

export function useReinsuranceMailboxes(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: reinsuranceMailboxesKey,
    queryFn: async () => {
      const res = await api.get(`${REINSURANCE_BASE}/email/mailboxes`, {
        params: { status: 'ACTIVE' },
      });
      return extractItems<ReinsuranceMailboxConnection>(res.data);
    },
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

export function usePlacementEmailThreads(placementId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: placementEmailThreadsKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${PLACEMENTS_BASE}/${placementId}/email/threads`);
      return extractItems<PlacementEmailThreadSummary>(res.data);
    },
    enabled: !!placementId && (options.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useSendPlacementEmail(placementId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SendPlacementEmailPayload) => {
      const res = await api.post<PlacementEmailSendResponse>(
        `${PLACEMENTS_BASE}/${placementId}/email/threads`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: placementEmailThreadsKey(placementId) });
    },
  });
}

export function usePlacementDocuments(placementId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: placementDocumentsKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${PLACEMENTS_BASE}/${placementId}/documents`);
      return extractItems<PlacementDocument>(res.data);
    },
    enabled: !!placementId && (options.enabled ?? true),
    staleTime: 30_000,
  });
}

export function usePlacementAttachments(placementId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: placementAttachmentsKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${PLACEMENTS_BASE}/${placementId}/attachments`);
      return extractItems<PlacementAttachment>(res.data);
    },
    enabled: !!placementId && (options.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useUploadPlacementAttachment(placementId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, title }: { file: File; title?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);

      const res = await api.post<PlacementAttachment>(
        `${PLACEMENTS_BASE}/${placementId}/attachments`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: placementAttachmentsKey(placementId) });
    },
  });
}
