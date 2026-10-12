'use client';

import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { pageHeader, pageContent, pagePx } from '@/lib/layout';
import { CampaignManagementTabs } from '@/components/molecules/marketing/CampaignManagementTabs';

export default function CampaignManagementLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/marketing/campaign-management`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h1 className="text-xl font-semibold text-gray-900">Campaign Management</h1>
        </div>
        <CampaignManagementTabs base={base} className={pagePx} />
      </div>

      <main className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col')}>
        {children}
      </main>
    </div>
  );
}
