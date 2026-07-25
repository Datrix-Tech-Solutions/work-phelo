import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  buildFacultativeReference,
  buildFacultativeReferencePrefix,
} from '@/lib/reinsurance/generateFacultativeReference';
import {
  Facultative,
  FacultativeStatus,
  CreateFacultativePayload,
  UpdateFacultativePayload,
  PlacementParticipantPayload,
  UpdateParticipantPayload,
  UpdateParticipantStatusPayload,
  PlacementEndorsement,
  PlacementEndorsementStatus,
  PlacementEndorsementParticipant,
  CreateEndorsementPayload,
  CreateEndorsementParticipantPayload,
  UpdateEndorsementParticipantPayload,
  PlacementEndorsementSummary,
  EffectivePlacementView,
  PlacementParticipantClosing,
  PlacementNote,
  EndorsementParticipantClosing,
  ValidateEndorsementParticipantResponse,
  PlacementDocument,
} from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';
const FACULTATIVES_KEY = ['reinsurance', 'placements'] as const;
const ARCHIVED_FACULTATIVES_KEY = ['reinsurance', 'placements', 'archived'] as const;
const placementQueryKey = (placementId: string) => [...FACULTATIVES_KEY, placementId] as const;
const placementDocumentsKey = (placementId: string) =>
  [...placementQueryKey(placementId), 'documents'] as const;
const placementNotesKey = (placementId: string) =>
  [...placementQueryKey(placementId), 'notes'] as const;
const placementLockStatusKey = (placementId: string) =>
  [...placementQueryKey(placementId), 'lock-status'] as const;
const paymentEligibleFacultativesKey = [...FACULTATIVES_KEY, 'payment-eligible'] as const;

export const facultativePlacementKey = (placementId: string) => placementQueryKey(placementId);
export const placementClosingsKey = (placementId: string) =>
  [...placementQueryKey(placementId), 'closings'] as const;
export const facultativePlacementNotesKey = (placementId: string) => placementNotesKey(placementId);

type SuppressInvalidationOption = {
  suppressInvalidation?: boolean;
};

function parseDecimal(val: unknown): number | null {
  if (val == null) return null;
  const n = typeof val === 'string' ? parseFloat(val) : typeof val === 'number' ? val : NaN;
  return isNaN(n) ? null : n;
}

function transformPlacement(raw: unknown): Facultative {
  const p = raw as Record<string, unknown>;
  return {
    ...(p as unknown as Facultative),
    sumInsured: parseDecimal(p.sumInsured),
    rate: parseDecimal(p.rate),
    premium: parseDecimal(p.premium),
    commission: parseDecimal(p.commission),
    facultativeOffer: parseDecimal(p.facultativeOffer),
  };
}

function extractList(data: unknown): Facultative[] {
  const raw = Array.isArray(data)
    ? data
    : ((data as { items?: unknown[]; data?: unknown[] })?.items ??
      (data as { items?: unknown[]; data?: unknown[] })?.data ??
      []);
  return raw.map(transformPlacement);
}

export function useFacultatives() {
  return useQuery({
    queryKey: FACULTATIVES_KEY,
    queryFn: async () => {
      const res = await api.get(BASE);
      return extractList(res.data);
    },
  });
}

export function useArchivedFacultatives(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ARCHIVED_FACULTATIVES_KEY,
    queryFn: async () => {
      const res = await api.get(BASE, { params: { archived: true } });
      return extractList(res.data);
    },
    enabled: options.enabled ?? true,
  });
}

export function useFacultativePlacement(id: string) {
  return useQuery({
    queryKey: [...FACULTATIVES_KEY, id],
    queryFn: async () => {
      const res = await api.get(`${BASE}/${id}`);
      return transformPlacement(res.data);
    },
    enabled: !!id,
  });
}

