import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ApprovePlacementClaimPayablePayload,
  ApprovePlacementClaimRecoveryPayload,
  ConfirmPlacementClaimCedantSettlementBankPayload,
  ConfirmPlacementClaimRecoveryReceiptBankPayload,
  CreatePlacementClaimCedantSettlementPayload,
  CreatePlacementClaimPayload,
  CreatePlacementClaimRecoveryReceiptPayload,
  Facultative,
  PlacementClaim,
  PlacementClaimAllocation,
  PlacementClaimCashCall,
  PlacementClaimCashCallStatus,
  PlacementClaimCedantSettlement,
  PlacementClaimFinancialCloseReadiness,
  PlacementClaimRecoveryApproval,
  PlacementClaimRecoveryPosition,
  PlacementClaimRecoveryReceipt,
  PlacementClaimStatus,
  UpdatePlacementClaimPayload,
} from '@/types/reinsurance';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

const BASE = '/operations/reinsurance/placements';

export const claimsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'claims'] as const;

export const claimKey = (placementId: string, claimId: string) =>
  [...claimsKey(placementId), claimId] as const;

export const allocationsKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'allocations'] as const;

export const cashCallsKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'cash-calls'] as const;

export const recoveryPositionKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'recovery-position'] as const;

export const cedantSettlementsKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'cedant-settlements'] as const;

export const recoveryReceiptsKey = (placementId: string, claimId: string, cashCallId: string) =>
  [...claimKey(placementId, claimId), 'cash-calls', cashCallId, 'recovery-receipts'] as const;

export const recoveryApprovalsKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'recovery-approvals'] as const;

export const financialCloseReadinessKey = (placementId: string, claimId: string) =>
  [...claimKey(placementId, claimId), 'financial-close-readiness'] as const;

function invalidateClaimWorkflow(
  queryClient: ReturnType<typeof useQueryClient>,
  placementId: string,
  claimId?: string,
) {
  queryClient.invalidateQueries({ queryKey: claimsKey(placementId) });
  if (claimId) {
    queryClient.invalidateQueries({ queryKey: claimKey(placementId, claimId) });
    queryClient.invalidateQueries({ queryKey: allocationsKey(placementId, claimId) });
    queryClient.invalidateQueries({ queryKey: cashCallsKey(placementId, claimId) });
    queryClient.invalidateQueries({ queryKey: recoveryPositionKey(placementId, claimId) });
    queryClient.invalidateQueries({ queryKey: cedantSettlementsKey(placementId, claimId) });
    queryClient.invalidateQueries({ queryKey: recoveryApprovalsKey(placementId, claimId) });
    queryClient.invalidateQueries({ queryKey: financialCloseReadinessKey(placementId, claimId) });
  }
  queryClient.invalidateQueries({ queryKey: ['reinsurance', 'dashboard'] });
}

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
      invalidateClaimWorkflow(queryClient, claim.placementId, claim.id);
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
      invalidateClaimWorkflow(queryClient, placementId, claimId);
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
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

/**
 * Backend-derived readiness for moving a claim to SETTLED or CLOSED — RECORDED
 * settlements/receipts are operational and don't count until Accounting bank-confirms them.
 */
export function useClaimFinancialCloseReadiness(placementId: string, claimId: string) {
  return useQuery({
    queryKey: financialCloseReadinessKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(
        `${BASE}/${placementId}/claims/${claimId}/financial-close-readiness`,
      );
      return res.data as PlacementClaimFinancialCloseReadiness;
    },
    enabled: !!placementId && !!claimId,
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
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useGenerateClaimAllocationsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ placementId, claimId }: { placementId: string; claimId: string }) => {
      const res = await api.post(`${BASE}/${placementId}/claims/${claimId}/allocations/generate`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaimAllocation[];
    },
    onSuccess: (_allocations, variables) => {
      invalidateClaimWorkflow(queryClient, variables.placementId, variables.claimId);
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
      invalidateClaimWorkflow(queryClient, placementId, claimId);
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
      invalidateClaimWorkflow(queryClient, placementId, claimId);
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
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useClaimRecoveryPosition(placementId: string, claimId: string) {
  return useQuery({
    queryKey: recoveryPositionKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims/${claimId}/recovery-position`);
      return res.data as PlacementClaimRecoveryPosition;
    },
    enabled: !!placementId && !!claimId,
  });
}

export function useApproveClaimPayable(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ApprovePlacementClaimPayablePayload) => {
      const res = await api.patch(
        `${BASE}/${placementId}/claims/${claimId}/approve-payable`,
        payload,
      );
      return res.data as PlacementClaim;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useClaimCedantSettlements(placementId: string, claimId: string) {
  return useQuery({
    queryKey: cedantSettlementsKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims/${claimId}/cedant-settlements`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaimCedantSettlement[];
    },
    enabled: !!placementId && !!claimId,
  });
}

export function useCreateClaimCedantSettlement(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePlacementClaimCedantSettlementPayload) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/cedant-settlements`,
        payload,
      );
      return res.data as PlacementClaimCedantSettlement;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useReverseClaimCedantSettlement(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ settlementId, notes }: { settlementId: string; notes?: string }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/cedant-settlements/${settlementId}/reverse`,
        { notes },
      );
      return res.data as PlacementClaimCedantSettlement;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useConfirmClaimCedantSettlementBank(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      settlementId,
      ...payload
    }: ConfirmPlacementClaimCedantSettlementBankPayload & { settlementId: string }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/cedant-settlements/${settlementId}/bank-confirm`,
        payload,
      );
      return res.data as PlacementClaimCedantSettlement;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

/** Immutable per-allocation reinsurer recovery approval history — precedes recovery receipts. */
export function useClaimRecoveryApprovals(placementId: string, claimId: string) {
  return useQuery({
    queryKey: recoveryApprovalsKey(placementId, claimId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/claims/${claimId}/recovery-approvals`);
      return (res.data?.items ?? res.data ?? []) as PlacementClaimRecoveryApproval[];
    },
    enabled: !!placementId && !!claimId,
  });
}

