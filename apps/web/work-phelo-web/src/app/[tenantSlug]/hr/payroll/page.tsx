'use client';

import { use, useEffect, useMemo } from 'react';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { PayrollTabs } from '@/components/molecules/payroll/PayrollTabs';
import { MyPayslipTab } from '@/components/organisms/payroll/MyPayslipTab';
import { ManagePayrollTab } from '@/components/organisms/payroll/ManagePayrollTab';
import { SSNITTab } from '@/components/organisms/payroll/SSNITTab';
import { PensionTab_NG } from '@/components/organisms/payroll/PensionTab_NG';
import { NSSFTab_KE } from '@/components/organisms/payroll/NSSFTab_KE';
import { ApprovePayrollTab } from '@/components/organisms/payroll/ApprovePayrollTab';
import { PayrollHistoryTab } from '@/components/organisms/payroll/PayrollHistoryTab';
import { usePayrollSettings } from '@/hooks';

type Tab = 'payslip' | 'manage' | 'ssnit' | 'approve' | 'history';

export default function PayrollPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: payrollSettings } = usePayrollSettings();
  const payrollCountry = payrollSettings?.payrollCountry ?? 'GH';

  useEffect(() => {
    if (user !== null && !user.featureConfig?.hr?.payroll) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [user, tenantSlug, router]);

  const hasHRProfile = user?.role === 'EMPLOYEE';
  const canManagePayroll = usePermission(Permission.RUN_PAYROLL);
  const canApprovePayroll = usePermission(Permission.APPROVE_PAYROLL);
  const canViewHistory = canManagePayroll || canApprovePayroll;
  const searchParams = useSearchParams();

  const initialTab = useMemo((): Tab => {
    const t = searchParams.get('tab') as Tab | null;
    if (t === 'history' && canViewHistory) return 'history';
    if (t === 'approve' && canApprovePayroll) return 'approve';
    if (t === 'ssnit' && canManagePayroll) return 'ssnit';
    if (t === 'manage' && canManagePayroll) return 'manage';
    if (t === 'payslip' && hasHRProfile) return 'payslip';
    return canManagePayroll ? 'manage' : hasHRProfile ? 'payslip' : 'manage';
  }, [searchParams, canApprovePayroll, canManagePayroll, canViewHistory, hasHRProfile]);

  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  function renderContributionsTab() {
    if (payrollCountry === 'NG') return <PensionTab_NG />;
    if (payrollCountry === 'KE') return <NSSFTab_KE />;
    return <SSNITTab />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 flex-1 min-h-0">
      <div className="shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Payroll Management</h1>
      </div>
      <PayrollTabs
        activeTab={tab}
        isEmployee={hasHRProfile}
        canManage={canManagePayroll}
        canApprove={canApprovePayroll}
        canViewHistory={canViewHistory}
        country={payrollCountry}
        onTabChange={setTab}
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'payslip' && hasHRProfile && <MyPayslipTab />}
        {tab === 'manage' && canManagePayroll && <ManagePayrollTab />}
        {tab === 'ssnit' && canManagePayroll && renderContributionsTab()}
        {tab === 'approve' && canApprovePayroll && <ApprovePayrollTab />}
        {tab === 'history' && canViewHistory && <PayrollHistoryTab />}
      </div>
    </div>
  );
}
