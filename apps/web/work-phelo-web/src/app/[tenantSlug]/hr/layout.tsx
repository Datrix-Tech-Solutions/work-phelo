// HUMAN RESOURCE MODULE LAYOUT //

'use client';

import { use, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { HrSidebar } from '@/components/organisms/shared/HrSidebar';
import { usePermission } from '@/hooks/hr/usePermission';
import { useHrSidebarGroups } from '@/hooks/hr/useHrSidebarGroups';
import { Permission } from '@/lib/permissionMap';
import { AppraisalReminderModal } from '@/components/organisms/hr/appraisal/AppraisalReminderModal';
import { AgreementGate } from '@/components/organisms/hr/companyPolicies/AgreementGate';
import { LeaveReminderModal } from '@/components/organisms/hr/leave/LeaveReminderModal';
import { TimeCorrectionReminderModal } from '@/components/organisms/hr/time-clock/TimeCorrectionReminderModal';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function HRLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'User';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const [sidebarPinned, setSidebarPinned] = useState(false);
  const groups = useHrSidebarGroups(tenantSlug);
  const canReadOwnProfile = usePermission(Permission.READ_OWN_PROFILE);
  const canApproveLeave = usePermission(Permission.APPROVE_LEAVE);
  const canSubmitManagerReview = usePermission(Permission.SUBMIT_MANAGER_REVIEW);
  const canApproveTimeCorrection = usePermission(Permission.APPROVE_TIME_CORRECTION);

  return (
    <AppBackground className="h-dvh overflow-hidden flex flex-col layout-hr">
      <TopNav
        showMenuButton
        onMenuClick={() => setSidebarPinned((v) => !v)}
        userInitials={initials}
        notificationCount={0}
        logoVariant="image"
      />
      <div className="flex flex-1 min-h-0 min-w-0 relative">
        <HrSidebar
          groups={groups}
          forceOpen={sidebarPinned}
          onRequestClose={() => setSidebarPinned(false)}
        />
        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto flex flex-col">{children}</main>
      </div>

      {canSubmitManagerReview && <AppraisalReminderModal tenantSlug={tenantSlug} />}
      {canApproveLeave && <LeaveReminderModal tenantSlug={tenantSlug} />}
      {canApproveTimeCorrection && <TimeCorrectionReminderModal tenantSlug={tenantSlug} />}
      {canReadOwnProfile && <AgreementGate />}
    </AppBackground>
  );
}
