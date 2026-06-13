import { useMemo } from 'react';
import { useFacultatives } from '@/hooks/reinsurance/useFacultatives';
import { useCurrencies } from '@/hooks/reinsurance/useCurrencies';
import { Facultative, Currency } from '@/types/reinsurance';
import { Period } from '@/components/atoms/PeriodToggle';

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
