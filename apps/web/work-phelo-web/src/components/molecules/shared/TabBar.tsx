import { cn } from '@/lib/utils';

const TAB_ACTIVE =
  'relative text-brand font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand after:rounded-t-full';
const TAB_IDLE = 'text-gray-500 hover:text-gray-800';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

export function TabBar({ tabs, activeTab, onTabChange, className }: TabBarProps) {
  return (
    <div className={cn('flex items-end gap-1 border-b border-gray-200 shrink-0', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={cn(
            'relative px-6 py-3 text-sm transition-colors whitespace-nowrap flex items-center gap-2',
            activeTab === tab.key ? TAB_ACTIVE : TAB_IDLE,
          )}
        >
          {tab.label}
          {(tab.count ?? 0) > 0 && (
            <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
