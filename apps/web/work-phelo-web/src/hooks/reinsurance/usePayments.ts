import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Facultative,
  FacultativeStatus,
  PlacementPayment,
  CreatePlacementPaymentPayload,
  ConfirmPlacementPaymentBankPayload,
  PlacementFinancialPosition,
  PlacementParticipantClosing,
} from '@/types/reinsurance';
import { useFacultatives } from './useFacultatives';
import {
  cedantPaymentStatusFromPosition,
  pendingPremiumReceived,
  latestConfirmedPremiumPaymentDate,
  PREMIUM_PAYMENT_STATUS_TEXT,
} from '@/lib/reinsurance/placementStatus';

const BASE = '/operations/reinsurance/placements';

export const paymentsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'payments'] as const;
export const placementFinancialPositionKey = (placementId: string, asOfDate?: string) =>
  ['reinsurance', 'placements', placementId, 'financial-position', asOfDate ?? 'current'] as const;

export async function fetchPlacementPayments(placementId: string): Promise<PlacementPayment[]> {
  const res = await api.get(`${BASE}/${placementId}/payments`);
  return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
}

export async function fetchPlacementFinancialPosition(
  placementId: string,
  asOfDate?: string,
): Promise<PlacementFinancialPosition> {
  const res = await api.get(`${BASE}/${placementId}/financial-position`, {
    params: asOfDate ? { asOfDate } : undefined,
  });
  return res.data as PlacementFinancialPosition;
}

export function usePlacementPayments(placementId: string) {
  return useQuery({
    queryKey: paymentsKey(placementId),
    queryFn: () => fetchPlacementPayments(placementId),
    enabled: !!placementId,
  });
}

export function usePlacementFinancialPosition(placementId: string, asOfDate?: string) {
  return useQuery({
    queryKey: placementFinancialPositionKey(placementId, asOfDate),
    queryFn: () => fetchPlacementFinancialPosition(placementId, asOfDate),
    enabled: !!placementId,
  });
}

/** Premium payment status/latest-payment-date for a placement, in the plain-sentence wording
 *  used by the claim panel and claim overview — shares the same authoritative figures as the
 *  Premiums page and placement Details page via the same query keys/cache. */
export function usePremiumPaymentContext(placementId: string) {
  const { data: financialPosition } = usePlacementFinancialPosition(placementId);
  const { data: payments = [] } = usePlacementPayments(placementId);

  const status = cedantPaymentStatusFromPosition(
    financialPosition?.cedant.currentObligation ?? 0,
    financialPosition?.cedant.netSettled ?? 0,
    financialPosition?.cedant.outstanding ?? 0,
    pendingPremiumReceived(payments),
  );

  return {
    statusText: PREMIUM_PAYMENT_STATUS_TEXT[status],
    latestPaymentDate: latestConfirmedPremiumPaymentDate(payments),
  };
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
      queryClient.invalidateQueries({ queryKey: placementFinancialPositionKey(placementId) });
    },
  });
}

/** Bank-confirms a RECORDED premium receipt/reinsurer disbursement — settlementMethod,
 *  settlementCurrency and reference all fall back to whatever the payment already carries from
 *  when it was recorded (confirmation isn't allowed to change them), so only `bankConfirmedAt`
 *  is genuinely required. Lets Record + Confirm happen as one action from inside Reinsurance
 *  itself, instead of needing a separate trip through Accounting's confirmation queue. */
export function useConfirmPlacementPaymentBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      paymentId,
      ...payload
    }: ConfirmPlacementPaymentBankPayload & { placementId: string; paymentId: string }) => {
      const res = await api.post(
        `${BASE}/${placementId}/payments/${paymentId}/bank-confirmation`,
        payload,
      );
      return res.data as PlacementPayment;
    },
    onSuccess: (_, { placementId }) => {
      queryClient.invalidateQueries({ queryKey: paymentsKey(placementId) });
      queryClient.invalidateQueries({ queryKey: placementFinancialPositionKey(placementId) });
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
      queryClient.invalidateQueries({ queryKey: placementFinancialPositionKey(placementId) });
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
      (p) =>
        p.type === 'PREMIUM_RECEIVED' && p.status === 'BANK_CONFIRMED' && !p.reversalOfPaymentId,
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
        p.status === 'BANK_CONFIRMED' &&
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

  const positionQueries = useQueries({
    queries: relevantPlacements.map((p) => ({
      queryKey: placementFinancialPositionKey(p.id),
      queryFn: () => fetchPlacementFinancialPosition(p.id),
    })),
  });

  return useMemo(() => {
    const map = new Map<string, PlacementPaymentStatus>();
    relevantPlacements.forEach((placement, i) => {
      const position = positionQueries[i]?.data;
      const due = position?.cedant.currentObligation ?? 0;
      const paid = position?.cedant.netSettled ?? 0;
      const outstanding = position?.cedant.outstanding ?? 0;
      if (due > 0 && outstanding <= 0.0001) {
        map.set(placement.id, 'paid');
      } else if (paid > 0) {
        map.set(placement.id, 'partial');
      } else {
        map.set(placement.id, 'outstanding');
      }
    });
    return map;
  }, [relevantPlacements, positionQueries]);
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
  const positionQueries = useQueries({
    queries: placements.map((p) => ({
      queryKey: placementFinancialPositionKey(p.id),
      queryFn: () => fetchPlacementFinancialPosition(p.id),
    })),
  });

  const isLoading = positionQueries.some((q) => q.isLoading);

  const summary = useMemo(() => {
    let totalDue = 0;
    let totalPaid = 0;
    placements.forEach((p, i) => {
      const position = positionQueries[i]?.data;
      totalDue += position?.cedant.currentObligation ?? 0;
      totalPaid += position?.cedant.netSettled ?? 0;
    });
    return { totalDue, totalPaid };
  }, [placements, positionQueries]);

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
            pmt.status === 'BANK_CONFIRMED' &&
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
            pmt.status === 'BANK_CONFIRMED' &&
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

  const positionQueries = useQueries({
    queries: closingPlacements.map((p) => ({
      queryKey: placementFinancialPositionKey(p.id),
      queryFn: () => fetchPlacementFinancialPosition(p.id),
    })),
  });

  return useMemo(() => {
    const counts = new Map<string, number>();
    closingPlacements.forEach((placement, i) => {
      const position = positionQueries[i]?.data;
      const due = position?.cedant.currentObligation ?? 0;
      const outstanding = position?.cedant.outstanding ?? 0;
      if (due > 0 && outstanding > 0.0001) {
        counts.set(placement.cedant.id, (counts.get(placement.cedant.id) ?? 0) + 1);
      }
    });
    return counts;
  }, [closingPlacements, positionQueries]);
}
