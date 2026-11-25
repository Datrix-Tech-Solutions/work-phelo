'use client';

import { useMemo, useState } from 'react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { PeriodBarChart } from '@/components/molecules/shared/PeriodBarChart';
import { TransportTripsPanel } from '@/components/organisms/marketing/TransportTripsPanel';
import { useTransportTrend } from '@/hooks/marketing/useTransportDashboard';
import { periodSeriesBuckets, type SeriesBucket } from '@/lib/periodSeries';

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

  // Open state is kept apart from the bar, so the panel keeps its content while it slides shut.
  const [bar, setBar] = useState<{ list: 'REQUESTED' | 'COMPLETED'; bucket: SeriesBucket } | null>(
    null,
  );
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      <PeriodBarChart
        onBarClick={(bucketIndex, seriesIndex) => {
          // The series are listed below as requested, then completed.
          setBar({
            list: seriesIndex === 0 ? 'REQUESTED' : 'COMPLETED',
            bucket: buckets[bucketIndex],
          });
          setPanelOpen(true);
        }}
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
      {/* Always mounted, so it slides in the first time too. */}
      <TransportTripsPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        list={bar?.list ?? 'REQUESTED'}
        range={bar?.bucket ?? buckets[0]}
        rangeLabel={bar?.bucket.detail ?? ''}
      />
    </>
  );
}
