import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreatePlacementClaimPayload,
  PlacementClaim,
  PlacementClaimAllocation,
  PlacementClaimCashCall,
  PlacementClaimCashCallStatus,
  PlacementClaimStatus,
  UpdatePlacementClaimPayload,
} from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';
const CLAIMS_STALE_TIME_MS = 60_000;

export const claimsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'claims'] as const;

const claimKey = (placementId: string, claimId: string) =>
  [...claimsKey(placementId), claimId] as const;

const allocationsKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'allocations'] as const;

const cashCallsKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'cash-calls'] as const;

function upsertCashCall(
  current: PlacementClaimCashCall[] | undefined,
  cashCall: PlacementClaimCashCall,
) {
  return [
    cashCall,
    ...(current ?? []).filter((item) => item.id !== cashCall.id),
  ];
}

function refreshClaimWorkflow(
  queryClient: ReturnType<typeof useQueryClient>,
  placementId: string,
  claimId: string,
) {
  void Promise.all([
    queryClient.invalidateQueries({
      queryKey: claimsKey(placementId),
      exact: true,
    }),
    queryClient.invalidateQueries({
      queryKey: claimKey(placementId, claimId),
      exact: true,
    }),
    queryClient.invalidateQueries({
      queryKey: allocationsKey(placementId, claimId),
      exact: true,
    }),
    queryClient.invalidateQueries({
      queryKey: cashCallsKey(placementId, claimId),
      exact: true,
    }),
    queryClient.invalidateQueries({
      queryKey: ['reinsurance', 'dashboard', 'claims'],
      exact: true,
    }),
  ]);
}

export function usePlacementClaims(placementId: string) {
  return useQuery({
    queryKey: claimsKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
    },
    enabled: !!placementId,
    staleTime: CLAIMS_STALE_TIME_MS,
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
    staleTime: CLAIMS_STALE_TIME_MS,
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
    staleTime: CLAIMS_STALE_TIME_MS,
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
    staleTime: CLAIMS_STALE_TIME_MS,
  });
}

export function useCreateClaimCashCall(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (allocationId: string) => {
      const cached = queryClient.getQueryData<PlacementClaimCashCall[]>(
        cashCallsKey(placementId, claimId),
      );
      const existing = cached?.find(
        (cashCall) =>
          cashCall.allocationId === allocationId && cashCall.status !== 'VOID',
      );
      if (existing) return existing;

      try {
        const res = await api.post(
          `${BASE}/${placementId}/claims/${claimId}/allocations/${allocationId}/cash-calls`,
        );
        return res.data as PlacementClaimCashCall;
      } catch (error) {
        const status = (
          error as { response?: { status?: number } }
        ).response?.status;
        if (status !== 409) throw error;

        // Another click/session may have created the active call first.
        const res = await api.get(
          `${BASE}/${placementId}/claims/${claimId}/cash-calls`,
        );
        const cashCalls = (res.data?.items ??
          res.data ??
          []) as PlacementClaimCashCall[];
        queryClient.setQueryData(
          cashCallsKey(placementId, claimId),
          cashCalls,
        );
        const active = cashCalls.find(
          (cashCall) =>
            cashCall.allocationId === allocationId &&
            cashCall.status !== 'VOID',
        );
        if (!active) throw error;
        return active;
      }
    },
    onSuccess: (cashCall) => {
      queryClient.setQueryData<PlacementClaimCashCall[]>(
        cashCallsKey(placementId, claimId),
        (current) => upsertCashCall(current, cashCall),
      );
      refreshClaimWorkflow(queryClient, placementId, claimId);
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
    onSuccess: (cashCall) => {
      queryClient.setQueryData<PlacementClaimCashCall[]>(
        cashCallsKey(placementId, claimId),
        (current) => upsertCashCall(current, cashCall),
      );
      refreshClaimWorkflow(queryClient, placementId, claimId);
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
    onSuccess: (cashCall) => {
      queryClient.setQueryData<PlacementClaimCashCall[]>(
        cashCallsKey(placementId, claimId),
        (current) => upsertCashCall(current, cashCall),
      );
      refreshClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}
