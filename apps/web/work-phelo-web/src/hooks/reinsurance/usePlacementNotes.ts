import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PlacementNote, PlacementNoteListResponse, PlacementNoteStatus } from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';
const placementNotesKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'notes'] as const;
const endorsementNotesKey = (placementId: string, endorsementId: string) =>
  ['reinsurance', 'placements', placementId, 'endorsements', endorsementId, 'notes'] as const;

export { placementNotesKey, endorsementNotesKey };

const upsertNote = (current: PlacementNote[] | undefined, note: PlacementNote) => [
  note,
  ...(current ?? []).filter((item) => item.id !== note.id),
];

export function usePlacementNotes(placementId: string) {
  return useQuery({
    queryKey: placementNotesKey(placementId),
    queryFn: async () => {
      const res = await api.get<PlacementNoteListResponse>(`${BASE}/${placementId}/notes`);
      return res.data.items ?? [];
    },
    enabled: !!placementId,
    staleTime: 30_000,
  });
}

export function useGeneratePlacementDebitNote(placementId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await api.post<PlacementNote>(`${BASE}/${placementId}/notes/debit`);
      return res.data;
    },
    onSuccess: (note) => {
      queryClient.setQueryData<PlacementNote[]>(placementNotesKey(placementId), (current) =>
        upsertNote(current, note),
      );
      queryClient.invalidateQueries({ queryKey: placementNotesKey(placementId) });
    },
  });
}

export function useGeneratePlacementCreditNote(placementId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (closingId: string) => {
      const res = await api.post<PlacementNote>(
        `${BASE}/${placementId}/closings/${closingId}/notes/credit`,
      );
      return res.data;
    },
    onSuccess: (note) => {
      queryClient.setQueryData<PlacementNote[]>(placementNotesKey(placementId), (current) =>
        upsertNote(current, note),
      );
      queryClient.invalidateQueries({ queryKey: placementNotesKey(placementId) });
    },
  });
}

export function useIssuePlacementNote(placementId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const res = await api.patch<PlacementNote>(`${BASE}/${placementId}/notes/${noteId}/status`, {
        status: 'ISSUED' satisfies PlacementNoteStatus,
      });
      return res.data;
    },
    onSuccess: (note) => {
      queryClient.setQueryData<PlacementNote[]>(placementNotesKey(placementId), (current) =>
        upsertNote(current, note),
      );
      queryClient.invalidateQueries({ queryKey: placementNotesKey(placementId) });
    },
  });
}

export function useVoidPlacementNote(placementId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, voidReason }: { noteId: string; voidReason: string }) => {
      const res = await api.post<PlacementNote>(`${BASE}/${placementId}/notes/${noteId}/void`, {
        voidReason,
      });
      return res.data;
    },
    onSuccess: (note) => {
      queryClient.setQueryData<PlacementNote[]>(placementNotesKey(placementId), (current) =>
        upsertNote(current, note),
      );
      queryClient.invalidateQueries({ queryKey: placementNotesKey(placementId) });
    },
  });
}

export function useEndorsementNotes(placementId: string, endorsementId: string | undefined) {
  return useQuery({
    queryKey: endorsementNotesKey(placementId, endorsementId ?? ''),
    queryFn: async () => {
      const res = await api.get<PlacementNoteListResponse>(
        `${BASE}/${placementId}/endorsements/${endorsementId}/notes`,
      );
      return res.data.items ?? [];
    },
    enabled: !!placementId && !!endorsementId,
    staleTime: 30_000,
  });
}

export function useGenerateEndorsementDebitNote(
  placementId: string,
  endorsementId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await api.post<PlacementNote>(
        `${BASE}/${placementId}/endorsements/${endorsementId}/notes/debit`,
      );
      return res.data;
    },
    onSuccess: (note) => {
      queryClient.setQueryData<PlacementNote[]>(
        endorsementNotesKey(placementId, endorsementId ?? ''),
        (current) => upsertNote(current, note),
      );
      queryClient.invalidateQueries({
        queryKey: endorsementNotesKey(placementId, endorsementId ?? ''),
      });
    },
  });
}

export function useGenerateEndorsementCreditNote(
  placementId: string,
  endorsementId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (closingId: string) => {
      const res = await api.post<PlacementNote>(
        `${BASE}/${placementId}/endorsements/${endorsementId}/closings/${closingId}/notes/credit`,
      );
      return res.data;
    },
    onSuccess: (note) => {
      queryClient.setQueryData<PlacementNote[]>(
        endorsementNotesKey(placementId, endorsementId ?? ''),
        (current) => upsertNote(current, note),
      );
      queryClient.invalidateQueries({
        queryKey: endorsementNotesKey(placementId, endorsementId ?? ''),
      });
    },
  });
}

export function useIssueEndorsementNote(placementId: string, endorsementId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const res = await api.patch<PlacementNote>(
        `${BASE}/${placementId}/endorsements/${endorsementId}/notes/${noteId}/status`,
        {
          status: 'ISSUED' satisfies PlacementNoteStatus,
        },
      );
      return res.data;
    },
    onSuccess: (note) => {
      queryClient.setQueryData<PlacementNote[]>(
        endorsementNotesKey(placementId, endorsementId ?? ''),
        (current) => upsertNote(current, note),
      );
      queryClient.invalidateQueries({
        queryKey: endorsementNotesKey(placementId, endorsementId ?? ''),
      });
    },
  });
}

export function useVoidEndorsementNote(placementId: string, endorsementId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, voidReason }: { noteId: string; voidReason: string }) => {
      const res = await api.post<PlacementNote>(
        `${BASE}/${placementId}/endorsements/${endorsementId}/notes/${noteId}/void`,
        {
          voidReason,
        },
      );
      return res.data;
    },
    onSuccess: (note) => {
      queryClient.setQueryData<PlacementNote[]>(
        endorsementNotesKey(placementId, endorsementId ?? ''),
        (current) => upsertNote(current, note),
      );
      queryClient.invalidateQueries({
        queryKey: endorsementNotesKey(placementId, endorsementId ?? ''),
      });
    },
  });
}
