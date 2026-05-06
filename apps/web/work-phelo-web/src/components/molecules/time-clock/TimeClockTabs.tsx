import { TabBar } from '@/components/molecules/shared/TabBar';

interface Props {
  activeTab: 'my' | 'live' | 'records' | 'corrections';
  canManageRecords: boolean;
  isEmployee: boolean;
  pendingCount: number;
  onTabChange: (tab: 'my' | 'live' | 'records' | 'corrections') => void;
}

export function TimeClockTabs({
  activeTab,
  canManageRecords,
  isEmployee,
  pendingCount,
  onTabChange,
}: Props) {
  const tabs = [
    ...(isEmployee ? [{ key: 'my', label: 'My Time' }] : []),
    ...(canManageRecords
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
