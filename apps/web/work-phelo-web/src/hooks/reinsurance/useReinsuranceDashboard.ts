import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCurrencies } from '@/hooks/reinsurance/useCurrencies';
import { Period } from '@/components/atoms/PeriodToggle';

const DASHBOARD_BASE = '/operations/reinsurance/dashboard';
const DASHBOARD_STALE_TIME_MS = 60_000;

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

interface DashboardOverviewSummary {
  activePlacements: number;
  closedPlacements: number;
  lockedPlacements: number;
  endorsementsPending: number;
  claimsOpen: number;
  warnings: string[];
}

interface DashboardPlacementsSummary {
  placementCount: number;
  totalCapacity: number;
  acceptedCapacity: number;
  pendingCapacity: number;
  confirmedClosingCapacity: number;
  placementsMissingTarget: number;
  warnings: string[];
}

interface DashboardCurrencyBreakdown {
  currency: string;
  amount: number;
}

interface DashboardFinancialsSummary {
  grossPremium: number;
  netPremium: number;
  brokerage: number;
  commission: number;
  paid: number;
  outstanding: number;
  grossPremiumByCurrency: DashboardCurrencyBreakdown[];
  netPremiumByCurrency: DashboardCurrencyBreakdown[];
  paidByCurrency: DashboardCurrencyBreakdown[];
  outstandingByCurrency: DashboardCurrencyBreakdown[];
  noteCounts: {
    draft: number;
    issued: number;
    void: number;
  };
  warnings: string[];
}

interface DashboardClaimsSummary {
  claimsCount: number;
  openClaims: number;
  estimatedLoss: number;
  finalLoss: number;
  allocatedLiability: number;
  cashCallsIssued: number;
  cashCallsPaid: number;
  cashCallsPending: number;
  cashCallCounts: {
    draft: number;
    issued: number;
    paid: number;
  };
  warnings: string[];
}

const EMPTY_OVERVIEW: DashboardOverviewSummary = {
  activePlacements: 0,
  closedPlacements: 0,
  lockedPlacements: 0,
  endorsementsPending: 0,
  claimsOpen: 0,
  warnings: [],
};

const EMPTY_PLACEMENTS: DashboardPlacementsSummary = {
  placementCount: 0,
  totalCapacity: 0,
  acceptedCapacity: 0,
  pendingCapacity: 0,
  confirmedClosingCapacity: 0,
  placementsMissingTarget: 0,
  warnings: [],
};

const EMPTY_FINANCIALS: DashboardFinancialsSummary = {
  grossPremium: 0,
  netPremium: 0,
  brokerage: 0,
  commission: 0,
  paid: 0,
  outstanding: 0,
  grossPremiumByCurrency: [],
  netPremiumByCurrency: [],
  paidByCurrency: [],
  outstandingByCurrency: [],
  noteCounts: {
    draft: 0,
    issued: 0,
    void: 0,
  },
  warnings: [],
};

const EMPTY_CLAIMS: DashboardClaimsSummary = {
  claimsCount: 0,
  openClaims: 0,
  estimatedLoss: 0,
  finalLoss: 0,
  allocatedLiability: 0,
  cashCallsIssued: 0,
  cashCallsPaid: 0,
  cashCallsPending: 0,
  cashCallCounts: {
    draft: 0,
    issued: 0,
    paid: 0,
  },
  warnings: [],
};

function useDashboardOverviewSummary() {
  return useQuery({
    queryKey: ['reinsurance', 'dashboard', 'overview'] as const,
    queryFn: async () => {
      const res = await api.get(`${DASHBOARD_BASE}/overview`);
      return res.data as DashboardOverviewSummary;
    },
    staleTime: DASHBOARD_STALE_TIME_MS,
  });
}

function useDashboardPlacementsSummary() {
  return useQuery({
    queryKey: ['reinsurance', 'dashboard', 'placements'] as const,
    queryFn: async () => {
      const res = await api.get(`${DASHBOARD_BASE}/placements`);
      return res.data as DashboardPlacementsSummary;
    },
    staleTime: DASHBOARD_STALE_TIME_MS,
  });
}

function useDashboardFinancialsSummary() {
  return useQuery({
    queryKey: ['reinsurance', 'dashboard', 'financials'] as const,
    queryFn: async () => {
      const res = await api.get(`${DASHBOARD_BASE}/financials`);
      return res.data as DashboardFinancialsSummary;
    },
    staleTime: DASHBOARD_STALE_TIME_MS,
  });
}

function useDashboardClaimsSummary() {
  return useQuery({
    queryKey: ['reinsurance', 'dashboard', 'claims'] as const,
    queryFn: async () => {
      const res = await api.get(`${DASHBOARD_BASE}/claims`);
      return res.data as DashboardClaimsSummary;
    },
    staleTime: DASHBOARD_STALE_TIME_MS,
  });
}

function currencyAmount(
  breakdown: DashboardCurrencyBreakdown[],
  currency: string,
  fallback: number,
): number {
  if (!currency) return fallback;
  return breakdown.find((item) => item.currency === currency)?.amount ?? 0;
}

