'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { DashboardStatCard } from '@/components/molecules/reinsurance/stats/DashboardStatCard';
import {
  useReinsuranceFinancials,
  useReinsurancePremiumPaidPct,
  useReinsuranceClaimStats,
} from '@/hooks';

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

const PERIOD_PREV_LABELS: Record<Period, string> = {
  daily: 'Yesterday',
  weekly: 'Last week',
  monthly: 'Last month',
  yearly: 'Last year',
};

function fmtAmount(value: number, symbol: string): string {
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= 1_000_000_000) {
    formatted = `${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (abs >= 1_000_000) {
    formatted = `${(value / 1_000_000).toFixed(2)}M`;
  } else if (abs >= 1_000) {
    formatted = `${(value / 1_000).toFixed(2)}K`;
  } else {
    formatted = value.toFixed(2);
  }
  return symbol ? `${symbol} ${formatted}` : formatted;
}

interface FinancialStatsRowProps {
  period: Period;
  currency: string;
}

export function FinancialStatsRow({ period, currency }: FinancialStatsRowProps) {
  const { data, isLoading } = useReinsuranceFinancials({ period, currency });
  const { pct: paidPct, isLoading: loadingPct } = useReinsurancePremiumPaidPct({
    period,
    currency,
  });
  const {
    totalAmount: claimAmount,
    prevTotalAmount: prevClaimAmount,
    trend: claimTrend,
    paidPct: claimPaidPct,
    isLoading: loadingClaims,
  } = useReinsuranceClaimStats({ period, currency });
  const periodLabel = PERIOD_LABELS[period];
  const prevLabel = PERIOD_PREV_LABELS[period];
  const sym = data.currencySymbol;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <DashboardStatCard
        label="Total Risk"
        value={fmtAmount(data.totalRisk, sym)}
        trend={data.trends.totalRisk}
        trendTooltip={`${prevLabel}: ${fmtAmount(data.previous.totalRisk, sym)}`}
        isLoading={isLoading}
        periodLabel={periodLabel}
      />
      <DashboardStatCard
        label="Total Premium"
        value={fmtAmount(data.totalPremium, sym)}
        trend={data.trends.totalPremium}
        trendTooltip={`${prevLabel}: ${fmtAmount(data.previous.totalPremium, sym)}`}
        isLoading={isLoading || loadingPct}
        periodLabel={periodLabel}
        subtext={`${paidPct.toFixed(1)}% paid`}
      />
      <DashboardStatCard
        label="Total Brokerage"
        value={fmtAmount(data.totalBrokerage, sym)}
        trend={data.trends.totalBrokerage}
        trendTooltip={`${prevLabel}: ${fmtAmount(data.previous.totalBrokerage, sym)}`}
        isLoading={isLoading}
        periodLabel={periodLabel}
      />
      <DashboardStatCard
        label="Total Claims"
        value={fmtAmount(claimAmount, sym)}
        trend={claimTrend}
        trendTooltip={`${prevLabel}: ${fmtAmount(prevClaimAmount, sym)}`}
        isLoading={loadingClaims}
        periodLabel={periodLabel}
        subtext={`${claimPaidPct.toFixed(1)}% settled`}
      />
    </div>
  );
}
