'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';

export default function HRManagementPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const {
    canReadDepartments,
    canReadBranches,
    canAccessRoles,
    canViewAuditLogs,
    canManagePayroll,
    hasAnyManagementAccess,
  } = useHrManagementAccess();

  useEffect(() => {
    if (user === null) return;

    if (!hasAnyManagementAccess) {
      router.replace(`/${tenantSlug}/hr/hrmanagement/companyPolicies`);
      return;
    }

    if (canReadDepartments) {
      router.replace(`/${tenantSlug}/hr/hrmanagement/departments`);
      return;
    }

    if (canReadBranches) {
      router.replace(`/${tenantSlug}/hr/hrmanagement/branches`);
      return;
    }

    if (canAccessRoles) {
      router.replace(`/${tenantSlug}/hr/hrmanagement/roles`);
      return;
    }

    if (canViewAuditLogs) {
      router.replace(`/${tenantSlug}/hr/hrmanagement/audit-logs`);
      return;
    }

    // Payroll-only users have no settings page of their own here; company policies are open to all.
    if (canManagePayroll) {
      router.replace(`/${tenantSlug}/hr/hrmanagement/companyPolicies`);
    }
  }, [
    canReadDepartments,
    canReadBranches,
    canAccessRoles,
    canViewAuditLogs,
    canManagePayroll,
    hasAnyManagementAccess,
    router,
    tenantSlug,
    user,
  ]);

  return null;
}