function useDashboardCurrency(currency: string) {
  const { data: currencies = [], isLoading } = useCurrencies();
  const baseCurrency = currencies.find((item) => item.isBaseCurrency);
  const targetIso = currency || baseCurrency?.isoCode || '';
  const targetCurrency = currencies.find((item) => item.isoCode === targetIso);
  return {
    currency: targetIso,
    symbol: targetCurrency?.symbol ?? targetIso,
    isLoading,
  };
}

export function useReinsuranceFinancials({
  period: _period,
  currency,
}: {
  period: Period;
  currency: string;
}): { data: FinancialStats; isLoading: boolean } {
  void _period;
  const { data: financials = EMPTY_FINANCIALS, isLoading: loadingFinancials } =
    useDashboardFinancialsSummary();
  const { data: placements = EMPTY_PLACEMENTS, isLoading: loadingPlacements } =
    useDashboardPlacementsSummary();
  const {
    currency: targetCurrency,
    symbol,
    isLoading: loadingCurrency,
  } = useDashboardCurrency(currency);

  const grossPremium = currencyAmount(
    financials.grossPremiumByCurrency,
    targetCurrency,
    financials.grossPremium,
  );
  return {
    data: {
      // Backend does not yet expose total sum insured by currency; use confirmed capacity as the
      // least misleading backend-truth proxy until the dashboard API adds a dedicated risk total.
      totalRisk: placements.confirmedClosingCapacity,
      totalPremium: grossPremium,
      totalBrokerage: financials.brokerage,
      currencySymbol: symbol,
      trends: {
        totalRisk: 0,
        totalPremium: 0,
        totalBrokerage: 0,
      },
      previous: {
        totalRisk: 0,
        totalPremium: 0,
        totalBrokerage: 0,
      },
    },
    isLoading: loadingFinancials || loadingPlacements || loadingCurrency,
  };
}

export function useReinsurancePremiumPaidPct({
  period: _period,
  currency,
}: {
  period: Period;
  currency: string;
}): { pct: number; isLoading: boolean } {
  void _period;
  const { data: financials = EMPTY_FINANCIALS, isLoading } = useDashboardFinancialsSummary();
  const { currency: targetCurrency, isLoading: loadingCurrency } = useDashboardCurrency(currency);
  const netPremium = currencyAmount(
    financials.netPremiumByCurrency,
    targetCurrency,
    financials.netPremium,
  );
  const paid = currencyAmount(financials.paidByCurrency, targetCurrency, financials.paid);
  return {
    pct: netPremium > 0 ? Math.min((paid / netPremium) * 100, 100) : 0,
    isLoading: isLoading || loadingCurrency,
  };
}

export function useReinsuranceDashboard({ period: _period }: { period: Period }): {
  data: DashboardStats;
  isLoading: boolean;
} {
  void _period;
  const { data: overview = EMPTY_OVERVIEW, isLoading: loadingOverview } =
    useDashboardOverviewSummary();
  const { data: placements = EMPTY_PLACEMENTS, isLoading: loadingPlacements } =
    useDashboardPlacementsSummary();

  const totalOffers = placements.placementCount;
  const closedOffers = overview.closedPlacements;
  const pendingOffers = Math.max(0, totalOffers - closedOffers);
  const acceptanceRate =
    placements.totalCapacity > 0
      ? Math.min((placements.confirmedClosingCapacity / placements.totalCapacity) * 100, 100)
      : 0;

  return {
    data: {
      totalOffers,
      pendingOffers,
      closedOffers,
      acceptanceRate,
      trends: {
        totalOffers: 0,
        pendingOffers: 0,
        closedOffers: 0,
        acceptanceRate: 0,
      },
      previous: {
        totalOffers: 0,
        pendingOffers: 0,
        closedOffers: 0,
        acceptanceRate: 0,
      },
    },
    isLoading: loadingOverview || loadingPlacements,
  };
}

export function useReinsuranceClaimStats({
  period: _period,
  currency: _currency,
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
  void _period;
  void _currency;
  const { data: claims = EMPTY_CLAIMS, isLoading } = useDashboardClaimsSummary();

  return {
    totalClaims: claims.claimsCount,
    totalAmount: claims.estimatedLoss,
    prevTotalAmount: 0,
    trend: 0,
    paidPct:
      claims.cashCallsIssued > 0
        ? Math.min((claims.cashCallsPaid / claims.cashCallsIssued) * 100, 100)
        : 0,
    isLoading,
  };
}

export function useReinsuranceClaimRatio({
  period: _period,
  currency,
}: {
  period: Period;
  currency: string;
}): { ratio: number; trend: number; prevRatio: number; isLoading: boolean } {
  void _period;
  const { data: financials = EMPTY_FINANCIALS, isLoading: loadingFinancials } =
    useDashboardFinancialsSummary();
  const { data: claims = EMPTY_CLAIMS, isLoading: loadingClaims } = useDashboardClaimsSummary();
  const { currency: targetCurrency, isLoading: loadingCurrency } = useDashboardCurrency(currency);
  const grossPremium = currencyAmount(
    financials.grossPremiumByCurrency,
    targetCurrency,
    financials.grossPremium,
  );
  const ratio = grossPremium > 0 ? Math.min((claims.estimatedLoss / grossPremium) * 100, 100) : 0;

  return {
    ratio,
    trend: 0,
    prevRatio: 0,
    isLoading: loadingFinancials || loadingClaims || loadingCurrency,
  };
}
