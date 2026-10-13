'use client';

import { useState } from 'react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { Icons } from '@/components/atoms/icons';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { GaugeOverviewCard } from '@/components/molecules/shared/GaugeOverviewCard';
import { useMarketingTargetsOverview } from '@/hooks/marketing/useMarketingTargetsOverview';
import { useMarketingDashboard } from '@/hooks/marketing/useMarketingDashboard';

const SUBTITLES: Record<Period, string> = {
  daily: 'Targets running today',
  weekly: 'Targets running this week',
  monthly: 'Targets running this month',
  quarterly: 'Targets running this quarter',
  yearly: 'Targets running this year',
};

const compact = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
};

interface TargetsOverviewCardProps {
  period: Period;
  year: number;
  className?: string;
}

/** Total target for the period against what has been achieved, as a gauge with selectable figures. */
export function TargetsOverviewCard({ period, year, className }: TargetsOverviewCardProps) {
  const { data, isLoading: loadingSummary } = useMarketingDashboard(period, year);
  const [repId, setRepId] = useState('');
  const { data: overview, isLoading: loadingTargets } = useMarketingTargetsOverview(
    period,
    year,
    repId || undefined,
  );
  const isLoading = loadingSummary || loadingTargets;

  // A rep picked for one period may have no target in another: fall back to everyone then.
  const reps = overview?.reps ?? [];
  const selectedRep = reps.some((rep) => rep.userId === repId) ? repId : '';
  const targets = overview;
  const currency = data?.currency ?? '';
  const target = Number(targets?.target ?? 0);
  const achieved = targets?.achieved == null ? null : Number(targets.achieved);
  const remaining = targets?.remaining == null ? null : Number(targets.remaining);
  const money = (value: number | null) =>
    value === null ? '—' : `${currency} ${compact(value)}`.trim();
  const count = targets?.count ?? 0;

  return (
    <GaugeOverviewCard
      title="Targets Overview"
      subtitle={SUBTITLES[period]}
      className={className}
      headerAction={
        <div className="w-44">
          <SearchSelect
            placeholder="Sales rep"
            options={reps.map((rep) => ({ value: rep.userId, label: rep.name }))}
            value={selectedRep}
            onChange={setRepId}
            size="xs"
            showAllOption
            allLabel="All sales reps"
          />
        </div>
      }
      isLoading={isLoading}
      isEmpty={count === 0}
      emptyMessage="No targets set for this period."
      total={target}
      metrics={[
        {
          key: 'target',
          label: 'Total Target',
          icon: Icons.Target,
          color: '#4c8dff',
          value: target,
          display: money(target),
        },
        {
          key: 'achieved',
          label: 'Achieved',
          icon: Icons.CircleCheck,
          color: '#34d399',
          value: achieved,
          display: money(achieved),
        },
        {
          key: 'remaining',
          label: 'Remaining',
          icon: Icons.Timer,
          color: '#f5a623',
          value: remaining,
          display: money(remaining),
        },
      ]}
      defaultCenter={{
        value: targets?.percent == null ? '—' : `${targets.percent.toFixed(1)}%`,
        label: 'Target Achieved',
      }}
      caption={
        targets?.achieved == null
          ? 'Achieved revenue unavailable'
          : `Across ${count} ${count === 1 ? 'target' : 'targets'}`
      }
    />
  );
}
