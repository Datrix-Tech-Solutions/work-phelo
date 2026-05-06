import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  activeTab: 'payslip' | 'manage' | 'approve' | 'history';
  canManage: boolean;
  canApprove: boolean;
  onTabChange: (tab: 'payslip' | 'manage' | 'approve' | 'history') => void;
}

export function PayrollTabs({ activeTab, canManage, canApprove, onTabChange }: Props) {
  const tabs = [
    { key: 'payslip', label: 'My Payslip' },
    ...(canManage ? [{ key: 'manage', label: 'Manage Payroll' }] : []),
    ...(canApprove ? [{ key: 'approve', label: 'Approve Payroll' }] : []),
    ...(canApprove ? [{ key: 'history', label: 'History' }] : []),
  ];

  return (
    <TabBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => onTabChange(tab as 'payslip' | 'manage' | 'approve' | 'history')}
    />
  );
}
