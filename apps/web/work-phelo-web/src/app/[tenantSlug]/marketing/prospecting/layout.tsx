'use client';

import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pageHeader, pageContent, pagePx } from '@/lib/layout';
import { ProspectingTabs } from '@/components/molecules/marketing/ProspectingTabs';

export default function ProspectingLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/marketing/prospecting`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 bg-white">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">CRM Settings</h1>
        </div>
        <div className={pagePx}>
          <ProspectingTabs base={base} />
        </div>
      </div>

      <main className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto bg-gray-50 flex flex-col')}>
        {children}
      </main>
    </div>
  );
}
