import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useFacultatives } from '@/hooks/reinsurance/useFacultatives';
import { useCurrencies } from '@/hooks/reinsurance/useCurrencies';
import {
  Facultative,
  Currency,
  FacultativeStatus,
  PlacementPayment,
  PlacementClaim,
} from '@/types/reinsurance';
import { Period } from '@/components/atoms/PeriodToggle';

const CLOSING_STATUSES: FacultativeStatus[] = ['PARTIALLY_PLACED', 'PLACED', 'CLOSING', 'CLOSED'];

export interface DashboardStats {
  totalOffers: number;
  pendingOffers: number;
  closedOffers: number;
  acceptanceRate: number;
  trends: {
    totalOffers: number;
    pendingOffers: number;
    closedOffers: number;
    acceptanceRate: number;
  };
  previous: {
    totalOffers: number;
    pendingOffers: number;
    closedOffers: number;
    acceptanceRate: number;
  };
}

function periodBounds(period: Period, now: Date): { start: Date; prevStart: Date } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const dayOfWeek = now.getDay();
  const mondayOffset = (dayOfWeek + 6) % 7;

  switch (period) {
    case 'daily':
      return {
        start: new Date(y, m, d),
        prevStart: new Date(y, m, d - 1),
      };
    case 'weekly':
      return {
        start: new Date(y, m, d - mondayOffset),
        prevStart: new Date(y, m, d - mondayOffset - 7),
      };
    case 'monthly':
      return {
        start: new Date(y, m, 1),
        prevStart: new Date(y, m - 1, 1),
      };
    case 'yearly':
      return {
        start: new Date(y, 0, 1),
        prevStart: new Date(y - 1, 0, 1),
      };
  }
}