/** Generates the next system reference in the "FAC-{tenant abbr}-{year}-{order}" format. */
export function useNextFacultativeReference(enabled = true) {
  const tenantName = useAuthStore((s) => s.user?.tenantName ?? '');
  const year = new Date().getFullYear();
  const prefix = buildFacultativeReferencePrefix(tenantName || 'GEN', year);

  return useQuery({
    queryKey: [...FACULTATIVES_KEY, 'next-reference', prefix],
    queryFn: async () => {
      const [activeRes, archivedRes] = await Promise.all([
        api.get(BASE, { params: { search: prefix, archived: false, limit: 1 } }),
        api.get(BASE, { params: { search: prefix, archived: true, limit: 1 } }),
      ]);
      const activeTotal = activeRes.data?.meta?.total ?? 0;
      const archivedTotal = archivedRes.data?.meta?.total ?? 0;
      return buildFacultativeReference(tenantName || 'GEN', year, activeTotal + archivedTotal + 1);
    },
    enabled,
    staleTime: 0,
  });
}

export function useCreateFacultative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFacultativePayload) => {
      const res = await api.post<Facultative>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY, exact: true });
    },
  });
}

export function useUpdateFacultative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateFacultativePayload & { id: string }) => {
      const res = await api.patch<Facultative>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY, exact: true });
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, id] });
      queryClient.invalidateQueries({ queryKey: paymentEligibleFacultativesKey });
      queryClient.invalidateQueries({ queryKey: placementLockStatusKey(id) });
      queryClient.invalidateQueries({ queryKey: placementDocumentsKey(id) });
      queryClient.invalidateQueries({ queryKey: ['reinsurance', 'dashboard'] });
    },
  });
}

export function useUpdateFacultativeStatus(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ status, note }: { status: FacultativeStatus; note?: string }) => {
      const res = await api.patch(`${BASE}/${placementId}/status`, { status, note });
      return transformPlacement(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY, exact: true });
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, placementId] });
    },
  });
}

export function useDeleteFacultative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archiveReason }: { id: string; archiveReason?: string }) => {
      await api.delete(`${BASE}/${id}`, {
        data: archiveReason ? { archiveReason } : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY, exact: true });
      queryClient.invalidateQueries({ queryKey: ARCHIVED_FACULTATIVES_KEY });
    },
  });
}

export function useRestoreFacultative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Facultative>(`${BASE}/${id}/restore`);
      return transformPlacement(res.data);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY, exact: true });
      queryClient.invalidateQueries({ queryKey: ARCHIVED_FACULTATIVES_KEY });
      queryClient.invalidateQueries({ queryKey: placementQueryKey(id) });
    },
  });
}

export function useAddParticipant(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PlacementParticipantPayload) => {
      const res = await api.post(`${BASE}/${placementId}/participants`, payload);
      return transformPlacement(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY, exact: true });
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, placementId] });
    },
  });
}

export function useForceCloseFacultative(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<Facultative>(`${BASE}/${placementId}/force-close`);
      return transformPlacement(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY });
      queryClient.invalidateQueries({ queryKey: placementQueryKey(placementId) });
      queryClient.invalidateQueries({ queryKey: placementDocumentsKey(placementId) });
      queryClient.invalidateQueries({ queryKey: placementLockStatusKey(placementId) });
      queryClient.invalidateQueries({ queryKey: paymentEligibleFacultativesKey });
      queryClient.invalidateQueries({ queryKey: ['reinsurance', 'dashboard'] });
    },
  });
}

export function useUpdateParticipant(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      participantId,
      ...payloadWithOptions
    }: UpdateParticipantPayload & { participantId: string } & SuppressInvalidationOption) => {
      const payload = { ...payloadWithOptions };
      delete payload.suppressInvalidation;
      const res = await api.patch(`${BASE}/${placementId}/participants/${participantId}`, payload);
      return transformPlacement(res.data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY, exact: true });
      if (!variables.suppressInvalidation) {
        queryClient.invalidateQueries({ queryKey: placementQueryKey(placementId) });
      }
    },
  });
}

