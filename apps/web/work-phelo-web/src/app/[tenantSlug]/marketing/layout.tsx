'use client';

import { use, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/shared/TopNav';
import { Sidebar } from '@/components/organisms/shared/Sidebar';
import { MARKETING_NAV_GROUPS } from '@/config/marketing-nav';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function MarketingLayout({
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

  const groups = MARKETING_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map(prefixItem),
  }));

  return (
    <AppBackground className="h-screen overflow-hidden flex flex-col layout-marketing">
      <TopNav
        showMenuButton
        onMenuClick={() => setCollapsed((v) => !v)}
        userInitials={initials}
        notificationCount={0}
        logoVariant="image"
      />
      <div className="flex flex-1 min-h-0 relative">
        {!collapsed && (
          <div
            className="absolute inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setCollapsed(true)}
          />
        )}
        <Sidebar groups={groups} collapsed={collapsed} />
        <main
          className="flex-1 min-h-0 overflow-hidden flex flex-col"
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
