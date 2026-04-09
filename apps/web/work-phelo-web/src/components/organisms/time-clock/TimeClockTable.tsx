import { cn } from '@/lib/utils';

const TAB_ACTIVE =
  'relative text-[#0D2244] font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#0D2244] after:rounded-t-full';
const TAB_IDLE = 'text-gray-500 hover:text-gray-800';

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
          {
            key: 'corrections',
            label: `Corrections${pendingCount > 0 ? ` (${pendingCount})` : ''}`,
          },
        ]
      : []),
  ] as const;

  return (
    <div className="flex items-end gap-1 border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={cn(
            'relative px-6 py-3 text-sm transition-colors whitespace-nowrap',
            activeTab === tab.key ? TAB_ACTIVE : TAB_IDLE,
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
