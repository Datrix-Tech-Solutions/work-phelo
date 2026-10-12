'use client';

import { use, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useNavRailStore } from '@/store/navRail.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { Sidebar } from '@/components/organisms/shared/Sidebar';
import { ModuleRail } from '@/components/organisms/shared/ModuleRail';
import { useProjectsSidebarGroups } from '@/hooks/hr/useProjectsSidebarGroups';
import { useHrSidebarGroups, useHrTabs } from '@/hooks/hr/useHrSidebarGroups';
import { AppBackground } from '@/components/atoms/AppBackground';
import { useModuleThemeScope } from '@/hooks';

/**
 * Project Management's own dedicated layout/sidebar — same navigation pattern as
 * Payroll/Leave/Appraisal/Hiring, even though Projects is still an HR section under
 * /hr/projects. HR's own layout hands off its chrome to this one for anything under
 * here — see the pathname check in hr/layout.tsx.
 */
export default function ProjectsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  useModuleThemeScope('hr');
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'User';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const [collapsed, setCollapsed] = useState(true);

  const { groups } = useProjectsSidebarGroups(tenantSlug);

  // Parked, icon-only HR rail — same as the one shown from Accounting/Operations/Payroll.
  const hasVisitedHr = useNavRailStore((s) => s.hasVisitedHr);
  const parkedHrGroups = useHrSidebarGroups(tenantSlug, 'hr');
  const tabs = useHrTabs(tenantSlug);

  return (
    <AppBackground className="h-dvh overflow-hidden flex flex-col layout-hr">
      <TopNav
        showMenuButton
        onMenuClick={() => setCollapsed((v) => !v)}
        tabs={tabs}
        userInitials={initials}
        logoVariant="image"
      />
      <div className="flex flex-1 min-h-0 relative">
        {hasVisitedHr && <ModuleRail groups={parkedHrGroups} />}
        <Sidebar groups={groups} collapsed={collapsed} />
        {!collapsed && (
          <div
            className="absolute inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setCollapsed(true)}
          />
        )}
        <main
          className="flex-1 min-h-0 min-w-0 overflow-y-auto flex flex-col"
          onClick={() => {
            if (!collapsed) setCollapsed(true);
          }}
        >
          {children}
        </main>
      </div>
    </AppBackground>
  );
}
