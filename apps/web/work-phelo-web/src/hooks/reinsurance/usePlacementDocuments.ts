import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PlacementDocument, PlacementNote } from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';

export const placementDocumentsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'documents'] as const;

export function findActivePlacementNoteDocument(
  documents: PlacementDocument[],
  note: PlacementNote,
) {
  return documents
    .filter((document) => {
      if (
        document.noteId !== note.id ||
        document.type !== note.type ||
        document.status === 'VOID'
      ) {
        return false;
      }
      const snapshot = document.renderPayload.note;
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
      return (snapshot as Record<string, unknown>).status === note.status;
    })
    .sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt))[0];
}

export function usePlacementDocuments(placementId: string) {
  return useQuery({
    queryKey: placementDocumentsKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/documents`);
      return (res.data?.items ?? res.data ?? []) as PlacementDocument[];
    },
    enabled: !!placementId,
    staleTime: 30_000,
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

export function useGeneratePlacementNoteDocument(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string) => {
      const res = await api.post(`${BASE}/${placementId}/notes/${noteId}/documents`);
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

export function useGenerateEndorsementSlipDocument(placementId: string, endorsementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(
        `${BASE}/${placementId}/endorsements/${endorsementId}/documents/endorsement-slip`,
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

export function useGenerateEndorsementCertificateDocument(
  placementId: string,
  endorsementId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (closingId: string) => {
      const res = await api.post(
        `${BASE}/${placementId}/endorsements/${endorsementId}/closings/${closingId}/documents/endorsement-certificate`,
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
