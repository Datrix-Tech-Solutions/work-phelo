'use client';

import { useMemo } from 'react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { PeriodBarChart } from '@/components/molecules/shared/PeriodBarChart';
import { useTransportTrend } from '@/hooks/marketing/useTransportDashboard';
import { periodSeriesBuckets } from '@/lib/periodSeries';

const REQUESTED_COLOR = '#eb6834';
const COMPLETED_COLOR = '#1baf7a';

const SUBTITLES: Record<Period, string> = {
  daily: 'This week',
  weekly: 'Weeks of this month',
  monthly: 'Last 6 months',
  quarterly: 'Quarters of this year',
  yearly: 'Last 6 years',
};

const count = (value: number | null) => (value === null ? '' : String(value));

interface Props {
  period: Period;
  className?: string;
}

/** Requests raised against trips completed, for the ranges that suit the period filter. */
export function TransportRequestsChart({ period, className }: Props) {
  const buckets = useMemo(() => periodSeriesBuckets(period, { calendar: true }), [period]);
  const { data, isLoading, isError } = useTransportTrend(buckets);

  return (
    <PeriodBarChart
      title="Requests vs Completed Trips"
      subtitle={SUBTITLES[period]}
      buckets={buckets}
      series={[
        {
          label: 'Requested',
          color: REQUESTED_COLOR,
          data: buckets.map((_, i) => data?.[i]?.requested ?? 0),
          valueFormatter: count,
        },
        {
          label: 'Completed',
          color: COMPLETED_COLOR,
          data: buckets.map((_, i) => data?.[i]?.completed ?? 0),
          valueFormatter: count,
        },
      ]}
      isLoading={isLoading}
      isError={isError}
      errorText="Requests could not be loaded."
      emptyText="No requests in this range."
      wholeNumbers
      className={className}
    />
  );
}
