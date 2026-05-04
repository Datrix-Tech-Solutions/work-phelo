'use client';

import { use, useEffect } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';
import { PayrollTabs } from '@/components/molecules/payroll/PayrollTabs';
import { MyPayslipTab } from '@/components/organisms/payroll/MyPayslipTab';
import { ManagePayrollTab } from '@/components/organisms/payroll/ManagePayrollTab';

type Tab = 'payslip' | 'manage' | 'approve';

export default function PayrollPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user !== null && !user.featureConfig?.hr?.payroll) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [user, tenantSlug, router]);

  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);
  const canApprovePayroll = usePermission(Permission.APPROVE_PAYROLL);
  const [tab, setTab] = useState<Tab>(canManagePayroll ? 'manage' : 'payslip');

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <div className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Payroll Management</h1>
      </div>
      <PayrollTabs
        activeTab={tab}
        canManage={canManagePayroll}
        canApprove={canApprovePayroll}
        onTabChange={setTab}
      />
      {tab === 'payslip' && <MyPayslipTab />}
      {tab === 'manage' && canManagePayroll && <ManagePayrollTab />}
      {tab === 'approve' && canApprovePayroll && <ManagePayrollTab />}
    </div>
  );
}
