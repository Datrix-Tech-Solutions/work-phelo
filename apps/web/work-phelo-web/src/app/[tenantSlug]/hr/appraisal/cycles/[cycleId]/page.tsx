'use client';

import { use } from 'react';
import { CycleAssessments } from '@/components/organisms/hr/appraisal/CycleAssessments';

export default function CycleDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cycleId: string }>;
}) {
  const { tenantSlug, cycleId } = use(params);
  return <CycleAssessments tenantSlug={tenantSlug} cycleId={cycleId} />;
}
