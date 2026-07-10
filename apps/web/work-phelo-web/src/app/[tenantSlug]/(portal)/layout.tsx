// TENANT PORTAL LAYOUT — shared TopNav/tabs for the Modules and Executive Dashboard pages

'use client';

import { use } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { TopNav, NavTab } from '@/components/organisms/shared/TopNav';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function PortalLayout({
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
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';

  const tabs: NavTab[] = [{ key: 'modules', label: 'Modules', href: `/${tenantSlug}/modules` }];
  if (isTenantAdmin) {
    tabs.push({ key: 'executive', label: 'Executive Dashboard', href: `/${tenantSlug}/executive` });
  }

  return (
    <AppBackground className="h-screen overflow-hidden flex flex-col">
      <TopNav userInitials={initials} notificationCount={0} logoVariant="image" tabs={tabs} />
      {children}
    </AppBackground>
  );
}
