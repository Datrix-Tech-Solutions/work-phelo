'use client';

import { Icons } from '@/components/atoms/icons';
import { GaugeOverviewCard } from '@/components/molecules/shared/GaugeOverviewCard';

interface RecruitmentPipelineCardProps {
  className?: string;
}

/**
 * Candidates through the hiring pipeline. Recruitment is not built yet, so the card is always
 * empty; feed the metrics and totals here once there is a source.
 */
export function RecruitmentPipelineCard({ className }: RecruitmentPipelineCardProps) {
  return (
    <GaugeOverviewCard
      title="Recruitment Pipeline"
      subtitle="Candidates in the hiring pipeline"
      className={className}
      isEmpty
      emptyMessage="No recruitment data yet."
      total={0}
      metrics={[
        {
          key: 'candidates',
          label: 'Candidates',
          icon: Icons.Users,
          color: '#4c8dff',
          value: null,
          display: '—',
        },
        {
          key: 'interviewing',
          label: 'Interviewing',
          icon: Icons.Timer,
          color: '#f5a623',
          value: null,
          display: '—',
        },
        {
          key: 'hired',
          label: 'Hired',
          icon: Icons.CircleCheck,
          color: '#34d399',
          value: null,
          display: '—',
        },
      ]}
      defaultCenter={{ value: '—', label: 'Hired' }}
    />
  );
}
