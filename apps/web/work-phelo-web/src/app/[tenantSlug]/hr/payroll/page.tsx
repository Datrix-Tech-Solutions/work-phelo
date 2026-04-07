'use client';
import { useState, useMemo } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';
import { MyPayslipTab } from '@/components/organisms/payroll/MyPayslipTab';
import { ManagePayrollTab } from '@/components/organisms/payroll/ManagePayrollTab';
import { useEmployees, useMyProfile } from '@/hooks';
import { calculatePayroll } from '@/lib/payrollCalculations';

const TAB_ACTIVE =
  'relative text-[#0D2244] font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#0D2244] after:rounded-t-full';
const TAB_IDLE = 'text-gray-500 hover:text-gray-800';
type Tab = 'payslip' | 'manage';

export default function PayrollPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'TENANT_ADMIN' || user?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<Tab>(isAdmin ? 'manage' : 'payslip');

  const { data: myEmployee } = useMyProfile();
  const { data: empData, isLoading } = useEmployees();

  const payrollData = useMemo(() => {
    const employees = empData?.data ?? [];
    return employees.map((e: any) => {
      const basic = Number(e.basicSalary) || 0;
      const allowances = 1000;
      const calc = calculatePayroll({ basicSalary: basic, allowances });
      return {
        id: e.id,
        employeeName: `${e.firstName} ${e.lastName}`,
        avatarUrl: e.avatarUrl,
        basicSalary: basic,
        allowances,
        grossSalary: calc.grossSalary,
        employeeSSNIT: calc.employeeSSNIT,
        taxableIncome: calc.taxableIncome,
        paye: calc.paye,
        netSalary: calc.netSalary,
        department: e.department?.name,
      };
    });
  }, [empData]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
        <p className="text-sm text-gray-500 mt-1">Manage payroll and view payslips</p>
      </div>

      {isAdmin && (
        <div className="flex gap-6 border-b border-gray-200 mb-6">
          <button
            className={cn(
              'pb-3 text-sm transition-colors',
              tab === 'payslip' ? TAB_ACTIVE : TAB_IDLE,
            )}
            onClick={() => setTab('payslip')}
          >
            My Payslip
          </button>
          <button
            className={cn(
              'pb-3 text-sm transition-colors',
              tab === 'manage' ? TAB_ACTIVE : TAB_IDLE,
            )}
            onClick={() => setTab('manage')}
          >
            Manage Payroll
          </button>
        </div>
      )}

      {tab === 'payslip' && <MyPayslipTab employee={myEmployee} />}
      {tab === 'manage' && isAdmin && (
        <ManagePayrollTab
          payrollData={payrollData}
          isLoading={isLoading}
          onAllowancesChange={() => {}}
          onDownloadPayslip={() => {}}
          onExportFullPayroll={() => {}}
        />
      )}
    </div>
  );
}