function computeStats(items: Facultative[]) {
  const total = items.length;
  const pending = items.filter((f) => ['DRAFT', 'MARKETING'].includes(f.status)).length;
  const closed = items.filter((f) =>
    ['PARTIALLY_PLACED', 'CLOSING', 'CLOSED'].includes(f.status),
  ).length;
  const accepted = items.filter((f) => ['PLACED', 'CLOSING', 'CLOSED'].includes(f.status)).length;
  const acceptanceRate = total > 0 ? (accepted / total) * 100 : 0;
  return { total, pending, closed, acceptanceRate };
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export interface FinancialStats {
  totalRisk: number;
  totalPremium: number;
  totalBrokerage: number;
  currencySymbol: string;
  trends: {
    totalRisk: number;
    totalPremium: number;
    totalBrokerage: number;
  };
  previous: {
    totalRisk: number;
    totalPremium: number;
    totalBrokerage: number;
  };
}

function getRate(currencies: Currency[], isoCode: string | null): number {
  if (!isoCode) return 1;
  const c = currencies.find((x) => x.isoCode === isoCode);
  return c?.exchangeRateToBase ? parseFloat(c.exchangeRateToBase) : 1;
}

function convertToTarget(
  value: number | null,
  sourceIso: string | null,
  currencies: Currency[],
  targetRate: number,
): number {
  if (value == null) return 0;
  const sourceRate = getRate(currencies, sourceIso);
  return (value * sourceRate) / targetRate;
}

function computeFinancials(items: Facultative[], currencies: Currency[], targetRate: number) {
  let totalRisk = 0;
  let totalPremium = 0;
  let totalBrokerage = 0;

  for (const f of items) {
    totalRisk += convertToTarget(f.sumInsured, f.currency, currencies, targetRate);
    totalPremium += convertToTarget(f.premium, f.currency, currencies, targetRate);

    if (f.premium != null) {
      const premiumInTarget = convertToTarget(f.premium, f.currency, currencies, targetRate);
      for (const p of f.participants) {
        if (p.status !== 'ACCEPTED' && p.status !== 'CLOSED') continue;
        const share = p.sharePercent != null ? parseFloat(p.sharePercent) : null;
        const fee = p.brokerageFee != null ? parseFloat(p.brokerageFee) : null;
        if (share == null || fee == null) continue;
        totalBrokerage += premiumInTarget * (share / 100) * (fee / 100);
      }
    }
  }

  return { totalRisk, totalPremium, totalBrokerage };
}

export function useReinsuranceFinancials({
  period,
  currency,
}: {
  period: Period;
  currency: string;
}): { data: FinancialStats; isLoading: boolean } {
  const { data: all = [], isLoading: loadingFac } = useFacultatives();
  const { data: currencies = [], isLoading: loadingCur } = useCurrencies();

  const stats = useMemo<FinancialStats>(() => {
    const now = new Date();
    const { start, prevStart } = periodBounds(period, now);

    const baseCurrency = currencies.find((c) => c.isBaseCurrency);
    const targetIso = currency || baseCurrency?.isoCode || '';
    const targetRate = getRate(currencies, targetIso);
    const targetCurrency = currencies.find((c) => c.isoCode === targetIso);
    const currencySymbol = targetCurrency?.symbol ?? targetIso;

    const filtered = all.filter((f) => {
      const t = new Date(f.createdAt);
      return t >= start && t <= now;
    });

    const prevFiltered = all.filter((f) => {
      const t = new Date(f.createdAt);
      return t >= prevStart && t < start;
    });

    const cur = computeFinancials(filtered, currencies, targetRate);
    const prev = computeFinancials(prevFiltered, currencies, targetRate);

    return {
      ...cur,
      currencySymbol,
      trends: {
        totalRisk: pctChange(cur.totalRisk, prev.totalRisk),
        totalPremium: pctChange(cur.totalPremium, prev.totalPremium),
        totalBrokerage: pctChange(cur.totalBrokerage, prev.totalBrokerage),
      },
      previous: {
        totalRisk: prev.totalRisk,
        totalPremium: prev.totalPremium,
        totalBrokerage: prev.totalBrokerage,
      },
    };
  }, [all, currencies, period, currency]);

  return { data: stats, isLoading: loadingFac || loadingCur };
}

const BASE = '/operations/reinsurance/placements';

export function useReinsurancePremiumPaidPct({
  period,
  currency,
}: {
  period: Period;
  currency: string;
}): { pct: number; isLoading: boolean } {
  const { data: all = [], isLoading: loadingFac } = useFacultatives();
  const { data: currencies = [], isLoading: loadingCur } = useCurrencies();

  const periodPlacements = useMemo(() => {
    const now = new Date();
    const { start } = periodBounds(period, now);
    return all.filter((f) => {
      const t = new Date(f.createdAt);
      return t >= start && t <= now && CLOSING_STATUSES.includes(f.status);
    });
  }, [all, period]);

  const paymentQueries = useQueries({
    queries: periodPlacements.map((p) => ({
      queryKey: ['reinsurance', 'placements', p.id, 'payments'] as const,
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  const pct = useMemo(() => {
    const baseCurrency = currencies.find((c) => c.isBaseCurrency);
    const targetIso = currency || baseCurrency?.isoCode || '';
    const targetRate = getRate(currencies, targetIso);

    let totalPremium = 0;
    let totalPaid = 0;

    periodPlacements.forEach((placement, i) => {
      const net =
        placement.premium != null && placement.facultativeOffer != null
          ? convertToTarget(
              (placement.facultativeOffer / 100) *
                placement.premium *
                (placement.commission != null ? 1 - placement.commission / 100 : 1),
              placement.currency,
              currencies,
              targetRate,
            )
          : 0;
      totalPremium += net;

      const payments = paymentQueries[i]?.data ?? [];
      const paid = payments
        .filter((p) => p.status === 'RECORDED')
        .reduce(
          (sum, p) =>
            sum + convertToTarget(parseFloat(p.amount), p.currency, currencies, targetRate),
          0,
        );
      totalPaid += paid;
    });

    return totalPremium > 0 ? Math.min((totalPaid / totalPremium) * 100, 100) : 0;
  }, [periodPlacements, paymentQueries, currencies, currency]);

  const isLoading = loadingFac || loadingCur || paymentQueries.some((q) => q.isLoading);

  return { pct, isLoading };
}

export function useReinsuranceDashboard({ period }: { period: Period }) {
  const { data: all = [], isLoading } = useFacultatives();

  const stats = useMemo<DashboardStats>(() => {
    const now = new Date();
    const { start, prevStart } = periodBounds(period, now);

    const current = all.filter((f) => {
      const t = new Date(f.createdAt);
      return t >= start && t <= now;
    });

    const previous = all.filter((f) => {
      const t = new Date(f.createdAt);
      return t >= prevStart && t < start;
    });

    const cur = computeStats(current);
    const prev = computeStats(previous);

    return {
      totalOffers: cur.total,
      pendingOffers: cur.pending,
      closedOffers: cur.closed,
      acceptanceRate: cur.acceptanceRate,
      trends: {
        totalOffers: pctChange(cur.total, prev.total),
        pendingOffers: pctChange(cur.pending, prev.pending),
        closedOffers: pctChange(cur.closed, prev.closed),
        acceptanceRate: pctChange(cur.acceptanceRate, prev.acceptanceRate),
      },
      previous: {
        totalOffers: prev.total,
        pendingOffers: prev.pending,
        closedOffers: prev.closed,
        acceptanceRate: prev.acceptanceRate,
      },
    };
  }, [all, period]);

  return { data: stats, isLoading };
}

const ACTIVE_CLAIM_STATUSES = [
  'DRAFT',
  'NOTIFIED',
  'RESERVED',
  'PARTIALLY_SETTLED',
  'SETTLED',
  'CLOSED',
] as const;

export function useReinsuranceClaimStats({
  period,
  currency,
}: {
  period: Period;
  currency: string;
}): {
  totalClaims: number;
  totalAmount: number;
  prevTotalAmount: number;
  trend: number;
  paidPct: number;
  isLoading: boolean;
} {
  const { data: all = [], isLoading: loadingFac } = useFacultatives();
  const { data: currencies = [], isLoading: loadingCur } = useCurrencies();

  const eligiblePlacements = useMemo(
    () => all.filter((f) => CLOSING_STATUSES.includes(f.status)),
    [all],
  );

  const claimQueries = useQueries({
    queries: eligiblePlacements.map((p) => ({
      queryKey: ['reinsurance', 'placements', p.id, 'claims'] as const,
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/claims`);
        return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
      },
    })),
  });

  const result = useMemo(() => {
    const now = new Date();
    const { start, prevStart } = periodBounds(period, now);
    const baseCurrency = currencies.find((c) => c.isBaseCurrency);
    const targetIso = currency || baseCurrency?.isoCode || '';
    const targetRate = getRate(currencies, targetIso);

    let totalClaims = 0;
    let totalAmount = 0;
    let prevTotalAmount = 0;
    let paidAmount = 0;

    claimQueries.forEach((query) => {
      const claims = (query.data ?? []) as PlacementClaim[];

      for (const claim of claims) {
        if (!ACTIVE_CLAIM_STATUSES.includes(claim.status as (typeof ACTIVE_CLAIM_STATUSES)[number]))
          continue;

        const t = new Date(claim.createdAt);
        const estimated = convertToTarget(
          parseFloat(claim.estimatedLossAmount),
          claim.currency,
          currencies,
          targetRate,
        );
        const final =
          claim.finalLossAmount != null
            ? convertToTarget(
                parseFloat(claim.finalLossAmount),
                claim.currency,
                currencies,
                targetRate,
              )
            : null;

        if (t >= start && t <= now) {
          totalClaims += 1;
          totalAmount += estimated;
          if (claim.status === 'SETTLED' || claim.status === 'CLOSED') {
            paidAmount += final ?? estimated;
          }
        } else if (t >= prevStart && t < start) {
          prevTotalAmount += estimated;
        }
      }
    });

    return {
      totalClaims,
      totalAmount,
      prevTotalAmount,
      trend: pctChange(totalAmount, prevTotalAmount),
      paidPct: totalAmount > 0 ? Math.min((paidAmount / totalAmount) * 100, 100) : 0,
    };
  }, [claimQueries, currencies, currency, period]);

  const isLoading = loadingFac || loadingCur || claimQueries.some((q) => q.isLoading);

  return { ...result, isLoading };
}

export function useReinsuranceClaimRatio({
  period,
  currency,
}: {
  period: Period;
  currency: string;
}): { ratio: number; trend: number; prevRatio: number; isLoading: boolean } {
  const { data: all = [], isLoading: loadingFac } = useFacultatives();
  const { data: currencies = [], isLoading: loadingCur } = useCurrencies();

  const eligiblePlacements = useMemo(
    () => all.filter((f) => CLOSING_STATUSES.includes(f.status)),
    [all],
  );

  const claimQueries = useQueries({
    queries: eligiblePlacements.map((p) => ({
      queryKey: ['reinsurance', 'placements', p.id, 'claims'] as const,
      queryFn: async () => {
        const res = await api.get(`${BASE}/${p.id}/claims`);
        return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
      },
    })),
  });

  const result = useMemo(() => {
    const now = new Date();
    const { start, prevStart } = periodBounds(period, now);
    const baseCurrency = currencies.find((c) => c.isBaseCurrency);
    const targetIso = currency || baseCurrency?.isoCode || '';
    const targetRate = getRate(currencies, targetIso);

    const curPlacements = all.filter((f) => {
      const t = new Date(f.createdAt);
      return t >= start && t <= now;
    });
    const prevPlacements = all.filter((f) => {
      const t = new Date(f.createdAt);
      return t >= prevStart && t < start;
    });

    const { totalPremium: curPremium } = computeFinancials(curPlacements, currencies, targetRate);
    const { totalPremium: prevPremium } = computeFinancials(prevPlacements, currencies, targetRate);

    let curClaimAmount = 0;
    let prevClaimAmount = 0;

    claimQueries.forEach((query) => {
      const claims = (query.data ?? []) as PlacementClaim[];
      for (const claim of claims) {
        if (!ACTIVE_CLAIM_STATUSES.includes(claim.status as (typeof ACTIVE_CLAIM_STATUSES)[number]))
          continue;
        const t = new Date(claim.createdAt);
        const amount = convertToTarget(
          parseFloat(claim.estimatedLossAmount),
          claim.currency,
          currencies,
          targetRate,
        );
        if (t >= start && t <= now) {
          curClaimAmount += amount;
        } else if (t >= prevStart && t < start) {
          prevClaimAmount += amount;
        }
      }
    });

    const curRatio = curPremium > 0 ? (curClaimAmount / curPremium) * 100 : 0;
    const prevRatio = prevPremium > 0 ? (prevClaimAmount / prevPremium) * 100 : 0;

    return { ratio: curRatio, trend: pctChange(curRatio, prevRatio), prevRatio };
  }, [all, claimQueries, currencies, currency, period]);

  const isLoading = loadingFac || loadingCur || claimQueries.some((q) => q.isLoading);

  return { ...result, isLoading };
}
