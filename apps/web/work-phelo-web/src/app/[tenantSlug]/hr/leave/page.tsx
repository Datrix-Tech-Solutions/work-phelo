'use client';

import { use, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { LeaveTabs } from '@/components/molecules/leave/LeaveTabs';
import { MyLeaveTab } from '@/components/organisms/leave/MyLeaveTab';
import { LeaveRequestsTab } from '@/components/organisms/leave/LeaveRequestsTab';

export default function LeavePage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const user = useAuthStore((s) => s.user);
  const isManager = user?.role === 'TENANT_ADMIN' || user?.isManager === true;
  const isEmployee = user?.role === 'EMPLOYEE' && !user?.isManager;
  const [activeTab, setActiveTab] = useState(isEmployee ? 'my' : 'requests');

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
        onTabChange={setActiveTab}
      />

      {activeTab === 'my' && isEmployee && <MyLeaveTab tenantSlug={tenantSlug} />}
      {activeTab === 'requests' && isManager && <LeaveRequestsTab tenantSlug={tenantSlug} />}
    </div>
  );
}
