import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Facultative,
  CreateFacultativePayload,
  UpdateFacultativePayload,
  PlacementParticipantPayload,
  UpdateParticipantPayload,
  UpdateParticipantStatusPayload,
  PlacementEndorsement,
  CreateEndorsementPayload,
} from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';
const FACULTATIVES_KEY = ['reinsurance', 'placements'] as const;

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
      ...payload
    }: UpdateParticipantPayload & { participantId: string }) => {
      const res = await api.patch(`${BASE}/${placementId}/participants/${participantId}`, payload);
      return transformPlacement(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, placementId] });
    },
  });
}

export function useUpdateParticipantStatus(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      participantId,
      ...payload
    }: UpdateParticipantStatusPayload & { participantId: string }) => {
      const res = await api.patch(
        `${BASE}/${placementId}/participants/${participantId}/status`,
        payload,
      );
      return transformPlacement(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, placementId] });
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

export function useCreateClosing(placementId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (participantId: string) => {
      const res = await api.post(`${BASE}/${placementId}/participants/${participantId}/closings`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, placementId] });
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
