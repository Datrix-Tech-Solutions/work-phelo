'use client';

import { use } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/atoms/Badge';
import { useGoalCycle, useGoals } from '@/hooks/hr/useGoalAppraisals';
import { formatDate } from '@/lib/formatters';
import { Icons } from '@/components/atoms/icons';
import { pageContent } from '@/lib/layout';

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="text-sm text-gray-900">
        {value ?? <span className="text-gray-400">—</span>}
      </div>
    </div>
  );
}

export default function CycleDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);

  const { cycle, isLoading } = useGoalCycle(id);
  const { goals } = useGoals();

  if (isLoading) return <div className="p-4 sm:p-6 lg:p-8 text-sm text-gray-400">Loading...</div>;
  if (!cycle) return <div className="p-4 sm:p-6 lg:p-8 text-sm text-red-400">Cycle not found.</div>;

  return (
    <div className={`${pageContent} flex flex-col gap-6`}>
      <Link
        href={`/${tenantSlug}/hr/hrmanagement/appraisal/cycles`}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors w-fit"
      >
        <Icons.ChevronLeft />
        Back to Cycles
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{cycle.title}</h1>
            <Badge
              variant={cycle.status === 'ACTIVE' ? 'success' : 'neutral'}
              label={cycle.status.charAt(0) + cycle.status.slice(1).toLowerCase()}
            />
          </div>
          <p className="text-sm text-gray-500">
            {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 max-w-2xl">
        <DetailRow label="Frequency" value={cycle.frequency || '—'} />
        <DetailRow label="Appraisals" value={cycle.stats?.employees ?? 0} />
        <DetailRow
          label="Goals"
          value={cycle.goalIds
            .map((id) => goals.find((g) => g.id === id)?.name ?? 'Goal')
            .join(', ')}
        />
        {cycle.selfAssessmentDeadline && (
          <DetailRow
            label="Self-Assessment Deadline"
            value={formatDate(cycle.selfAssessmentDeadline)}
          />
        )}
        {cycle.managerReviewDeadline && (
          <DetailRow
            label="Manager Review Deadline"
            value={formatDate(cycle.managerReviewDeadline)}
          />
        )}
        {cycle.description && (
          <div className="col-span-2">
            <DetailRow label="Description" value={cycle.description} />
          </div>
        )}
      </div>
    </div>
  );
}