export function useUpdateParticipantStatus(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      participantId,
      ...payloadWithOptions
    }: UpdateParticipantStatusPayload & { participantId: string } & SuppressInvalidationOption) => {
      const payload = { ...payloadWithOptions };
      delete payload.suppressInvalidation;
      const res = await api.patch(
        `${BASE}/${placementId}/participants/${participantId}/status`,
        payload,
      );
      return transformPlacement(res.data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY, exact: true });
      if (!variables.suppressInvalidation) {
        queryClient.invalidateQueries({ queryKey: placementQueryKey(placementId) });
      }
    },
  });
}

export function useDeleteParticipant(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (participantId: string) => {
      const res = await api.delete(`${BASE}/${placementId}/participants/${participantId}`);
      return transformPlacement(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY, exact: true });
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, placementId] });
    },
  });
}

export function usePlacementClosings(placementId: string) {
  return useQuery({
    queryKey: placementClosingsKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/closings`);
      const raw = res.data?.items ?? res.data ?? [];
      return raw as PlacementParticipantClosing[];
    },
    enabled: !!placementId,
  });
}

export function usePlacementNotes(placementId: string) {
  return useQuery({
    queryKey: placementNotesKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/notes`);
      const raw = res.data?.items ?? res.data ?? [];
      return raw as PlacementNote[];
    },
    enabled: !!placementId,
  });
}

export function usePlacementDocuments(placementId: string) {
  return useQuery({
    queryKey: placementDocumentsKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/documents`);
      const raw = res.data?.items ?? res.data ?? [];
      return raw as PlacementDocument[];
    },
    enabled: !!placementId,
  });
}

export function useCreatePlacementDebitNote(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`${BASE}/${placementId}/notes/debit`);
      return res.data as PlacementNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: placementNotesKey(placementId) });
      queryClient.invalidateQueries({ queryKey: placementDocumentsKey(placementId) });
    },
  });
}

export function useCreatePlacementCreditNote(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ closingId }: { closingId: string }) => {
      const res = await api.post(`${BASE}/${placementId}/closings/${closingId}/notes/credit`);
      return res.data as PlacementNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: placementNotesKey(placementId) });
      queryClient.invalidateQueries({ queryKey: placementDocumentsKey(placementId) });
    },
  });
}

export function useGeneratePlacementNoteDocument(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId }: { noteId: string }) => {
      const res = await api.post<PlacementDocument>(
        `${BASE}/${placementId}/notes/${noteId}/documents`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: placementDocumentsKey(placementId) });
    },
  });
}

export function useCreateClosing(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: string | ({ participantId: string } & SuppressInvalidationOption),
    ) => {
      const participantId = typeof input === 'string' ? input : input.participantId;
      const res = await api.post(`${BASE}/${placementId}/participants/${participantId}/closings`);
      return res.data as { id: string };
    },
    onSuccess: (_data, variables) => {
      const suppressInvalidation =
        typeof variables !== 'string' && variables.suppressInvalidation === true;
      if (!suppressInvalidation) {
        queryClient.invalidateQueries({ queryKey: placementQueryKey(placementId) });
      }
    },
  });
}

export function useUpdateClosingStatus(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      closingId,
      status,
    }: {
      closingId: string;
      status: 'ISSUED' | 'CONFIRMED' | 'VOID';
      suppressInvalidation?: boolean;
    }) => {
      const res = await api.patch(`${BASE}/${placementId}/closings/${closingId}/status`, {
        status,
      });
      return res.data as { id: string };
    },
    onSuccess: (_data, variables) => {
      if (!variables.suppressInvalidation) {
        queryClient.invalidateQueries({ queryKey: placementQueryKey(placementId) });
      }
    },
  });
}

export const endorsementKey = (placementId: string) =>
  [...FACULTATIVES_KEY, placementId, 'endorsements'] as const;

export const endorsementSummaryKey = (placementId: string, endorsementId: string) =>
  [...endorsementKey(placementId), endorsementId, 'summary'] as const;

export const placementEffectiveViewKey = (placementId: string) =>
  [...placementQueryKey(placementId), 'effective-view'] as const;

export const endorsementParticipantKey = (placementId: string, endorsementId: string) =>
  [...endorsementKey(placementId), endorsementId, 'participants'] as const;

export const endorsementClosingsKey = (placementId: string, endorsementId: string) =>
  [...endorsementKey(placementId), endorsementId, 'closings'] as const;

function invalidateEndorsementWorkflow(
  queryClient: ReturnType<typeof useQueryClient>,
  placementId: string,
  endorsementId?: string,
) {
  queryClient.invalidateQueries({ queryKey: endorsementKey(placementId) });
  queryClient.invalidateQueries({ queryKey: placementEffectiveViewKey(placementId) });
  if (endorsementId) {
    queryClient.invalidateQueries({ queryKey: endorsementSummaryKey(placementId, endorsementId) });
    queryClient.invalidateQueries({
      queryKey: endorsementParticipantKey(placementId, endorsementId),
    });
    queryClient.invalidateQueries({ queryKey: endorsementClosingsKey(placementId, endorsementId) });
    queryClient.invalidateQueries({
      queryKey: [...endorsementKey(placementId), endorsementId, 'notes'],
    });
    queryClient.invalidateQueries({
      queryKey: [...endorsementKey(placementId), endorsementId, 'documents'],
    });
  }
}

export function usePlacementEndorsements(placementId: string) {
  return useQuery({
    queryKey: endorsementKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/endorsements`);
      const raw = res.data?.items ?? res.data ?? [];
      return raw as PlacementEndorsement[];
    },
    enabled: !!placementId,
  });
}

