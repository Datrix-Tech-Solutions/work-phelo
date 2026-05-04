'use client';

import { use, useMemo } from 'react';
import { useCycleAppraisals } from '@/hooks/useAppraisals';
import { CycleInProgressContent } from '@/components/organisms/appraisal/CycleInProgressContent';
import { CycleResultsContent } from '@/components/organisms/appraisal/CycleResultsContent';

function CycleDetailRouter({ tenantSlug, cycleId }: { tenantSlug: string; cycleId: string }) {
  const { data: raw, isLoading } = useCycleAppraisals(cycleId);

  const appraisals: { selfStatus?: string; managerStatus?: string }[] = useMemo(() => {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).data))
      return (raw as { data: { selfStatus?: string; managerStatus?: string }[] }).data;
    return [];
  }, [raw]);

  if (isLoading) {
    return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  }

  const total = appraisals.length;
  const selfCompleted = appraisals.filter((a) => a.selfStatus === 'SUBMITTED').length;
  const managerCompleted = appraisals.filter((a) => a.managerStatus === 'SUBMITTED').length;
  const rate = total > 0 ? Math.round(((selfCompleted + managerCompleted) / (total * 2)) * 100) : 0;

  if (rate >= 100) {
    return <CycleResultsContent tenantSlug={tenantSlug} cycleId={cycleId} />;
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
