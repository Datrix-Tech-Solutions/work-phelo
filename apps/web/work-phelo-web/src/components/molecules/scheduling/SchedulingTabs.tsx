import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  activeTab: string;
  hasEmployeeProfile: boolean;
  canManageSchedules: boolean;
  onTabChange: (tab: string) => void;
}

export function SchedulingTabs({
  activeTab,
  hasEmployeeProfile,
  canManageSchedules,
  onTabChange,
}: Props) {
  const tabs = [
    ...(hasEmployeeProfile ? [{ key: 'my-schedule', label: 'My Schedule' }] : []),
    ...(canManageSchedules ? [{ key: 'shift-scheduler', label: 'Shift Scheduler' }] : []),
    ...(canManageSchedules ? [{ key: 'swap-requests', label: 'Swap Requests' }] : []),
  ];

  return <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />;
}
