import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Facultative,
  FacultativeStatus,
  PlacementLockStatus,
  PlacementPayment,
  CreatePlacementPaymentPayload,
} from '@/types/reinsurance';
import { useFacultatives } from './useFacultatives';

const BASE = '/operations/reinsurance/placements';
const FACULTATIVES_KEY = ['reinsurance', 'placements'] as const;

const paymentsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'payments'] as const;

const lockStatusKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'lock-status'] as const;

export function usePlacementPayments(placementId: string) {
  return useQuery({
    queryKey: paymentsKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/payments`);
      const items: PlacementPayment[] = res.data?.items ?? res.data ?? [];
      return items;
    },
    enabled: !!placementId,
  });
}

export function usePlacementLockStatus(placementId: string) {
  return useQuery({
    queryKey: lockStatusKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/lock-status`);
      return res.data as PlacementLockStatus;
    },
    enabled: !!placementId,
  });
}

export function useCreatePlacementPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      ...payload
    }: CreatePlacementPaymentPayload & { placementId: string }) => {
      const res = await api.post(`${BASE}/${placementId}/payments`, payload);
      return res.data as PlacementPayment;
    },
    onSuccess: (_, { placementId }) => {
      queryClient.invalidateQueries({ queryKey: paymentsKey(placementId) });
      queryClient.invalidateQueries({ queryKey: lockStatusKey(placementId) });
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY });
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, placementId] });
    },
  });
}

export function useReversePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ placementId, paymentId }: { placementId: string; paymentId: string }) => {
      const res = await api.post(`${BASE}/${placementId}/payments/${paymentId}/reverse`);
      return res.data as PlacementPayment;
    },
    onSuccess: (_, { placementId }) => {
      queryClient.invalidateQueries({ queryKey: paymentsKey(placementId) });
      queryClient.invalidateQueries({ queryKey: lockStatusKey(placementId) });
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY });
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, placementId] });
    },
  });
}

const CLOSING_STATUSES: FacultativeStatus[] = [
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

function netPremiumFor(p: Facultative): number {
  const fac =
    p.premium != null && p.facultativeOffer != null ? (p.facultativeOffer / 100) * p.premium : 0;
  return p.commission != null ? fac * (1 - p.commission / 100) : fac;
}

function totalPaidFor(payments: PlacementPayment[]): number {
  return payments
    .filter((p) => p.status === 'RECORDED')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
}

/**
 * Returns a map of cedantId → count of placements with outstanding or partial payments.
 * Uses the same query keys as usePlacementPayments so results share the React Query cache.
 */
export function useCedantOutstandingCounts(): Map<string, number> {
  const { data: placements = [] } = useFacultatives();

  const closingPlacements = useMemo(
    () => placements.filter((p) => CLOSING_STATUSES.includes(p.status)),
    [placements],
  );

  const paymentQueries = useQueries({
    queries: closingPlacements.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  return useMemo(() => {
    const counts = new Map<string, number>();
    closingPlacements.forEach((placement, i) => {
      const payments = paymentQueries[i]?.data ?? [];
      const net = netPremiumFor(placement);
      const paid = totalPaidFor(payments);
      if (net > 0 && paid < net) {
        counts.set(placement.cedant.id, (counts.get(placement.cedant.id) ?? 0) + 1);
      }
    });
    return counts;
  }, [closingPlacements, paymentQueries]);
}
