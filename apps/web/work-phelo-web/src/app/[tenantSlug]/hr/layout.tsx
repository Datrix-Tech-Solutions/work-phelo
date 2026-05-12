// HUMAN RESOURCE MODULE LAYOUT //

'use client';

import { use, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { Sidebar } from '@/components/organisms/shared/Sidebar';
import { HR_NAV_GROUPS } from '@/config/hr-nav';
import { useHrManagementAccess } from '@/hooks/useHrManagementAccess';
import { usePermission, usePermissionRule } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';
import { AppraisalReminderModal } from '@/components/organisms/appraisal/AppraisalReminderModal';
import { LeaveReminderModal } from '@/components/organisms/leave/LeaveReminderModal';

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
  const initials = firstName.slice(0, 2).toUpperCase();

  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('portal');

  const { hasAnyManagementAccess } = useHrManagementAccess();
  const canReadEmployees = usePermission(Permission.READ_EMPLOYEES);
  const canReadOwnProfile = usePermission(Permission.READ_OWN_PROFILE);
  const canReadOwnLeave = usePermission(Permission.READ_OWN_LEAVE);
  const canReadAllLeaves = usePermission(Permission.READ_ALL_LEAVES);
  const canRequestLeave = usePermission(Permission.REQUEST_LEAVE);
  const canApproveLeave = usePermission(Permission.APPROVE_LEAVE);
  const canReadOwnReview = usePermission(Permission.READ_OWN_REVIEW);
  const canReadAppraisals = usePermission(Permission.READ_APPRAISALS);
  const canSubmitSelfAssessment = usePermission(Permission.SUBMIT_SELF_ASSESSMENT);
  const canSubmitManagerReview = usePermission(Permission.SUBMIT_MANAGER_REVIEW);
  const canConfigureAppraisal = usePermission(Permission.CONFIGURE_APPRAISAL);
  const canClockInOut = usePermission(Permission.CLOCK_IN_OUT);
  const canReadAttendance = usePermission(Permission.READ_ATTENDANCE);
  const canSubmitTimeCorrection = usePermission(Permission.SUBMIT_TIME_CORRECTION);
  const canApproveTimeCorrection = usePermission(Permission.APPROVE_TIME_CORRECTION);
  const canReadSchedules = usePermissionRule('schedules:VIEW');
  const canManageSchedules = usePermission(Permission.MANAGE_SCHEDULES);
  const canApproveShiftSwap = usePermission(Permission.APPROVE_SHIFT_SWAP);
  const canReadOwnPayslip = usePermission(Permission.READ_OWN_PAYSLIP);
  const canReadPayroll = usePermission(Permission.READ_PAYROLL);
  const canRunPayroll = usePermission(Permission.RUN_PAYROLL);
  const canApprovePayroll = usePermission(Permission.APPROVE_PAYROLL);
  const canManagePayrollSettings = usePermission(Permission.MANAGE_PAYROLL_SETTINGS);
  const canReadAssets = usePermission(Permission.READ_ASSETS);
  const canManageAssets = usePermission(Permission.MANAGE_ASSETS);
  const canAssignAsset = usePermission(Permission.ASSIGN_ASSET);
  const canReadAnnouncements = usePermission(Permission.READ_ANNOUNCEMENTS);
  const canManageAnnouncements = usePermission(Permission.MANAGE_ANNOUNCEMENTS);
  const canAccessLeave = canReadOwnLeave || canReadAllLeaves || canRequestLeave || canApproveLeave;
  const canAccessAppraisal =
    canReadOwnReview ||
    canReadAppraisals ||
    canSubmitSelfAssessment ||
    canSubmitManagerReview ||
    canConfigureAppraisal;
  const canAccessTimeClock =
    canClockInOut || canReadAttendance || canSubmitTimeCorrection || canApproveTimeCorrection;
  const canAccessScheduling = canReadSchedules || canManageSchedules || canApproveShiftSwap;
  const canAccessPayroll =
    canReadOwnPayslip ||
    canReadPayroll ||
    canRunPayroll ||
    canApprovePayroll ||
    canManagePayrollSettings;
  // Feature toggles from the user's tenant config
  const hrFeatures = user?.featureConfig?.hr ?? {};

  // Only dashboard and management are always active (no toggle exists for them)
  // announcements is also core — it is permission-gated, not feature-toggled
  const coreKeys = new Set(['dashboard', 'management', 'announcements']);
  const navAccess: Record<string, boolean> = {
    dashboard: true,

    employees: canReadEmployees || canReadOwnProfile,
    leave: canAccessLeave,
    appraisal: canAccessAppraisal,
    timeclock: canAccessTimeClock,
    scheduling: canAccessScheduling,
    payroll: canAccessPayroll,
    assets: canReadAssets || canManageAssets || canAssignAsset,
    management: hasAnyManagementAccess,
    announcements: canReadAnnouncements || canManageAnnouncements,
  };

  const groups = HR_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      href: `/${tenantSlug}/hr${item.href ? `/${item.href}` : ''}`,
      enabled: item.enabled !== false && (navAccess[item.key] ?? true),
      active: coreKeys.has(item.key)
        ? true
        : item.key in hrFeatures
          ? hrFeatures[item.key]
          : item.active,
    })),
  }));
  // const groups = HR_NAV_GROUPS.map((group) => ({
  //   ...group,
  //   items: group.items.map((item) => ({
  //     ...item,
  //     href: `/${tenantSlug}/hr${item.href ? `/${item.href}` : ''}`,
  //     active: coreKeys.has(item.key)
  //       ? true
  //       : item.key in hrFeatures
  //         ? hrFeatures[item.key]
  //         : item.active,
  //   })),
  // }));

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      <TopNav
        showMenuButton
        onMenuClick={() => setCollapsed((v) => !v)}
        userInitials={initials}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        notificationCount={0}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar groups={groups} collapsed={collapsed} />
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>

      {canSubmitManagerReview && <AppraisalReminderModal tenantSlug={tenantSlug} />}
      {canApproveLeave && <LeaveReminderModal tenantSlug={tenantSlug} />}
    </div>
  );
}
