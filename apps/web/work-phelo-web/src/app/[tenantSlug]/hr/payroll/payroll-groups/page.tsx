'use client';

import { use } from 'react';
import { usePermission } from '@/hooks/hr/usePermission';
import { useRedirectWhenDenied } from '@/hooks/hr/useRedirectWhenDenied';
import { Permission } from '@/lib/permissionMap';
import { PayrollGroupsContent } from '@/components/organisms/hr/payroll/payroll-groups/PayrollGroupsContent';
import { pageHeader, pageContent } from '@/lib/layout';

export default function PayrollGroupsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const canConfigurePayroll = usePermission(Permission.MANAGE_PAYROLL_SETTINGS);

  useRedirectWhenDenied(canConfigurePayroll === false, `/${tenantSlug}/hr/payroll`);

  if (!canConfigurePayroll) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">Payroll Groups</h1>
      </div>
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col`}>
        <PayrollGroupsContent />
      </div>
    </div>
  );
}
