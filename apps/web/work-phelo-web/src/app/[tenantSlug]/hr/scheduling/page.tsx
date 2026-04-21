'use client';

import { use } from 'react';
import { SchedulingContent } from '@/components/organisms/scheduling/SchedulingContent';

export default function SchedulingPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);

  return (
    <div className="p-6 flex flex-col gap-0 h-full overflow-hidden">
      <SchedulingContent tenantSlug={tenantSlug} />
    </div>
  );
}
