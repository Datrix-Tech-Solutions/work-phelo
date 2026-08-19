'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { pageHeader, pagePx, pageContent } from '@/lib/layout';
import { ClaimsTable } from '@/components/organisms/reinsurance/tables/Claimstable';
import { ClaimsStatsRow } from '@/components/molecules/reinsurance/stats/ClaimsStatsRow';
import { TabBar } from '@/components/molecules/shared/TabBar';

type ClaimsPageTab = 'notification' | 'open' | 'closed';

const TABS = [
  { key: 'notification', label: 'Notification' },
  { key: 'open', label: 'Open Claims' },
  { key: 'closed', label: 'Closed Claims' },
];

export default function ReinsuranceClaimsPage() {
  const [activeTab, setActiveTab] = useState<ClaimsPageTab>('notification');

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0">
        <div className={pageHeader}>
          <h2 className="text-base font-semibold text-gray-900">Claims</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage claim submissions and processing</p>
        </div>
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(t) => setActiveTab(t as ClaimsPageTab)}
          className={pagePx}
        />
      </div>

      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col gap-6')}>
        <ClaimsStatsRow />
        {activeTab === 'notification' && <ClaimsTable tab="notification" />}
        {activeTab === 'open' && <ClaimsTable tab="open" />}
        {activeTab === 'closed' && <ClaimsTable tab="closed" />}
      </div>
    </div>
  );
}
