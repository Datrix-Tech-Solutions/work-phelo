'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { DashboardStatCard } from '@/components/molecules/reinsurance/stats/DashboardStatCard';
import { useReinsuranceDashboard } from '@/hooks';

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
}

export function DashboardStatsRow({ period }: DashboardStatsRowProps) {
  const { data, isLoading } = useReinsuranceDashboard({ period });
  const periodLabel = PERIOD_LABELS[period];
  const prevLabel = PERIOD_PREV_LABELS[period];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <DashboardStatCard
        label="Total Offers"
        value={data.totalOffers}
        trend={data.trends.totalOffers}
        trendTooltip={`${prevLabel}: ${data.previous.totalOffers}`}
        isLoading={isLoading}
        periodLabel={periodLabel}
      />
      <DashboardStatCard
        label="Pending Offers"
        value={data.pendingOffers}
        trend={data.trends.pendingOffers}
        trendTooltip={`${prevLabel}: ${data.previous.pendingOffers}`}
        isLoading={isLoading}
        periodLabel={periodLabel}
      />
      <DashboardStatCard
        label="Closed Offers"
        value={data.closedOffers}
        trend={data.trends.closedOffers}
        trendTooltip={`${prevLabel}: ${data.previous.closedOffers}`}
        isLoading={isLoading}
        periodLabel={periodLabel}
      />
      <DashboardStatCard
        label="Acceptance Rate"
        value={`${data.acceptanceRate.toFixed(1)}%`}
        trend={data.trends.acceptanceRate}
        trendTooltip={`${prevLabel}: ${data.previous.acceptanceRate.toFixed(1)}%`}
        isLoading={isLoading}
        periodLabel={periodLabel}
      />
    </div>
  );
}
