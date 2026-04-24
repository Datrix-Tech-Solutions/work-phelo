'use client';

import { use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SchedulingTabs } from '@/components/molecules/scheduling/SchedulingTabs';
import { MyScheduleTab } from '@/components/organisms/scheduling/MyScheduleTab';
import { SchedulingContent } from '@/components/organisms/scheduling/SchedulingContent';
import { SwapRequestsTab } from '@/components/organisms/scheduling/SwapRequestsTab';

const VALID_TABS = ['my-schedule', 'shift-scheduler', 'swap-requests'] as const;
type Tab = (typeof VALID_TABS)[number];

const DEFAULT_TAB: Tab = 'my-schedule';

export default function SchedulingPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : DEFAULT_TAB;

  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', tab);
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="p-8 flex flex-col gap-6 h-full overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Scheduling</h1>
      </div>

      <SchedulingTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === 'my-schedule' && <MyScheduleTab />}
      {activeTab === 'shift-scheduler' && <SchedulingContent tenantSlug={tenantSlug} />}
      {activeTab === 'swap-requests' && <SwapRequestsTab />}
    </div>
  );
}
