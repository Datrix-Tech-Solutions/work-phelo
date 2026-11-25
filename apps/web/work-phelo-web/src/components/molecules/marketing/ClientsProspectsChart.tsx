'use client';

import { useMemo, useState } from 'react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { PeriodBarChart } from '@/components/molecules/shared/PeriodBarChart';
import { GrowthBarPanel, type GrowthBar } from '@/components/organisms/marketing/GrowthBarPanel';
import { useMarketingGrowth } from '@/hooks/marketing/useMarketingGrowth';
import { periodSeriesBuckets } from '@/lib/periodSeries';

const PROSPECT_COLOR = '#eb6834';
const CLIENT_COLOR = '#2a78d6';

const SUBTITLES: Record<Period, string> = {
  daily: 'This week',
  weekly: 'Weeks of this month',
  monthly: 'Last 6 months',
  quarterly: 'Quarters of this year',
  yearly: 'Last 6 years',
};

const count = (value: number | null) => (value === null ? '' : String(value));

interface ClientsProspectsChartProps {
  period: Period;
  userId?: string;
  className?: string;
}

/** New prospects against new clients as paired bars, for the ranges that suit the period filter. */
export function ClientsProspectsChart({ period, userId, className }: ClientsProspectsChartProps) {
  const buckets = useMemo(() => periodSeriesBuckets(period, { calendar: true }), [period]);
  const { data, isLoading, isError } = useMarketingGrowth(buckets, userId);

  // Open state is kept apart from the bar, so the panel keeps its content while it slides shut.
  const [bar, setBar] = useState<GrowthBar | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      <PeriodBarChart
        onBarClick={(bucketIndex, seriesIndex) => {
          // The series are listed below as prospects, then clients.
          setBar({
            kind: seriesIndex === 0 ? 'prospects' : 'clients',
            bucket: buckets[bucketIndex],
          });
          setPanelOpen(true);
        }}
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
      <GrowthBarPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        bar={bar}
        userId={userId}
      />
    </>
  );
}
