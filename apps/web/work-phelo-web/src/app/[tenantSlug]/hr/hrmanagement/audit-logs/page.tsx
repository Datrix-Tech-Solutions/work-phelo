'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/useHrManagementAccess';
import { AuditLogsTable } from '@/components/organisms/hrmanagement/AuditLogsTable';

export default function AuditLogsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { canViewAuditLogs } = useHrManagementAccess();

  useEffect(() => {
    if (user !== null && !canViewAuditLogs) {
      router.replace(`/${user.tenantSlug}/hr`);
    }
  }, [canViewAuditLogs, router, user]);

  if (user !== null && !canViewAuditLogs) {
    return null;
  }

  return <AuditLogsTable />;
}
