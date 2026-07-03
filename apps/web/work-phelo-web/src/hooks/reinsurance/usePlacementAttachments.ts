import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PlacementAttachment, PlacementAttachmentDownload } from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';

export const placementAttachmentsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'attachments'] as const;

export function usePlacementAttachments(placementId: string) {
  return useQuery({
    queryKey: placementAttachmentsKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/attachments`);
      return (res.data?.items ?? res.data ?? []) as PlacementAttachment[];
    },
    enabled: !!placementId,
    staleTime: 30_000,
  });
}

export function useUploadPlacementAttachment(placementId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      title,
      description,
    }: {
      file: File;
      title?: string;
      description?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (title?.trim()) formData.append('title', title.trim());
      if (description?.trim()) formData.append('description', description.trim());

      const res = await api.post(`${BASE}/${placementId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data as PlacementAttachment;
    },
    onSuccess: (attachment) => {
      queryClient.setQueryData<PlacementAttachment[]>(
        placementAttachmentsKey(placementId),
        (current = []) => [attachment, ...current.filter((item) => item.id !== attachment.id)],
      );
      queryClient.invalidateQueries({ queryKey: placementAttachmentsKey(placementId) });
    },
  });
}

export function usePlacementAttachmentDownload(placementId: string) {
  return useMutation({
    mutationFn: async (attachmentId: string) => {
      const res = await api.get(`${BASE}/${placementId}/attachments/${attachmentId}/download-url`);
      return res.data as PlacementAttachmentDownload;
    },
  });
}
