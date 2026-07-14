import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreatePlacementClaimPayload,
  Facultative,
  PlacementClaim,
  PlacementClaimAllocation,
  PlacementClaimCashCall,
  PlacementClaimCashCallStatus,
  PlacementClaimStatus,
  UpdatePlacementClaimPayload,
} from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';

export const claimsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'claims'] as const;

const claimKey = (placementId: string, claimId: string) =>
  [...claimsKey(placementId), claimId] as const;

const allocationsKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'allocations'] as const;

const cashCallsKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'cash-calls'] as const;

export function usePlacementClaims(placementId: string) {
  return useQuery({
    queryKey: claimsKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
    },
    enabled: !!placementId,
  });
}

export function usePlacementClaim(placementId: string, claimId: string) {
  return useQuery({
    queryKey: claimKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims/${claimId}`);
      return res.data as PlacementClaim;
    },
    enabled: !!placementId && !!claimId,
  });
}

export function useCreatePlacementClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      ...payload
    }: CreatePlacementClaimPayload & { placementId: string }) => {
      const res = await api.post(`${BASE}/${placementId}/claims`, payload);
      return res.data as PlacementClaim;
    },
    onSuccess: (claim) => {
      queryClient.setQueryData<PlacementClaim[]>(claimsKey(claim.placementId), (current = []) => [
        claim,
        ...current.filter((item) => item.id !== claim.id),
      ]);
      queryClient.invalidateQueries({ queryKey: claimsKey(claim.placementId) });
    },
  });
}

export function useUpdatePlacementClaim(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePlacementClaimPayload) => {
      const res = await api.patch(`${BASE}/${placementId}/claims/${claimId}`, payload);
      return res.data as PlacementClaim;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claimsKey(placementId) });
      queryClient.invalidateQueries({ queryKey: claimKey(placementId, claimId) });
    },
  });
}

export function useUpdateClaimStatus(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: PlacementClaimStatus) => {
      const res = await api.patch(`${BASE}/${placementId}/claims/${claimId}/status`, { status });
      return res.data as PlacementClaim;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claimsKey(placementId) });
      queryClient.invalidateQueries({ queryKey: claimKey(placementId, claimId) });
    },
  });
}

export function useClaimAllocations(placementId: string, claimId: string) {
  return useQuery({
    queryKey: allocationsKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims/${claimId}/allocations`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaimAllocation[];
    },
    enabled: !!placementId && !!claimId,
  });
}

export function useGenerateClaimAllocations(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`${BASE}/${placementId}/claims/${claimId}/allocations/generate`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaimAllocation[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: allocationsKey(placementId, claimId) });
    },
  });
}

export function useClaimCashCalls(placementId: string, claimId: string) {
  return useQuery({
    queryKey: cashCallsKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims/${claimId}/cash-calls`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaimCashCall[];
    },
    enabled: !!placementId && !!claimId,
  });
}

export function useCreateClaimCashCall(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (allocationId: string) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/allocations/${allocationId}/cash-calls`,
      );
      return res.data as PlacementClaimCashCall;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashCallsKey(placementId, claimId) });
    },
  });
}

export function useUpdateClaimCashCallStatus(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cashCallId,
      status,
    }: {
      cashCallId: string;
      status: Exclude<PlacementClaimCashCallStatus, 'PAID'>;
    }) => {
      const res = await api.patch(
        `${BASE}/${placementId}/claims/${claimId}/cash-calls/${cashCallId}/status`,
        { status },
      );
      return res.data as PlacementClaimCashCall;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashCallsKey(placementId, claimId) });
    },
  });
}

export function useVoidClaimCashCall(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cashCallId, voidReason }: { cashCallId: string; voidReason: string }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/cash-calls/${cashCallId}/void`,
        { voidReason },
      );
      return res.data as PlacementClaimCashCall;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cashCallsKey(placementId, claimId) });
    },
  });
}

export interface ReinsurerClaimRow {
  id: string;
  claimId: string;
  claimNumber: string;
  status: PlacementClaimStatus;
  placementId: string;
  placementReference: string;
  policyNumber: string | null;
  cedantName: string;
  currency: string;
  sharePercent: number;
  recoveryAmount: number;
  occurrenceDate: string;
}

/**
 * Claims for every offer this reinsurer participates in — one row per claim, with the
 * claim's actual (final if finalized, else estimated) loss amount as the recovery figure.
 * Uses the same query keys as usePlacementClaims so results share the cache.
 */
export function useReinsurerClaims(
  placements: Facultative[],
  reinsurerId: string,
): { rows: ReinsurerClaimRow[]; isLoading: boolean } {
  const reinsuredPlacements = useMemo(
    () =>
      placements.filter((p) =>
        p.participants.some(
          (pt) =>
            pt.counterpartyId === reinsurerId &&
            (pt.status === 'ACCEPTED' || pt.status === 'CLOSED'),
        ),
      ),
    [placements, reinsurerId],
  );

  const claimQueries = useQueries({
    queries: reinsuredPlacements.map((p) => ({
      queryKey: claimsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/claims`);
        return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
      },
    })),
  });

  const isLoading = claimQueries.some((q) => q.isLoading);

  const rows = useMemo(() => {
    const list: ReinsurerClaimRow[] = [];
    reinsuredPlacements.forEach((p, i) => {
      const claims = claimQueries[i]?.data ?? [];
      const participant = p.participants.find((pt) => pt.counterpartyId === reinsurerId);
      const sharePercent = parseFloat(
        participant?.signedLinePercent ?? participant?.sharePercent ?? '0',
      );
      claims.forEach((claim) => {
        list.push({
          id: claim.id,
          claimId: claim.id,
          claimNumber: claim.claimNumber,
          status: claim.status,
          placementId: p.id,
          placementReference: p.policyNumber ?? p.reference,
          policyNumber: p.policyNumber,
          cedantName: p.cedant.name,
          currency: claim.currency,
          sharePercent,
          recoveryAmount: parseFloat(claim.finalLossAmount ?? claim.estimatedLossAmount),
          occurrenceDate: claim.occurrenceDate,
        });
      });
    });
    return list;
  }, [reinsuredPlacements, claimQueries, reinsurerId]);

  return { rows, isLoading };
}