export function useCreateEndorsement(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateEndorsementPayload) => {
      const res = await api.post(`${BASE}/${placementId}/endorsements`, payload);
      return res.data as PlacementEndorsement;
    },
    onSuccess: () => {
      invalidateEndorsementWorkflow(queryClient, placementId);
    },
  });
}

export function useUpdateEndorsement(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      endorsementId,
      ...payload
    }: { endorsementId: string } & Partial<CreateEndorsementPayload>) => {
      const res = await api.patch(`${BASE}/${placementId}/endorsements/${endorsementId}`, payload);
      return res.data as PlacementEndorsement;
    },
    onSuccess: (_endorsement, variables) => {
      invalidateEndorsementWorkflow(queryClient, placementId, variables.endorsementId);
    },
  });
}

export function useUpdateEndorsementStatus(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      endorsementId,
      status,
    }: {
      endorsementId: string;
      status: PlacementEndorsementStatus;
    }) => {
      const res = await api.patch(`${BASE}/${placementId}/endorsements/${endorsementId}/status`, {
        status,
      });
      return res.data as PlacementEndorsement;
    },
    onSuccess: (_endorsement, variables) => {
      invalidateEndorsementWorkflow(queryClient, placementId, variables.endorsementId);
    },
  });
}

export function usePlacementEndorsementSummary(
  placementId: string,
  endorsementId: string | undefined,
) {
  return useQuery({
    queryKey: endorsementSummaryKey(placementId, endorsementId ?? ''),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/endorsements/${endorsementId}/summary`);
      return res.data as PlacementEndorsementSummary;
    },
    enabled: !!placementId && !!endorsementId,
    staleTime: 15_000,
  });
}

export function usePlacementEffectiveView(placementId: string, enabled = true) {
  return useQuery({
    queryKey: placementEffectiveViewKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/effective-view`);
      return res.data as EffectivePlacementView;
    },
    enabled: !!placementId && enabled,
    staleTime: 15_000,
  });
}

