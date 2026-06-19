'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { DashboardStatCard } from '@/components/molecules/reinsurance/stats/DashboardStatCard';
import { useReinsuranceDashboard, useReinsuranceClaimRatio } from '@/hooks';

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

interface DashboardStatsRowProps {
  period: Period;
  currency: string;
}

export function DashboardStatsRow({ period, currency }: DashboardStatsRowProps) {
  const { data, isLoading } = useReinsuranceDashboard({ period });
  const {
    ratio: claimRatio,
    trend: claimRatioTrend,
    prevRatio,
    isLoading: loadingRatio,
  } = useReinsuranceClaimRatio({ period, currency });
  const periodLabel = PERIOD_LABELS[period];
  const prevLabel = PERIOD_PREV_LABELS[period];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <DashboardStatCard
        label="Total Offers"
        value={data.totalOffers}
        trend={data.trends.totalOffers}
        trendTooltip={`${prevLabel}: ${data.previous.totalOffers}`}
        isLoading={isLoading}
        periodLabel={periodLabel}
        subtext={`${data.pendingOffers} pending`}
      />
      {/* <DashboardStatCard
        label="Pending Offers"
        value={data.pendingOffers}
        trend={data.trends.pendingOffers}
        trendTooltip={`${prevLabel}: ${data.previous.pendingOffers}`}
        isLoading={isLoading}
        periodLabel={periodLabel}
      /> */}
      <DashboardStatCard
        label="Closed Offers"
        value={data.closedOffers}
        trend={data.trends.closedOffers}
        trendTooltip={`${prevLabel}: ${data.previous.closedOffers}`}
        isLoading={isLoading}
        periodLabel={periodLabel}
        subtext={`${data.acceptanceRate.toFixed(1)}% Closing Rate`}
      />
      <DashboardStatCard
        label="Claim Ratio"
        value={`${claimRatio.toFixed(1)}%`}
        trend={claimRatioTrend}
        trendTooltip={`${prevLabel}: ${prevRatio.toFixed(1)}%`}
        isLoading={loadingRatio}
        periodLabel={periodLabel}
      />
    </div>
  );
}
