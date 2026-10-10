'use client';

import { useMemo } from 'react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { PeriodBarChart } from '@/components/molecules/shared/PeriodBarChart';
import { useMarketingGrowth } from '@/hooks/marketing/useMarketingGrowth';
import { periodSeriesBuckets } from '@/lib/periodSeries';

const PROSPECT_COLOR = '#eb6834';
const CLIENT_COLOR = '#2a78d6';

const SUBTITLES: Record<Period, string> = {
  daily: 'This week, Monday to Sunday',
  weekly: 'Weeks of this month',
  monthly: 'This month and the previous 5',
  quarterly: 'Quarters of this year',
  yearly: 'This year and the previous 5',
};

const count = (value: number | null) => (value === null ? '' : String(value));

interface ClientsProspectsChartProps {
  period: Period;
  className?: string;
}

/** New prospects against new clients as paired bars, for the ranges that suit the period filter. */
export function ClientsProspectsChart({ period, className }: ClientsProspectsChartProps) {
  const buckets = useMemo(() => periodSeriesBuckets(period, { calendar: true }), [period]);
  const { data, isLoading, isError } = useMarketingGrowth(buckets);

  return (
    <PeriodBarChart
      title="Prospects vs Clients"
      subtitle={SUBTITLES[period]}
      buckets={buckets}
      series={[
        {
          label: 'New prospects',
          color: PROSPECT_COLOR,
          data: buckets.map((_, i) => data?.[i]?.newProspects ?? 0),
          valueFormatter: count,
        },
        {
          label: 'New clients',
          color: CLIENT_COLOR,
          data: buckets.map((_, i) => data?.[i]?.newClients ?? 0),
          valueFormatter: count,
        },
      ]}
      isLoading={isLoading}
      isError={isError}
      errorText="Prospects and clients could not be loaded."
      emptyText="No new prospects or clients in this range."
      wholeNumbers
      className={className}
    />
  );
}
