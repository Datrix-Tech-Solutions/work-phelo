'use client';

import { use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { LeaveTabs } from '@/components/molecules/leave/LeaveTabs';
import { MyLeaveTab } from '@/components/organisms/leave/MyLeaveTab';
import { LeaveRequestsTab } from '@/components/organisms/leave/LeaveRequestsTab';

const VALID_TABS = ['my', 'requests'] as const;
type Tab = (typeof VALID_TABS)[number];

export default function LeavePage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const user = useAuthStore((s) => s.user);
  const isManager = user?.role === 'TENANT_ADMIN' || user?.isManager === true;
  const isEmployee = user?.role === 'EMPLOYEE' && !user?.isManager;

  const defaultTab: Tab = isEmployee ? 'my' : 'requests';
  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : defaultTab;

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <div className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Leave</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your leave requests and balances</p>
      </div>

      <LeaveTabs
        activeTab={activeTab}
        isManager={isManager}
        isEmployee={isEmployee}
        onTabChange={handleTabChange}
      />

      {activeTab === 'my' && isEmployee && <MyLeaveTab tenantSlug={tenantSlug} />}
      {activeTab === 'requests' && isManager && <LeaveRequestsTab tenantSlug={tenantSlug} />}
    </div>
  );
}
