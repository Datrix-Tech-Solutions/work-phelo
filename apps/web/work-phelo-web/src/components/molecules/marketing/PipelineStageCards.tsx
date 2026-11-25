'use client';

import { useState } from 'react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { Skeleton } from '@/components/atoms/Skeleton';
import { TypeChip } from '@/components/atoms/TypeChip';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { StageProspectsPanel } from '@/components/organisms/marketing/StageProspectsPanel';
import { useMarketingDashboard } from '@/hooks/marketing/useMarketingDashboard';
import { compactCardGrid } from '@/lib/layout';

const fmt = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const money = (currency: string | null | undefined, value: string) =>
  `${currency ?? ''} ${fmt(Number(value))}`.trim();

interface PipelineStageCardsProps {
  period: Period;
  year: number;
  userId?: string;
}

/**
 * One card per pipeline stage, for the open prospects created in the period: the stage and its
 * prospect count, the expected revenue, and the average per prospect.
 */
export function PipelineStageCards({ period, year, userId }: PipelineStageCardsProps) {
  const { data, isLoading } = useMarketingDashboard(period, year, userId);
  const stages = data?.pipeline.stages ?? [];
  // Open state is kept apart from the stage, so the panel keeps its content while it slides shut.
  const [stage, setStage] = useState<{ stageId: string; name: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

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
      {stages.map((item) => (
        <KpiCard
          key={item.stageId}
          label={item.name}
          onClick={() => {
            setStage(item);
            setPanelOpen(true);
          }}
          badge={
            <TypeChip
              label={`${item.prospects} ${item.prospects === 1 ? 'deal' : 'deals'}`}
              color="blue"
            />
          }
          value={money(data?.currency, item.expected)}
          sub={[{ label: 'Average value', value: money(data?.currency, item.average) }]}
          subPlacement="below"
          compact
        />
      ))}
      <StageProspectsPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        stage={stage}
        currency={data?.currency}
        period={period}
        year={year}
        userId={userId}
      />
    </div>
  );
}
