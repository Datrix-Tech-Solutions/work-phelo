'use client';

import { use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';
import { SchedulingTabs } from '@/components/molecules/scheduling/SchedulingTabs';
import { MyScheduleTab } from '@/components/organisms/scheduling/MyScheduleTab';
import { SchedulingContent } from '@/components/organisms/scheduling/SchedulingContent';
import { SwapRequestsTab } from '@/components/organisms/scheduling/SwapRequestsTab';

const VALID_TABS = ['my-schedule', 'shift-scheduler', 'swap-requests'] as const;
type Tab = (typeof VALID_TABS)[number];

export default function SchedulingPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const user = useAuthStore((s) => s.user);
  const hasEmployeeProfile = user?.role === 'EMPLOYEE';
  const canManageSchedules = usePermission(Permission.MANAGE_SCHEDULES);
  const canApproveShiftSwap = usePermission(Permission.APPROVE_SHIFT_SWAP);
  const canReviewShiftSwaps = canManageSchedules || canApproveShiftSwap;

  const defaultTab: Tab = hasEmployeeProfile
    ? 'my-schedule'
    : canManageSchedules
      ? 'shift-scheduler'
      : canReviewShiftSwaps
        ? 'swap-requests'
        : 'my-schedule';

  const tabParam = searchParams.get('tab') as Tab | null;
  const resolvedTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : defaultTab;

  // Guard against accessing a tab the user has no permission for
  const activeTab: Tab =
    resolvedTab === 'my-schedule' && !hasEmployeeProfile
      ? defaultTab
      : resolvedTab === 'shift-scheduler' && !canManageSchedules
        ? defaultTab
        : resolvedTab === 'swap-requests' && !canReviewShiftSwaps
          ? defaultTab
          : resolvedTab;

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

      <SchedulingTabs
        activeTab={activeTab}
        hasEmployeeProfile={hasEmployeeProfile}
        canManageSchedules={canManageSchedules}
        canReviewShiftSwaps={canReviewShiftSwaps}
        onTabChange={handleTabChange}
      />

      {activeTab === 'my-schedule' && hasEmployeeProfile && <MyScheduleTab />}
      {activeTab === 'shift-scheduler' && canManageSchedules && (
        <SchedulingContent tenantSlug={tenantSlug} />
      )}
      {activeTab === 'swap-requests' && canReviewShiftSwaps && <SwapRequestsTab />}
    </div>
  );
}
