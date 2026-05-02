'use client';

import { use, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';
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

  useEffect(() => {
    if (user !== null && !user.featureConfig?.hr?.leave) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [user, tenantSlug, router]);

  const hasHRProfile = user?.role === 'EMPLOYEE';
  const isAdmin = user?.role === 'TENANT_ADMIN';
  const canApproveLeave = usePermission(Permission.APPROVE_LEAVE);
  const canSeeRequests = canApproveLeave || isAdmin;

  // Employees and managers land on their own leave first.
  // Admins have no personal HR profile so they land on requests.
  const requestId = searchParams.get('requestId');
  const defaultTab: Tab = requestId ? 'requests' : hasHRProfile ? 'my' : 'requests';
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
        <h1 className="text-xl font-bold text-gray-900">Leave Management</h1>
      </div>

      <LeaveTabs
        activeTab={activeTab}
        canReviewRequests={canSeeRequests}
        isEmployee={hasHRProfile}
        onTabChange={handleTabChange}
      />

      {activeTab === 'my' && hasHRProfile && <MyLeaveTab tenantSlug={tenantSlug} />}
      {activeTab === 'requests' && canSeeRequests && (
        <LeaveRequestsTab tenantSlug={tenantSlug} canReview={canSeeRequests} />
      )}
    </div>
  );
}
