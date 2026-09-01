import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useFacultatives } from './useFacultatives';
import { useCurrencies } from './useCurrencies';
import {
  CLOSING_STATUSES,
  fetchPlacementFinancialPosition,
  fetchPlacementPayments,
  paymentsKey,
  placementFinancialPositionKey,
} from './usePayments';
import { Currency } from '@/types/reinsurance';
import {
  cedantPaymentStatusFromPosition,
  CedantPaymentStatus,
  pendingPremiumReceived,
} from '@/lib/reinsurance/placementStatus';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

function getRate(currencies: Currency[], isoCode: string | null): number {
  if (!isoCode) return 1;
  const c = currencies.find((x) => x.isoCode === isoCode);
  return c?.exchangeRateToBase ? parseFloat(c.exchangeRateToBase) : 1;
}

function convertToTarget(
  value: number,
  sourceIso: string | null,
  currencies: Currency[],
  targetRate: number,
): number {
  const sourceRate = getRate(currencies, sourceIso);
  return (value * sourceRate) / targetRate;
}

export interface PremiumsReportParams {
  /** Restricts to placements whose inceptionDate (period of insurance start) falls in [startDate, endDate]. */
  startDate?: string;
  endDate?: string;
  riskTypeId?: string;
  currency?: string;
  paymentStatus?: CedantPaymentStatus;
  cedantIds?: string[];
}

export interface PremiumReportRow {
  id: string;
  policyNumber: string;
  title: string;
  cedantName: string;
  currency: string | null;
  due: number;
  paid: number;
  outstanding: number;
  pending: number;
  paymentStatus: CedantPaymentStatus;
  inceptionDate: string | null;
}

export interface PremiumsReportSummary {
  totalCollected: number;
  outstanding: number;
  currencySymbol: string;
}

export function usePremiumsReport(
  params: PremiumsReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: PremiumReportRow[];
  summary: PremiumsReportSummary;
  isLoading: boolean;
} {
  const enabled = options.enabled ?? true;
  const { data: placements = [], isLoading: loadingPlacements } = useFacultatives();
  const { data: currencies = [], isLoading: loadingCurrencies } = useCurrencies();

  const closingRows = useMemo(
    () => (enabled ? placements.filter((p) => CLOSING_STATUSES.includes(p.status)) : []),
    [placements, enabled],
  );

  const filtered = useMemo(() => {
    const from = params.startDate ? new Date(params.startDate) : null;
    const to = params.endDate ? new Date(params.endDate) : null;
    if (to) to.setHours(23, 59, 59, 999);
    const cedantIds = params.cedantIds?.length ? new Set(params.cedantIds) : null;

    return closingRows.filter((p) => {
      if (from || to) {
        if (!p.inceptionDate) return false;
        const inception = new Date(p.inceptionDate);
        if (from && inception < from) return false;
        if (to && inception > to) return false;
      }
      if (params.riskTypeId && p.riskTypeId !== params.riskTypeId) return false;
      if (params.currency && p.currency !== params.currency) return false;
      if (cedantIds && !cedantIds.has(p.cedant.id)) return false;
      return true;
    });
  }, [
    closingRows,
    params.startDate,
    params.endDate,
    params.riskTypeId,
    params.currency,
    params.cedantIds,
  ]);

  const positionQueries = useQueries({
    queries: filtered.map((p) => ({
      queryKey: placementFinancialPositionKey(p.id),
      queryFn: () => fetchPlacementFinancialPosition(p.id),
    })),
  });
  const paymentQueries = useQueries({
    queries: filtered.map((p) => ({
      queryKey: paymentsKey(p.id),
      queryFn: () => fetchPlacementPayments(p.id),
    })),
  });

  const targetIso = useMemo(() => {
    if (params.currency) return params.currency;
    return currencies.find((c) => c.isBaseCurrency)?.isoCode ?? '';
  }, [params.currency, currencies]);
  const targetRate = getRate(currencies, targetIso);

  const allRows = useMemo<PremiumReportRow[]>(() => {
    return filtered.map((p, i) => {
      const position = positionQueries[i]?.data;
      const payments = paymentQueries[i]?.data ?? [];
      const due = position?.cedant.currentObligation ?? 0;
      const paid = position?.cedant.netSettled ?? 0;
      const outstanding = position?.cedant.outstanding ?? 0;
      const pending = pendingPremiumReceived(payments);
      return {
        id: p.id,
        policyNumber: displayPolicyNumber(p.policyNumber),
        title: p.title,
        cedantName: p.cedant.name,
        currency: position?.currency ?? p.currency,
        due,
        paid,
        outstanding,
        pending,
        paymentStatus: cedantPaymentStatusFromPosition(due, paid, outstanding, pending),
        inceptionDate: p.inceptionDate,
      };
    });
  }, [filtered, positionQueries, paymentQueries]);

  const rows = useMemo(
    () =>
      params.paymentStatus
        ? allRows.filter((r) => r.paymentStatus === params.paymentStatus)
        : allRows,
    [allRows, params.paymentStatus],
  );

  const summary = useMemo<PremiumsReportSummary>(() => {
    const targetCurrency = currencies.find((c) => c.isoCode === targetIso);
    return {
      totalCollected: rows.reduce(
        (sum, r) => sum + convertToTarget(r.paid, r.currency, currencies, targetRate),
        0,
      ),
      outstanding: rows.reduce(
        (sum, r) => sum + convertToTarget(r.outstanding, r.currency, currencies, targetRate),
        0,
      ),
      currencySymbol: targetCurrency?.symbol ?? targetIso,
    };
  }, [rows, currencies, targetIso, targetRate]);

  const isLoading =
    loadingPlacements ||
    loadingCurrencies ||
    positionQueries.some((q) => q.isLoading) ||
    paymentQueries.some((q) => q.isLoading);

  return { rows, summary, isLoading };
}
