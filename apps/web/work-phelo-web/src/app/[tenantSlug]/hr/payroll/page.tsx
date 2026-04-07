// PAYROLL PAGE //

'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { MyPayslipTab } from '@/components/organisms/payroll/MyPayslipTab';
import { ManagePayrollTab } from '@/components/organisms/payroll/ManagePayrollTab';

const TAB_ACTIVE =
  'relative text-[#0D2244] font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#0D2244] after:rounded-t-full';
const TAB_IDLE = 'text-gray-500 hover:text-gray-800';

type Tab = 'payslip' | 'manage';

export default function PayrollPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'TENANT_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<Tab>('payslip');

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Payroll</h1>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex items-center gap-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('payslip')}
          className={cn(
            'relative pb-3 text-sm transition-colors',
            activeTab === 'payslip' ? TAB_ACTIVE : TAB_IDLE,
          )}
        >
          My Payslip
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('manage')}
            className={cn(
              'relative pb-3 text-sm transition-colors',
              activeTab === 'manage' ? TAB_ACTIVE : TAB_IDLE,
            )}
          >
            Manage Payroll
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex flex-col flex-1 min-h-0">
        {activeTab === 'payslip' && <MyPayslipTab employee={undefined} />}
        {activeTab === 'manage' && isAdmin && (
          <ManagePayrollTab
            payrollData={[]}
            onAllowancesChange={() => {}}
            onDownloadPayslip={() => {}}
            onExportFullPayroll={() => {}}
          />
        )}
      </div>
    </div>
  );
}
