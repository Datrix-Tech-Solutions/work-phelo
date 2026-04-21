import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  activeTab: 'payslip' | 'manage';
  isAdmin: boolean;
  onTabChange: (tab: 'payslip' | 'manage') => void;
}

export function PayrollTabs({ activeTab, isAdmin, onTabChange }: Props) {
  const tabs = [
    { key: 'payslip', label: 'My Payslip' },
    ...(isAdmin ? [{ key: 'manage', label: 'Manage Payroll' }] : []),
  ];

  return (
    <TabBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => onTabChange(tab as 'payslip' | 'manage')}
    />
  );
}
