// OPERATIONS MODULE LAYOUT //

'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useNavRailStore } from '@/store/navRail.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { Sidebar } from '@/components/organisms/shared/Sidebar';
import { ModuleRail } from '@/components/organisms/shared/ModuleRail';
import { OPERATIONS_FEATURES, getActiveOperationsFeature } from '@/config/operations-features';
import type { NavItem } from '@/components/organisms/shared/Sidebar';
import { useHrSidebarGroups } from '@/hooks/hr/useHrSidebarGroups';
import { AppBackground } from '@/components/atoms/AppBackground';
import { useModuleThemeScope } from '@/hooks';

export default function OperationsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  useModuleThemeScope('operations');
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'User';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );

  const router = useRouter();
  const pathname = usePathname();
  const authLoading = useAuthStore((s) => s.isLoading);
  const feature = getActiveOperationsFeature(user?.featureConfig);
  const BASE = feature ? `/${tenantSlug}/operations/${feature.segment}` : '';

  // Only the selected operations feature is reachable; anything else goes back to it.
  useEffect(() => {
    if (authLoading) return;
    if (!feature) {
      router.replace(`/${tenantSlug}/hr`);
      return;
    }
    const segment = pathname.split('/')[3];
    if (OPERATIONS_FEATURES.some((f) => f.segment === segment) && segment !== feature.segment) {
      router.replace(BASE);
    }
  }, [authLoading, feature, pathname, router, tenantSlug, BASE]);

  // Recursively prefix hrefs with the selected feature's base path
  const groups = useMemo(() => {
    const prefixItem = (item: NavItem): NavItem => ({
      ...item,
      href: `${BASE}${item.href ? `/${item.href}` : ''}`,
      children: item.children?.map(prefixItem),
    });
    return (feature?.navGroups ?? []).map((group) => ({
      ...group,
      items: group.items.map(prefixItem),
    }));
  }, [feature, BASE]);

  // Parked, icon-only HR rail — shown once the user has visited HR, sitting
  // next to Operations' own sidebar (which behaves exactly as before).
  const hasVisitedHr = useNavRailStore((s) => s.hasVisitedHr);
  const parkedHrGroups = useHrSidebarGroups(tenantSlug, 'operations');

  return (
    <AppBackground
      className="h-dvh overflow-hidden flex flex-col layout-operations"
      data-operations-feature={feature?.key}
    >
      <TopNav
        showMenuButton
        onMenuClick={() => setCollapsed((v) => !v)}
        userInitials={initials}
        logoVariant="image"
      />
      <div className="flex flex-1 min-h-0 relative">
        {hasVisitedHr && <ModuleRail groups={parkedHrGroups} />}
        <Sidebar groups={groups} collapsed={collapsed} />
        {/* Mobile backdrop */}
        {!collapsed && (
          <div
            className="absolute inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setCollapsed(true)}
          />
        )}
        <main
          aria-label={feature?.label}
          className="flex-1 min-h-0 overflow-y-auto flex flex-col"
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
