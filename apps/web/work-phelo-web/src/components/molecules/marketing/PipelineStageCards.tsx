'use client';

import type { Period } from '@/components/atoms/PeriodToggle';
import { Skeleton } from '@/components/atoms/Skeleton';
import { TypeChip } from '@/components/atoms/TypeChip';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { useMarketingDashboard } from '@/hooks/marketing/useMarketingDashboard';
import { compactCardGrid } from '@/lib/layout';

const fmt = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const money = (currency: string | null | undefined, value: string) =>
  `${currency ?? ''} ${fmt(Number(value))}`.trim();

interface PipelineStageCardsProps {
  period: Period;
  year: number;
}

/**
 * One card per pipeline stage, for the open prospects created in the period: the stage and its
 * prospect count, the expected revenue, and the average per prospect.
 */
export function PipelineStageCards({ period, year }: PipelineStageCardsProps) {
  const { data, isLoading } = useMarketingDashboard(period, year);
  const stages = data?.pipeline.stages ?? [];

  if (isLoading) {
    return (
      <div className={compactCardGrid}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        No pipeline stages are set up yet. Add them under CRM Configuration.
      </p>
    );
  }

  return (
    <div className={compactCardGrid}>
      {stages.map((stage) => (
        <KpiCard
          key={stage.stageId}
          label={stage.name}
          badge={
            <TypeChip
              label={`${stage.prospects} ${stage.prospects === 1 ? 'deal' : 'deals'}`}
              color="blue"
            />
          }
          value={money(data?.currency, stage.expected)}
          sub={[{ label: 'Average value', value: money(data?.currency, stage.average) }]}
          subPlacement="below"
          compact
        />
      ))}
    </div>
  );
}
