import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PlacementDocument } from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';

export const placementDocumentsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'documents'] as const;

export function usePlacementDocuments(placementId: string) {
  return useQuery({
    queryKey: placementDocumentsKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/documents`);
      return (res.data?.items ?? res.data ?? []) as PlacementDocument[];
    },
    enabled: !!placementId,
  });
}

export function useGenerateClosingSlipDocument(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (closingId: string) => {
      const res = await api.post(
        `${BASE}/${placementId}/closings/${closingId}/documents/closing-slip`,
      );
      return res.data as PlacementDocument;
    },
    onSuccess: (document) => {
      queryClient.setQueryData<PlacementDocument[]>(
        placementDocumentsKey(placementId),
        (current = []) => [document, ...current.filter((item) => item.id !== document.id)],
      );
      queryClient.invalidateQueries({ queryKey: placementDocumentsKey(placementId) });
    },
  });
}

export function useGenerateParticipantOfferSlipDocument(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (participantId: string) => {
      const res = await api.post(
        `${BASE}/${placementId}/participants/${participantId}/documents/offer-slip`,
      );
      return res.data as PlacementDocument;
    },
    onSuccess: (document) => {
      queryClient.setQueryData<PlacementDocument[]>(
        placementDocumentsKey(placementId),
        (current = []) => [document, ...current.filter((item) => item.id !== document.id)],
      );
      queryClient.invalidateQueries({ queryKey: placementDocumentsKey(placementId) });
    },
  });
}

export function useRenderPlacementDocumentPdf(placementId: string) {
  return useMutation({
    mutationFn: async (documentId: string) => {
      const res = await api.post(
        `${BASE}/${placementId}/documents/${documentId}/render-pdf`,
        undefined,
        {
          responseType: 'blob',
          headers: { Accept: 'application/pdf' },
        },
      );
      return res.data as Blob;
    },
  });
}
