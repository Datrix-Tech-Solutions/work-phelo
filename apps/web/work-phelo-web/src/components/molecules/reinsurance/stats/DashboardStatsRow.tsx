'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { Icons } from '@/components/atoms/icons';
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
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <KpiCard
        label="Total Offers"
        value={data.totalOffers}
        icon={Icons.FileCheck2}
        iconColor="#2a78d6"
        trend={data.trends.totalOffers}
        trendTooltip={`${prevLabel}: ${data.previous.totalOffers}`}
        isLoading={isLoading}
        periodLabel={periodLabel}
      />
      <KpiCard
        label="Total Placed"
        value={data.placedOffers}
        icon={Icons.Handshake}
        iconColor="#0ea5e9"
        trend={data.trends.placedOffers}
        trendTooltip={`${prevLabel}: ${data.previous.placedOffers}`}
        isLoading={isLoading}
        periodLabel={periodLabel}
      />
      <KpiCard
        label="Partial Closed"
        value={data.partiallyClosedOffers}
        icon={Icons.CircleCheckBig}
        iconColor="#eda100"
        trend={data.trends.partiallyClosedOffers}
        trendTooltip={`${prevLabel}: ${data.previous.partiallyClosedOffers}`}
        isLoading={isLoading}
        periodLabel={periodLabel}
      />
      <KpiCard
        label="Closed"
        value={data.closedOffers}
        icon={Icons.CircleCheck}
        iconColor="#008300"
        trend={data.trends.closedOffers}
        trendTooltip={`${prevLabel}: ${data.previous.closedOffers}`}
        isLoading={isLoading}
        periodLabel={periodLabel}
      />
      <KpiCard
        label="Claim Ratio"
        value={`${claimRatio.toFixed(1)}%`}
        icon={Icons.Activity}
        iconColor="#4a3aa7"
        trend={claimRatioTrend}
        trendTooltip={`${prevLabel}: ${prevRatio.toFixed(1)}%`}
        isLoading={loadingRatio}
        periodLabel={periodLabel}
      />
    </div>
  );
}