export function usePlacementEndorsementParticipants(
  placementId: string,
  endorsementId: string | undefined,
) {
  return useQuery({
    queryKey: endorsementParticipantKey(placementId, endorsementId ?? ''),
    queryFn: async () => {
      const res = await api.get(
        `${BASE}/${placementId}/endorsements/${endorsementId}/participants`,
      );
      const raw = res.data?.items ?? res.data ?? [];
      return raw as PlacementEndorsementParticipant[];
    },
    enabled: !!placementId && !!endorsementId,
  });
}

export function useCreateEndorsementParticipant(
  placementId: string,
  endorsementId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateEndorsementParticipantPayload) => {
      const res = await api.post(
        `${BASE}/${placementId}/endorsements/${endorsementId}/participants`,
        payload,
      );
      return res.data as PlacementEndorsementParticipant;
    },
    onSuccess: () => {
      invalidateEndorsementWorkflow(queryClient, placementId, endorsementId);
    },
  });
}

export function useUpdateEndorsementParticipant(
  placementId: string,
  endorsementId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      participantId,
      ...payload
    }: UpdateEndorsementParticipantPayload & SuppressInvalidationOption) => {
      const body = { ...payload };
      delete body.suppressInvalidation;
      const res = await api.patch(
        `${BASE}/${placementId}/endorsements/${endorsementId}/participants/${participantId}`,
        body,
      );
      return res.data as PlacementEndorsementParticipant;
    },
    onSuccess: (_data, variables) => {
      if (!variables.suppressInvalidation) {
        invalidateEndorsementWorkflow(queryClient, placementId, endorsementId);
      }
    },
  });
}

export function useUpdateEndorsementParticipantStatus(
  placementId: string,
  endorsementId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      participantId,
      status,
      suppressInvalidation,
    }: {
      participantId: string;
      status: PlacementEndorsementParticipant['status'];
      suppressInvalidation?: boolean;
    }) => {
      const res = await api.patch(
        `${BASE}/${placementId}/endorsements/${endorsementId}/participants/${participantId}/status`,
        { status },
      );
      return {
        data: res.data as PlacementEndorsementParticipant,
        suppressInvalidation: suppressInvalidation === true,
      };
    },
    onSuccess: ({ suppressInvalidation }) => {
      if (!suppressInvalidation) {
        invalidateEndorsementWorkflow(queryClient, placementId, endorsementId);
      }
    },
  });
}

export function useValidateAndConfirmEndorsementParticipant(
  placementId: string,
  endorsementId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ participantId }: { participantId: string }) => {
      if (!endorsementId) {
        throw new Error('Endorsement is required before validating a participant.');
      }
      const res = await api.post<ValidateEndorsementParticipantResponse>(
        `${BASE}/${placementId}/endorsements/${endorsementId}/participants/${participantId}/validate-and-confirm`,
      );
      return res.data;
    },
    onSuccess: (data) => {
      if (!endorsementId) return;

      queryClient.setQueryData<PlacementEndorsementParticipant[]>(
        endorsementParticipantKey(placementId, endorsementId),
        (current) =>
          current?.map((participant) =>
            participant.id === data.participant.id ? data.participant : participant,
          ) ?? [data.participant],
      );
      queryClient.setQueryData<EndorsementParticipantClosing[]>(
        endorsementClosingsKey(placementId, endorsementId),
        (current) => {
          const existing = current ?? [];
          const hasClosing = existing.some((closing) => closing.id === data.closing.id);
          if (!hasClosing) return [...existing, data.closing];
          return existing.map((closing) =>
            closing.id === data.closing.id ? data.closing : closing,
          );
        },
      );
      queryClient.setQueryData<PlacementEndorsementSummary>(
        endorsementSummaryKey(placementId, endorsementId),
        data.summary,
      );

      invalidateEndorsementWorkflow(queryClient, placementId, endorsementId);
      queryClient.invalidateQueries({ queryKey: placementQueryKey(placementId) });
      queryClient.invalidateQueries({ queryKey: placementDocumentsKey(placementId) });
      queryClient.invalidateQueries({ queryKey: placementLockStatusKey(placementId) });
      queryClient.invalidateQueries({ queryKey: ['reinsurance', 'dashboard'] });
    },
  });
}

