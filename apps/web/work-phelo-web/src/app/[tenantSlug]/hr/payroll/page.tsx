'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { PayrollTabs } from '@/components/molecules/payroll/PayrollTabs';
import { MyPayslipTab } from '@/components/organisms/payroll/MyPayslipTab';
import { ManagePayrollTab } from '@/components/organisms/payroll/ManagePayrollTab';

type Tab = 'payslip' | 'manage';

export default function PayrollPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'TENANT_ADMIN' || user?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<Tab>(isAdmin ? 'manage' : 'payslip');

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <PayrollTabs activeTab={tab} isAdmin={isAdmin} onTabChange={setTab} />
      {tab === 'payslip' && <MyPayslipTab />}
      {tab === 'manage' && isAdmin && <ManagePayrollTab />}
    </div>
  );
}
