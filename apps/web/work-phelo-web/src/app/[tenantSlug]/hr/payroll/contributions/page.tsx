'use client';

import { use } from 'react';
import { usePermission } from '@/hooks/hr/usePermission';
import { useRedirectWhenDenied } from '@/hooks/hr/useRedirectWhenDenied';
import { Permission } from '@/lib/permissionMap';
import { SocialSecurityContent } from '@/components/organisms/hr/payroll/SocialSecurityContent';
import { pageHeader, pageContent } from '@/lib/layout';

export default function PayrollContributionsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);
  useRedirectWhenDenied(canManagePayroll === false, `/${tenantSlug}/hr/payroll`);

  if (!canManagePayroll) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">Social security</h1>
      </div>
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col`}>
        <SocialSecurityContent />
      </div>
    </div>
  );
}
