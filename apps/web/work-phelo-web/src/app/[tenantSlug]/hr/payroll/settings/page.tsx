'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { pageHeader, pageContent } from '@/lib/layout';
import { PayrollAccountingSetup } from '@/components/organisms/accounting/panels/PayrollAccountingSetup';

export default function PayrollSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);

  useEffect(() => {
    if (canManagePayroll === false) {
      router.replace(`/${tenantSlug}/hr/payroll`);
    }
  }, [canManagePayroll, tenantSlug, router]);

  if (!canManagePayroll) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">Payroll Settings</h1>
      </div>
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col gap-6`}>
        <PayrollAccountingSetup />
      </div>
    </div>
  );
}
