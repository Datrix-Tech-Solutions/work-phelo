import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Facultative,
  FacultativeStatus,
  PlacementPayment,
  CreatePlacementPaymentPayload,
  PlacementParticipantClosing,
} from '@/types/reinsurance';
import { useFacultatives } from './useFacultatives';

const BASE = '/operations/reinsurance/placements';

const paymentsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'payments'] as const;
const placementClosingsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'closings'] as const;

async function fetchPlacementPayments(placementId: string): Promise<PlacementPayment[]> {
  const res = await api.get(`${BASE}/${placementId}/payments`);
  return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
}

async function fetchPlacementClosings(placementId: string): Promise<PlacementParticipantClosing[]> {
  const res = await api.get(`${BASE}/${placementId}/closings`);
  return (res.data?.items ?? res.data ?? []) as PlacementParticipantClosing[];
}

export function usePlacementPayments(placementId: string) {
  return useQuery({
    queryKey: paymentsKey(placementId),
    queryFn: () => fetchPlacementPayments(placementId),
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
    },
  });
}

export const CLOSING_STATUSES: FacultativeStatus[] = [
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

export function confirmedNetPremiumFor(closings: PlacementParticipantClosing[]): number {
  return closings
    .filter((closing) => closing.status === 'CONFIRMED')
    .reduce((sum, closing) => sum + parseFloat(closing.netPremium ?? '0'), 0);
}

export function totalEffectivePremiumReceived(payments: PlacementPayment[]): number {
  return payments
    .filter(
      (p) => p.type === 'PREMIUM_RECEIVED' && p.status === 'RECORDED' && !p.reversalOfPaymentId,
    )
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
}

export function totalEffectiveReinsurerDisbursement(
  payments: PlacementPayment[],
  reinsurerId: string,
): number {
  return payments
    .filter(
      (p) =>
        p.type === 'REINSURER_DISBURSEMENT' &&
        p.counterpartyId === reinsurerId &&
        p.status === 'RECORDED' &&
        !p.reversalOfPaymentId,
    )
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
}

export type PlacementPaymentStatus = 'paid' | 'partial' | 'outstanding';

/**
 * Returns a map of placementId → payment status for placements that have at least one
 * accepted/closed participant. Uses the same query keys as usePlacementPayments so results
 * share the React Query cache with the per-row PaymentStatusCell queries.
 */
export function useCedantPlacementPaymentStatuses(
  placements: Facultative[],
): Map<string, PlacementPaymentStatus> {
  const relevantPlacements = useMemo(
    () =>
      placements.filter((p) =>
        p.participants.some((pt) => pt.status === 'ACCEPTED' || pt.status === 'CLOSED'),
      ),
    [placements],
  );

  const paymentQueries = useQueries({
    queries: relevantPlacements.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: () => fetchPlacementPayments(p.id),
    })),
  });

  const closingQueries = useQueries({
    queries: relevantPlacements.map((p) => ({
      queryKey: placementClosingsKey(p.id),
      queryFn: () => fetchPlacementClosings(p.id),
    })),
  });

  return useMemo(() => {
    const map = new Map<string, PlacementPaymentStatus>();
    relevantPlacements.forEach((placement, i) => {
      const payments = paymentQueries[i]?.data ?? [];
      const closings = closingQueries[i]?.data ?? [];
      const net = confirmedNetPremiumFor(closings);
      const paid = totalEffectivePremiumReceived(payments);
      if (net > 0 && paid >= net) {
        map.set(placement.id, 'paid');
      } else if (paid > 0) {
        map.set(placement.id, 'partial');
      } else {
        map.set(placement.id, 'outstanding');
      }
    });
    return map;
  }, [relevantPlacements, paymentQueries, closingQueries]);
}

export interface PremiumsSummary {
  totalDue: number;
  totalPaid: number;
  isLoading: boolean;
}

/**
 * Aggregates net premium due vs. recorded payments across the given placements. Uses the same
 * query keys as usePlacementPayments so results share the cache. Expects `placements` to
 * already be filtered to the set worth querying (e.g. placed/closing offers).
 */
export function usePremiumsSummary(placements: Facultative[]): PremiumsSummary {
  const paymentQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: () => fetchPlacementPayments(p.id),
    })),
  });

  const closingQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: placementClosingsKey(p.id),
      queryFn: () => fetchPlacementClosings(p.id),
    })),
  });

  const isLoading =
    paymentQueries.some((q) => q.isLoading) || closingQueries.some((q) => q.isLoading);

  const summary = useMemo(() => {
    let totalDue = 0;
    let totalPaid = 0;
    placements.forEach((p, i) => {
      const payments = paymentQueries[i]?.data ?? [];
      const closings = closingQueries[i]?.data ?? [];
      totalDue += confirmedNetPremiumFor(closings);
      totalPaid += totalEffectivePremiumReceived(payments);
    });
    return { totalDue, totalPaid };
  }, [placements, paymentQueries, closingQueries]);

  return { ...summary, isLoading };
}

/**
 * Returns paid disbursements (by currency ISO code) made to a specific reinsurer across all their
 * placements. Uses the same query keys as usePlacementPayments so results share the cache.
 */
