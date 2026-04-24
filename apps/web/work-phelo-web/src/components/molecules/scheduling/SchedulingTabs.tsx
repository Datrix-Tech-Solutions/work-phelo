import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { key: 'my-schedule', label: 'My Schedule' },
  { key: 'shift-scheduler', label: 'Shift Scheduler' },
  { key: 'swap-requests', label: 'Swap Requests' },
];

export function SchedulingTabs({ activeTab, onTabChange }: Props) {
  return <TabBar tabs={TABS} activeTab={activeTab} onTabChange={onTabChange} />;
}
