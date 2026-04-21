'use client';

import { useState } from 'react';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';
import { PayrollTabs } from '@/components/molecules/payroll/PayrollTabs';
import { MyPayslipTab } from '@/components/organisms/payroll/MyPayslipTab';
import { ManagePayrollTab } from '@/components/organisms/payroll/ManagePayrollTab';

type Tab = 'payslip' | 'manage';

export default function PayrollPage() {
  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);
  const [tab, setTab] = useState<Tab>(canManagePayroll ? 'manage' : 'payslip');

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <PayrollTabs activeTab={tab} isAdmin={canManagePayroll} onTabChange={setTab} />
      {tab === 'payslip' && <MyPayslipTab />}
      {tab === 'manage' && canManagePayroll && <ManagePayrollTab />}
    </div>
  );
}
