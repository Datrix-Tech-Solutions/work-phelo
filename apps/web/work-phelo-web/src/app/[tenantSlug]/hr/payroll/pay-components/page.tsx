'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { PayComponentsWorkspace } from '@/components/organisms/hr/payroll/pay-components/PayComponentsWorkspace';
import { pageHeader } from '@/lib/layout';

export default function PayComponentsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const canConfigurePayroll = usePermission(Permission.MANAGE_PAYROLL_SETTINGS);

  useEffect(() => {
    if (canConfigurePayroll === false) {
      router.replace(`/${tenantSlug}/hr/payroll`);
    }
  }, [canConfigurePayroll, tenantSlug, router]);

  if (!canConfigurePayroll) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-bold text-gray-900">Pay Components</h1>
      </div>
      <PayComponentsWorkspace />
    </div>
  );
}
