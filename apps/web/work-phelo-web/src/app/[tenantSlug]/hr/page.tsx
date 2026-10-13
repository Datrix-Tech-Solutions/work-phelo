'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { useAuthStore } from '@/store/auth.store';

/**
 * HR's entry point. Whoever holds the HR dashboard permission opens on the organisation
 * dashboard; everyone else opens on their own home page.
 */
export default function HrEntryPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canViewHrDashboard = usePermission(Permission.VIEW_HR_DASHBOARD);

  useEffect(() => {
    if (user === null) return;
    router.replace(`/${tenantSlug}/hr/${canViewHrDashboard ? 'dashboard' : 'home'}`);
  }, [user, canViewHrDashboard, tenantSlug, router]);

  return null;
}
