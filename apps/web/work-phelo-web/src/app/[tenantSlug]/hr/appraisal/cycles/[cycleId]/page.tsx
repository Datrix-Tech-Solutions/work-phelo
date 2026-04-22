'use client';

import { use } from 'react';
import { useAppraisalCycles } from '@/hooks/useAppraisals';
import { CycleInProgressContent } from '@/components/organisms/appraisal/CycleInProgressContent';
import { CycleCompletedContent } from '@/components/organisms/appraisal/CycleCompletedContent';

function CycleDetailRouter({ tenantSlug, cycleId }: { tenantSlug: string; cycleId: string }) {
  const { data: cycles = [], isLoading } = useAppraisalCycles();
  const cycle = cycles.find((c) => c.id === cycleId);

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  }

  const isCompleted = (cycle?.completionRate ?? 0) >= 100;

  if (isCompleted) {
    return <CycleCompletedContent tenantSlug={tenantSlug} cycleId={cycleId} />;
  }

  return <CycleInProgressContent tenantSlug={tenantSlug} cycleId={cycleId} />;
}

export default function CycleDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cycleId: string }>;
}) {
  const { tenantSlug, cycleId } = use(params);
  return <CycleDetailRouter tenantSlug={tenantSlug} cycleId={cycleId} />;
}