export function useEndorsementClosings(placementId: string, endorsementId: string | undefined) {
  return useQuery({
    queryKey: endorsementClosingsKey(placementId, endorsementId ?? ''),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/endorsements/${endorsementId}/closings`);
      const raw = res.data?.items ?? res.data ?? [];
      return raw as EndorsementParticipantClosing[];
    },
    enabled: !!placementId && !!endorsementId,
  });
}

export function usePlacementEndorsementNotes(
  placementId: string,
  endorsementId: string | undefined,
) {
  return useQuery({
    queryKey: [...endorsementKey(placementId), endorsementId ?? '', 'notes'],
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/endorsements/${endorsementId}/notes`);
      const raw = res.data?.items ?? res.data ?? [];
      return raw as PlacementNote[];
    },
    enabled: !!placementId && !!endorsementId,
  });
}

export function useCreateEndorsementClosing(
  placementId: string,
  endorsementId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: string | ({ endorsementParticipantId: string } & SuppressInvalidationOption),
    ) => {
      const epId = typeof input === 'string' ? input : input.endorsementParticipantId;
      const res = await api.post(
        `${BASE}/${placementId}/endorsements/${endorsementId}/participants/${epId}/closings`,
      );
      return res.data as EndorsementParticipantClosing;
    },
    onSuccess: (_data, variables) => {
      const suppressInvalidation =
        typeof variables !== 'string' && variables.suppressInvalidation === true;
      if (!suppressInvalidation) {
        invalidateEndorsementWorkflow(queryClient, placementId, endorsementId);
      }
    },
  });
}

export function useUpdateEndorsementClosingStatus(
  placementId: string,
  endorsementId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      closingId,
      status,
    }: {
      closingId: string;
      status: 'ISSUED' | 'CONFIRMED' | 'VOID';
      suppressInvalidation?: boolean;
    }) => {
      const res = await api.patch(
        `${BASE}/${placementId}/endorsements/${endorsementId}/closings/${closingId}/status`,
        { status },
      );
      return res.data as EndorsementParticipantClosing;
    },
    onSuccess: (_data, variables) => {
      if (!variables.suppressInvalidation) {
        invalidateEndorsementWorkflow(queryClient, placementId, endorsementId);
      }
    },
  });
}

export function useGenerateEndorsementSlipDocument(
  placementId: string,
  endorsementId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!endorsementId) {
        throw new Error('Endorsement is required before generating an endorsement slip.');
      }
      const res = await api.post<PlacementDocument>(
        `${BASE}/${placementId}/endorsements/${endorsementId}/documents/endorsement-slip`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: placementDocumentsKey(placementId) });
      invalidateEndorsementWorkflow(queryClient, placementId, endorsementId);
    },
  });
}

export function useGenerateEndorsementCertificateDocument(
  placementId: string,
  endorsementId: string | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ closingId }: { closingId: string }) => {
      if (!endorsementId) {
        throw new Error('Endorsement is required before generating an endorsement certificate.');
      }
      const res = await api.post<PlacementDocument>(
        `${BASE}/${placementId}/endorsements/${endorsementId}/closings/${closingId}/documents/endorsement-certificate`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: placementDocumentsKey(placementId) });
      invalidateEndorsementWorkflow(queryClient, placementId, endorsementId);
    },
  });
}

export function useRenderPlacementDocumentPdf(placementId: string) {
  return useMutation({
    mutationFn: async ({ documentId }: { documentId: string }) => {
      const res = await api.post<Blob>(
        `${BASE}/${placementId}/documents/${documentId}/render-pdf`,
        undefined,
        { responseType: 'blob' },
      );
      return res.data;
    },
  });
}
