'use client';

import { use, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useNavRailStore } from '@/store/navRail.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { Sidebar } from '@/components/organisms/shared/Sidebar';
import { ModuleRail } from '@/components/organisms/shared/ModuleRail';
import { MARKETING_NAV_GROUPS, MARKETING_TABS } from '@/config/marketing-nav';
import { useMarketingNavStore } from '@/store/marketingNav.store';
import { useHrSidebarGroups } from '@/hooks/hr/useHrSidebarGroups';
import { AppBackground } from '@/components/atoms/AppBackground';
import { useModuleThemeScope } from '@/hooks';
import { MARKETING_OPEN_PAGES } from '@/lib/marketingAccess';
import { useMarketingAccess } from '@/hooks/marketing/useMarketingAccess';
import { MarketingNoAccess } from '@/components/molecules/marketing/MarketingNoAccess';

export default function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  useModuleThemeScope('marketing');
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? 'User';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );

  const BASE = `/${tenantSlug}/marketing`;

  function prefixItem(item: (typeof MARKETING_NAV_GROUPS)[0]['items'][0]): typeof item {
    return {
      ...item,
      href: `${BASE}${item.href ? `/${item.href}` : ''}`,
      children: item.children?.map(prefixItem),
    };
  }

  // A page shows in the menu only when the user can open at least one of its tabs.
  const { canSeePage, canSeeTab, tabsOf, isResolving, isMarketer } = useMarketingAccess();
  const allGroups = MARKETING_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map(prefixItem).map((item) => ({
      ...item,
      enabled: item.enabled !== false && canSeePage(item.key),
    })),
  }));

  // The top nav switches between Campaign, Prospecting and Transport; every other group is a constant
  // that always shows. A tab is only offered when one of its pages is open to the user.
  const pathname = usePathname();
  const [page, tab] = pathname.replace(`${BASE}/`, '').split('/');
  const visibleTabs = MARKETING_TABS.map((t) => {
    const group = allGroups.find((g) => g.label === t.groupLabel);
    const pages = (group?.items ?? []).filter((item) => item.enabled);
    return { ...t, pages, firstHref: pages[0]?.href };
  }).filter((t) => !!t.firstHref);

  const pageTab = visibleTabs.find((t) => t.pages.some((item) => item.key === page))?.key;
  const lastTab = useMarketingNavStore((s) => s.lastTab);
  const setLastTab = useMarketingNavStore((s) => s.setLastTab);
  useEffect(() => {
    if (pageTab && pageTab !== lastTab) setLastTab(pageTab);
  }, [pageTab, lastTab, setLastTab]);

  // On a page outside any tab (dashboard, targets, administration) keep the last tab the user was in.
  const activeTab =
    pageTab ?? visibleTabs.find((t) => t.key === lastTab)?.key ?? visibleTabs[0]?.key;

  const tabGroupLabels: string[] = MARKETING_TABS.map((t) => t.groupLabel);
  const activeGroupLabel = MARKETING_TABS.find((t) => t.key === activeTab)?.groupLabel;
  const groups = allGroups.filter(
    (g) => !tabGroupLabels.includes(g.label) || g.label === activeGroupLabel,
  );

  const navTabs = visibleTabs.map((t) => ({
    key: t.key,
    label: t.label,
    href: t.firstHref as string,
    active: t.key === activeTab,
  }));

  // Typing the address of a page (or tab) that is out of reach shows the same answer as the menu.
  const blocked =
    !isResolving &&
    !!page &&
    (!canSeePage(page) || (!!tab && tabsOf(page).includes(tab) && !canSeeTab(page, tab)));

  // Anyone who is not a module user lands on, and stays within, the pages open to every employee.
  const router = useRouter();
  const redirecting = !isResolving && !isMarketer && !MARKETING_OPEN_PAGES.includes(page ?? '');
  useEffect(() => {
    if (redirecting) router.replace(`${BASE}/requests`);
  }, [redirecting, router, BASE]);

  // Parked, icon-only HR rail — shown once the user has visited HR, sitting
  // next to Marketing's own sidebar (which behaves exactly as before).
  const hasVisitedHr = useNavRailStore((s) => s.hasVisitedHr);
  const parkedHrGroups = useHrSidebarGroups(tenantSlug, 'marketing');

  return (
    <AppBackground className="h-dvh overflow-hidden flex flex-col layout-marketing">
      <TopNav
        showMenuButton
        onMenuClick={() => setCollapsed((v) => !v)}
        userInitials={initials}
        tabs={navTabs}
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
          className="flex-1 min-h-0 overflow-y-auto flex flex-col"
          onClick={() => {
            if (!collapsed) setCollapsed(true);
          }}
        >
          {redirecting ? null : blocked ? <MarketingNoAccess /> : children}
        </main>
      </div>
    </AppBackground>
  );
}
