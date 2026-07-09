// EXECUTIVE DASHBOARD

'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { TopNav, NavTab } from '@/components/organisms/shared/TopNav';
import { AppBackground } from '@/components/atoms/AppBackground';

export default function ExecutiveDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const firstName = user?.firstName ?? 'User';
  const initials = `${firstName[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';

  useEffect(() => {
    if (user && !isTenantAdmin) {
      router.replace(`/${tenantSlug}/dashboard`);
    }
  }, [user, isTenantAdmin, router, tenantSlug]);

  const tabs: NavTab[] = [
    { key: 'dashboard', label: 'Dashboard', href: `/${tenantSlug}/dashboard` },
    { key: 'executive', label: 'Executive Dashboard', href: `/${tenantSlug}/executive` },
  ];

  if (!isTenantAdmin) return null;

  return (
    <AppBackground className="h-screen overflow-hidden flex flex-col">
      <TopNav userInitials={initials} notificationCount={0} logoVariant="image" tabs={tabs} />

      <main className="flex-1 min-h-0 overflow-y-auto" />
    </AppBackground>
  );
}
