'use client';

import { use } from 'react';
import { AppraisalCyclesList } from '@/components/organisms/appraisal/AppraisalCyclesList';

export default function AppraisalCyclesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Appraisal Cycles</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Schedule and manage performance review cycles across departments
        </p>
      </div>
      <AppraisalCyclesList tenantSlug={tenantSlug} />
    </div>
  );
}