export function useReinsurerPaymentSummary(
  placements: Facultative[],
  reinsurerId: string,
): { paidByCode: Map<string, number>; isLoading: boolean } {
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

  const paymentQueries = useQueries({
    queries: reinsuredPlacements.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  const isLoading = paymentQueries.some((q) => q.isLoading);

  const paidByCode = useMemo(() => {
    const map = new Map<string, number>();
    paymentQueries.forEach((q) => {
      const payments = q.data ?? [];
      payments
        .filter(
          (pmt) =>
            pmt.type === 'REINSURER_DISBURSEMENT' &&
            pmt.counterpartyId === reinsurerId &&
            pmt.status === 'RECORDED' &&
            !pmt.reversalOfPaymentId,
        )
        .forEach((pmt) => {
          map.set(pmt.currency, (map.get(pmt.currency) ?? 0) + parseFloat(pmt.amount));
        });
    });
    return map;
  }, [paymentQueries, reinsurerId]);

  return { paidByCode, isLoading };
}

/**
 * Returns recorded claim recovery payments (CLAIM_SETTLEMENT / INBOUND) from a specific
 * reinsurer, keyed by placement ID. Uses the same query keys as usePlacementPayments so
 * results share the cache.
 */
export function useReinsurerClaimPayments(
  placements: Facultative[],
  reinsurerId: string,
): { paidByPlacementId: Map<string, number>; isLoading: boolean } {
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

  const paymentQueries = useQueries({
    queries: reinsuredPlacements.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  const isLoading = paymentQueries.some((q) => q.isLoading);

  const paidByPlacementId = useMemo(() => {
    const map = new Map<string, number>();
    reinsuredPlacements.forEach((p, i) => {
      const payments = paymentQueries[i]?.data ?? [];
      const paid = payments
        .filter(
          (pmt) =>
            pmt.type === 'CLAIM_SETTLEMENT' &&
            pmt.direction === 'INBOUND' &&
            pmt.counterpartyId === reinsurerId &&
            pmt.status === 'RECORDED' &&
            !pmt.reversalOfPaymentId,
        )
        .reduce((sum, pmt) => sum + parseFloat(pmt.amount), 0);
      map.set(p.id, paid);
    });
    return map;
  }, [reinsuredPlacements, paymentQueries, reinsurerId]);

  return { paidByPlacementId, isLoading };
}

/**
 * Returns recorded claim recovery payments (CLAIM_SETTLEMENT / INBOUND) across every reinsurer
 * on the given placements, keyed by `${placementId}:${reinsurerId}`. Uses the same query keys
 * as usePlacementPayments so results share the cache. Expects `placements` to already be
 * filtered to the set worth querying.
 */
export function useAllReinsurerClaimPayments(placements: Facultative[]): {
  paidMap: Map<string, number>;
  isLoading: boolean;
} {
  const paymentQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  const isLoading = paymentQueries.some((q) => q.isLoading);

  const paidMap = useMemo(() => {
    const map = new Map<string, number>();
    placements.forEach((p, i) => {
      const payments = paymentQueries[i]?.data ?? [];
      payments
        .filter(
          (pmt) =>
            pmt.type === 'CLAIM_SETTLEMENT' &&
            pmt.direction === 'INBOUND' &&
            pmt.status === 'RECORDED' &&
            !pmt.reversalOfPaymentId,
        )
        .forEach((pmt) => {
          const key = `${p.id}:${pmt.counterpartyId}`;
          map.set(key, (map.get(key) ?? 0) + parseFloat(pmt.amount));
        });
    });
    return map;
  }, [placements, paymentQueries]);

  return { paidMap, isLoading };
}

/**
 * Returns paid premium receipts (by currency ISO code) across a set of placements (already
 * filtered to one cedant). Uses the same query keys as usePlacementPayments so results share cache.
 */
export function useCedantPaymentSummary(placements: Facultative[]): {
  paidByCode: Map<string, number>;
  isLoading: boolean;
} {
  const paymentQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  const isLoading = paymentQueries.some((q) => q.isLoading);

  const paidByCode = useMemo(() => {
    const map = new Map<string, number>();
    paymentQueries.forEach((q) => {
      const payments = q.data ?? [];
      payments
        .filter(
          (pmt) =>
            pmt.type === 'PREMIUM_RECEIVED' &&
            pmt.status === 'RECORDED' &&
            !pmt.reversalOfPaymentId,
        )
        .forEach((pmt) => {
          map.set(pmt.currency, (map.get(pmt.currency) ?? 0) + parseFloat(pmt.amount));
        });
    });
    return map;
  }, [paymentQueries]);

  return { paidByCode, isLoading };
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
      queryFn: () => fetchPlacementPayments(p.id),
    })),
  });

  const closingQueries = useQueries({
    queries: closingPlacements.map((p) => ({
      queryKey: placementClosingsKey(p.id),
      queryFn: () => fetchPlacementClosings(p.id),
    })),
  });

  return useMemo(() => {
    const counts = new Map<string, number>();
    closingPlacements.forEach((placement, i) => {
      const payments = paymentQueries[i]?.data ?? [];
      const closings = closingQueries[i]?.data ?? [];
      const net = confirmedNetPremiumFor(closings);
      const paid = totalEffectivePremiumReceived(payments);
      if (net > 0 && paid < net) {
        counts.set(placement.cedant.id, (counts.get(placement.cedant.id) ?? 0) + 1);
      }
    });
    return counts;
  }, [closingPlacements, paymentQueries, closingQueries]);
}
