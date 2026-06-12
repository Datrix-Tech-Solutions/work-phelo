'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { DashboardStatCard } from '@/components/molecules/reinsurance/stats/DashboardStatCard';
import { useReinsuranceFinancials } from '@/hooks';

const PERIOD_LABELS: Record<Period, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
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
  const periodLabel = PERIOD_LABELS[period];
  const sym = data.currencySymbol;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <DashboardStatCard
        label="Total Risk"
        value={fmtAmount(data.totalRisk, sym)}
        trend={data.trends.totalRisk}
        isLoading={isLoading}
        periodLabel={periodLabel}
      />
      <DashboardStatCard
        label="Total Premium"
        value={fmtAmount(data.totalPremium, sym)}
        trend={data.trends.totalPremium}
        isLoading={isLoading}
        periodLabel={periodLabel}
      />
      <DashboardStatCard
        label="Total Brokerage"
        value={fmtAmount(data.totalBrokerage, sym)}
        trend={data.trends.totalBrokerage}
        isLoading={isLoading}
        periodLabel={periodLabel}
      />
    </div>
  );
}
