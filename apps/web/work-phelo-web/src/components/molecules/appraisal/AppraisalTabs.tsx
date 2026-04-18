import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  activeTab: 'my' | 'team' | 'hr';
  isEmployee: boolean;
  isManager: boolean;
  isHR: boolean;
  onTabChange: (tab: 'my' | 'team' | 'hr') => void;
}

export function AppraisalTabs({ activeTab, isEmployee, isManager, isHR, onTabChange }: Props) {
  const tabs = [
    ...(isEmployee ? [{ key: 'my', label: 'My Appraisal' }] : []),
    ...(isManager ? [{ key: 'team', label: 'Team Review' }] : []),
    ...(isHR ? [{ key: 'hr', label: 'Appraisals' }] : []),
  ];

  return (
    <TabBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => onTabChange(tab as 'my' | 'team' | 'hr')}
    />
  );
}
