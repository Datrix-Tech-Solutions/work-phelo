// HUMAN RESOURCE MODULE LAYOUT //

'use client';

import { use, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useNavRailStore } from '@/store/navRail.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { HrSidebar } from '@/components/organisms/shared/HrSidebar';
import { useHrSidebarGroups } from '@/hooks/hr/useHrSidebarGroups';
import { usePermission } from '@/hooks/hr/usePermission';
import { useModuleThemeScope } from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import { AgreementGate } from '@/components/organisms/hr/companyPolicies/AgreementGate';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function HRLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const pathname = usePathname();
  useModuleThemeScope('hr');
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'User';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const canReadOwnProfile = usePermission(Permission.READ_OWN_PROFILE);

  // Remember that HR has been visited so other modules can show a parked,
  // icon-only HR rail alongside their own sidebar.
  const markHrVisited = useNavRailStore((s) => s.markHrVisited);
  useEffect(() => {
    markHrVisited();
  }, [markHrVisited]);

  const groups = useHrSidebarGroups(tenantSlug, 'hr');

  // Lets the sidebar be pinned open via TopNav's menu button, for anyone who
  // doesn't want to rely on hover to see it expanded.
  const [pinned, setPinned] = useState(false);

  // Payroll, Appraisal, Leave, Recruitment and Projects each have their own dedicated navigation now
  // (their own layout.tsx), same pattern as Accounting/Operations — hand off
  // chrome entirely instead of nesting HR's sidebar/TopNav around them.
  const SELF_CONTAINED_SECTIONS = ['payroll', 'appraisal', 'leave', 'recruitment', 'projects'];
  if (
    SELF_CONTAINED_SECTIONS.some((section) => pathname.startsWith(`/${tenantSlug}/hr/${section}`))
  ) {
    return <>{children}</>;
  }

  return (
    <AppBackground className="h-dvh overflow-hidden flex flex-col layout-hr">
      <TopNav
        showMenuButton
        onMenuClick={() => setPinned((v) => !v)}
        userInitials={initials}
        logoVariant="image"
      />
      <div className="flex flex-1 min-h-0 relative">
        <HrSidebar groups={groups} forceOpen={pinned} onRequestClose={() => setPinned(false)} />
        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto flex flex-col">{children}</main>
      </div>

      {canReadOwnProfile && <AgreementGate />}
    </AppBackground>
  );
}
