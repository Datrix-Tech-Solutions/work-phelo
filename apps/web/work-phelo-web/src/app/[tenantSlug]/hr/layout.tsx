// HUMAN RESOURCE MODULE LAYOUT //

'use client';

import { use, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { TopNav } from '@/components/organisms/TopNav';
import { Sidebar } from '@/components/organisms/Sidebar';
import { HR_NAV_GROUPS } from '@/config/hr-nav';

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

  // Prefix all hrefs with the tenant + module path
  const groups = HR_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      href: `/${tenantSlug}/hr${item.href ? `/${item.href}` : ''}`,
    })),
  }));

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
    </div>
  );
}
