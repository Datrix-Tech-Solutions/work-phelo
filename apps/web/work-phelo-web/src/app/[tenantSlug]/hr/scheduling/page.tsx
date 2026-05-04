'use client';

import { use } from 'react';
import { SchedulingContent } from '@/components/organisms/scheduling/SchedulingContent';

export default function SchedulingPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);

  return (
    <div className="p-8 flex flex-col gap-6 h-full overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Scheduling</h1>
      </div>
      <SchedulingContent tenantSlug={tenantSlug} />
    </div>
  );
}
