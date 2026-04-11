import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  activeTab: 'my' | 'live' | 'records' | 'corrections';
  isManager: boolean;
  pendingCount: number;
  onTabChange: (tab: 'my' | 'live' | 'records' | 'corrections') => void;
}

export function TimeClockTabs({ activeTab, isManager, pendingCount, onTabChange }: Props) {
  const tabs = [
    { key: 'my', label: 'My Time' },
    ...(isManager
      ? [
          { key: 'live', label: 'Live' },
          { key: 'records', label: 'Records' },
          { key: 'corrections', label: 'Corrections', count: pendingCount },
        ]
      : []),
  ];

  return (
    <TabBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => onTabChange(tab as 'my' | 'live' | 'records' | 'corrections')}
    />
  );
}
