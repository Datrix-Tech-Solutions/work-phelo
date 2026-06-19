'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TAB_ACTIVE =
  'relative text-(--module-btn-bg,var(--color-brand)) font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-(--module-btn-bg,var(--color-brand)) after:rounded-t-full';
const TAB_IDLE = 'text-gray-500 hover:text-gray-800';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  href?: string;
}

interface TabBarProps {
  tabs: TabItem[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  className?: string;
}

export function TabBar({ tabs, activeTab, onTabChange, className }: TabBarProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'flex items-end gap-1 border-b border-gray-200 shrink-0 overflow-x-auto scrollbar-none',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.href
          ? pathname === tab.href || pathname.startsWith(tab.href + '/')
          : activeTab === tab.key;

        const cls = cn(
          'relative px-6 py-3 text-sm transition-colors whitespace-nowrap flex items-center gap-2',
          isActive ? TAB_ACTIVE : TAB_IDLE,
        );

        const content = (
          <>
            {tab.label}
            {(tab.count ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                {tab.count}
              </span>
            )}
          </>
        );

        return tab.href ? (
          <Link key={tab.key} href={tab.href} className={cls}>
            {content}
          </Link>
        ) : (
          <button key={tab.key} onClick={() => onTabChange?.(tab.key)} className={cls}>
            {content}
          </button>
        );
      })}
    </div>
  );
}
