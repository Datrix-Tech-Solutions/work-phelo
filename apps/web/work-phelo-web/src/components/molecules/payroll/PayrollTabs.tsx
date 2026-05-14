import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  activeTab: 'payslip' | 'manage' | 'ssnit' | 'approve' | 'history';
  canManage: boolean;
  canApprove: boolean;
  canViewHistory: boolean;
  country?: string;
  onTabChange: (tab: 'payslip' | 'manage' | 'ssnit' | 'approve' | 'history') => void;
}

function contributionsTabLabel(country?: string) {
  if (country === 'Nigeria') return 'Pension';
  if (country === 'Kenya') return 'NSSF';
  return 'SSNIT';
}

export function PayrollTabs({
  activeTab,
  canManage,
  canApprove,
  canViewHistory,
  country,
  onTabChange,
}: Props) {
  const tabs = [
    { key: 'payslip', label: 'My Payslip' },
    ...(canManage ? [{ key: 'manage', label: 'Manage Payroll' }] : []),
    ...(canManage ? [{ key: 'ssnit', label: contributionsTabLabel(country) }] : []),
    ...(canApprove ? [{ key: 'approve', label: 'Approve Payroll' }] : []),
    ...(canViewHistory ? [{ key: 'history', label: 'History' }] : []),
  ];

  return (
    <TabBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) =>
        onTabChange(tab as 'payslip' | 'manage' | 'ssnit' | 'approve' | 'history')
      }
    />
  );
}