export function useApproveClaimRecovery(placementId: string, claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      allocationId,
      ...payload
    }: ApprovePlacementClaimRecoveryPayload & { allocationId: string }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/allocations/${allocationId}/recovery-approvals`,
        payload,
      );
      return res.data as PlacementClaimRecoveryApproval;
    },
    onSuccess: () => {
      invalidateClaimWorkflow(queryClient, placementId, claimId);
    },
  });
}

export function useClaimRecoveryReceipts(placementId: string, claimId: string, cashCallId: string) {
  return useQuery({
    queryKey: recoveryReceiptsKey(placementId, claimId, cashCallId),
    queryFn: async () => {
      const res = await api.get(
        `${BASE}/${placementId}/claims/${claimId}/cash-calls/${cashCallId}/recovery-receipts`,
      );
      return (res.data?.items ?? res.data ?? []) as PlacementClaimRecoveryReceipt[];
    },
    enabled: !!placementId && !!claimId && !!cashCallId,
  });
}

export function useCreateClaimRecoveryReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      claimId,
      cashCallId,
      payload,
    }: {
      placementId: string;
      claimId: string;
      cashCallId: string;
      payload: CreatePlacementClaimRecoveryReceiptPayload;
    }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/cash-calls/${cashCallId}/recovery-receipts`,
        payload,
      );
      return res.data as PlacementClaimRecoveryReceipt;
    },
    onSuccess: (_receipt, variables) => {
      invalidateClaimWorkflow(queryClient, variables.placementId, variables.claimId);
      queryClient.invalidateQueries({
        queryKey: recoveryReceiptsKey(
          variables.placementId,
          variables.claimId,
          variables.cashCallId,
        ),
      });
    },
  });
}

export function useReverseClaimRecoveryReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      claimId,
      receiptId,
      notes,
    }: {
      placementId: string;
      claimId: string;
      receiptId: string;
      notes?: string;
    }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/recovery-receipts/${receiptId}/reverse`,
        { notes },
      );
      return res.data as PlacementClaimRecoveryReceipt;
    },
    onSuccess: (_receipt, variables) => {
      invalidateClaimWorkflow(queryClient, variables.placementId, variables.claimId);
    },
  });
}

export function useConfirmClaimRecoveryReceiptBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      claimId,
      receiptId,
      ...payload
    }: ConfirmPlacementClaimRecoveryReceiptBankPayload & {
      placementId: string;
      claimId: string;
      receiptId: string;
    }) => {
      const res = await api.post(
        `${BASE}/${placementId}/claims/${claimId}/recovery-receipts/${receiptId}/bank-confirm`,
        payload,
      );
      return res.data as PlacementClaimRecoveryReceipt;
    },
    onSuccess: (_receipt, variables) => {
      invalidateClaimWorkflow(queryClient, variables.placementId, variables.claimId);
    },
  });
}

export interface RecoveryRow {
  id: string;
  placementId: string;
  claimId: string;
  cashCallId: string;
  allocationId: string;
  policyNumber: string;
  insuredTitle: string;
  riskType: string | null;
  reinsurerId: string;
  reinsurerName: string;
  claimNumber: string;
  cashCallNumber: string;
  cashCallStatus: PlacementClaimCashCallStatus;
  currency: string;
  calledAmount: number;
  recoveredAmount: number;
  /** Operational receipts recorded but not yet financially confirmed by Accounting. */
  recordedAmount: number;
  /** Bank-confirmed recovery receipts that reduce financial outstanding. */
  confirmedAmount: number;
  reversedAmount: number;
  outstandingAmount: number;
  recoveryStatus: PlacementClaimRecoveryPosition['perCashCall'][number]['recoveryStatus'];
  receipts: PlacementClaimRecoveryReceipt[];
  occurrenceDate: string;
}

/**
 * Claim recoveries owed by every reinsurer across all placements. Rows are derived
 * from backend recovery-position truth: ClaimAllocation -> issued CashCall ->
 * RecoveryReceipt. No participant percentages are used as authoritative recovery
 * amounts here.
 */
export function useAllReinsurerClaims(placements: Facultative[]): {
  rows: RecoveryRow[];
  isLoading: boolean;
} {
  const claimQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: claimsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/claims`);
        return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
      },
    })),
  });

  const isLoading = claimQueries.some((q) => q.isLoading);

  const claimRefs = useMemo(
    () =>
      placements.flatMap((placement, placementIndex) =>
        (claimQueries[placementIndex]?.data ?? []).map((claim) => ({
          placement,
          claim,
        })),
      ),
    [placements, claimQueries],
  );

  const positionQueries = useQueries({
    queries: claimRefs.map(({ placement, claim }) => ({
      queryKey: recoveryPositionKey(placement.id, claim.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${placement.id}/claims/${claim.id}/recovery-position`);
        return res.data as PlacementClaimRecoveryPosition;
      },
      enabled: !!placement.id && !!claim.id,
    })),
  });

  const rows = useMemo(() => {
    const list: RecoveryRow[] = [];
    claimRefs.forEach(({ placement, claim }, index) => {
      const position = positionQueries[index]?.data;
      position?.perCashCall.forEach((cashCall) => {
        list.push({
          id: `${claim.id}-${cashCall.cashCallId}`,
          placementId: placement.id,
          claimId: claim.id,
          cashCallId: cashCall.cashCallId,
          allocationId: cashCall.allocationId,
          policyNumber: displayPolicyNumber(placement.policyNumber),
          insuredTitle: placement.title,
          riskType: placement.classOfBusiness,
          reinsurerId: cashCall.counterpartyId,
          reinsurerName: cashCall.counterparty.name,
          claimNumber: claim.claimNumber,
          cashCallNumber: cashCall.cashCallNumber,
          cashCallStatus: cashCall.cashCallStatus,
          currency: cashCall.currency,
          calledAmount: parseFloat(cashCall.calledAmount),
          recoveredAmount: parseFloat(cashCall.recoveredAmount),
          recordedAmount: parseFloat(cashCall.recordedAmount),
          confirmedAmount: parseFloat(cashCall.confirmedAmount),
          reversedAmount: parseFloat(cashCall.reversedAmount),
          outstandingAmount: parseFloat(cashCall.outstandingAmount),
          recoveryStatus: cashCall.recoveryStatus,
          receipts: cashCall.receipts,
          occurrenceDate: claim.occurrenceDate,
        });
      });
    });
    return list;
  }, [claimRefs, positionQueries]);

  return { rows, isLoading: isLoading || positionQueries.some((q) => q.isLoading) };
}

const OPEN_CLAIM_STATUSES: PlacementClaimStatus[] = [
  'DRAFT',
  'NOTIFIED',
  'RESERVED',
  'PARTIALLY_SETTLED',
];

const SETTLED_CLAIM_STATUSES: PlacementClaimStatus[] = ['SETTLED', 'CLOSED'];

export interface ClaimsSummary {
  totalClaims: number;
  totalClaimedAmount: number;
  openClaims: number;
  settledClaims: number;
  isLoading: boolean;
}

/**
 * Aggregate counts/amounts across every claim on the given placements — one query per
 * placement, sharing the cache with usePlacementClaims via claimsKey. Expects `placements`
 * to already be filtered to the set worth querying (e.g. placed/closing offers).
 */
export function useClaimsSummary(placements: Facultative[]): ClaimsSummary {
  const claimQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: claimsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/claims`);
        return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
      },
    })),
  });

  const isLoading = claimQueries.some((q) => q.isLoading);

  const summary = useMemo(() => {
    let totalClaims = 0;
    let totalClaimedAmount = 0;
    let openClaims = 0;
    let settledClaims = 0;

    claimQueries.forEach((query) => {
      const claims = query.data ?? [];
      claims.forEach((claim) => {
        if (claim.status === 'VOID') return;
        totalClaims += 1;
        totalClaimedAmount += parseFloat(claim.finalLossAmount ?? claim.estimatedLossAmount);
        if (OPEN_CLAIM_STATUSES.includes(claim.status)) openClaims += 1;
        if (SETTLED_CLAIM_STATUSES.includes(claim.status)) settledClaims += 1;
      });
    });

    return { totalClaims, totalClaimedAmount, openClaims, settledClaims };
  }, [claimQueries]);

  return { ...summary, isLoading };
}
