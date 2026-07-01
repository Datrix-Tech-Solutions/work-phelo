import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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
  PlacementParticipantClosing,
  EndorsementParticipantClosing,
  PlacementLockStatus,
  AcceptPlacementParticipantResponse,
} from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';
const FACULTATIVES_KEY = ['reinsurance', 'placements'] as const;
export const facultativePlacementsKey = FACULTATIVES_KEY;
const PLACEMENT_LIST_STALE_TIME_MS = 60_000;
const placementQueryKey = (placementId: string) => [...FACULTATIVES_KEY, placementId] as const;

export const facultativePlacementKey = (placementId: string) => placementQueryKey(placementId);
export const placementClosingsKey = (placementId: string) =>
  [...placementQueryKey(placementId), 'closings'] as const;
export const placementLockStatusKey = (placementId: string) =>
  [...placementQueryKey(placementId), 'lock-status'] as const;

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
    staleTime: PLACEMENT_LIST_STALE_TIME_MS,
  });
}

export function usePaymentEligibleFacultatives() {
  return useQuery({
    queryKey: [...FACULTATIVES_KEY, 'payment-eligible'] as const,
    queryFn: async () => {
      const res = await api.get(BASE, {
        params: { paymentEligible: true, limit: 100 },
      });
      return extractList(res.data);
    },
    staleTime: PLACEMENT_LIST_STALE_TIME_MS,
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

export function useCreateFacultative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFacultativePayload) => {
      const res = await api.post<Facultative>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY });
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
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY });
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, id] });
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
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY });
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, placementId] });
    },
  });
}

export function useDeleteFacultative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${BASE}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY });
    },
  });
}

export function usePlacementLockStatus(placementId: string) {
  return useQuery({
    queryKey: placementLockStatusKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/lock-status`);
      return res.data as PlacementLockStatus;
    },
    enabled: !!placementId,
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
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, placementId] });
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
      if (!variables.suppressInvalidation) {
        queryClient.invalidateQueries({ queryKey: placementQueryKey(placementId) });
      }
    },
  });
}

export function useAcceptAndConfirmParticipant(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ participantId }: { participantId: string }) => {
      const res = await api.post(
        `${BASE}/${placementId}/participants/${participantId}/accept-and-confirm`,
      );
      return res.data as AcceptPlacementParticipantResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY });
      queryClient.invalidateQueries({ queryKey: placementQueryKey(placementId) });
      queryClient.invalidateQueries({ queryKey: placementClosingsKey(placementId) });
      queryClient.invalidateQueries({ queryKey: placementLockStatusKey(placementId) });
      queryClient.invalidateQueries({ queryKey: ['reinsurance', 'dashboard'] });
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
        queryClient.invalidateQueries({ queryKey: placementClosingsKey(placementId) });
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
        queryClient.invalidateQueries({ queryKey: placementClosingsKey(placementId) });
      }
    },
  });
}

const endorsementKey = (placementId: string) => [...FACULTATIVES_KEY, placementId, 'endorsements'];

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
      queryClient.invalidateQueries({ queryKey: endorsementKey(placementId) });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: endorsementKey(placementId) });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: endorsementKey(placementId) });
    },
  });
}

const endorsementParticipantKey = (placementId: string, endorsementId: string) => [
  ...endorsementKey(placementId),
  endorsementId,
  'participants',
];

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
      queryClient.invalidateQueries({
        queryKey: endorsementParticipantKey(placementId, endorsementId ?? ''),
      });
    },
  });
}

const endorsementClosingsKey = (placementId: string, endorsementId: string) => [
  ...endorsementKey(placementId),
  endorsementId,
  'closings',
];

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
        queryClient.invalidateQueries({
          queryKey: endorsementClosingsKey(placementId, endorsementId ?? ''),
        });
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
        queryClient.invalidateQueries({
          queryKey: endorsementClosingsKey(placementId, endorsementId ?? ''),
        });
      }
    },
  });
}
