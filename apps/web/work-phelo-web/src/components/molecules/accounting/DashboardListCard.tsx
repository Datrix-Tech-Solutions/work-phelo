'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Skeleton } from '@/components/atoms/Skeleton';
import { cardClass, cn } from '@/lib/utils';

export interface DashboardListRow {
  key: string;
  primary: string;
  secondary?: string;
  /** Right-aligned: an amount, a date or a badge. */
  trailing?: ReactNode;
}

export interface DashboardListSection {
  title: string;
  /** The full count, which can be more than the rows shown. */
  count: number | undefined;
  rows: DashboardListRow[];
  href: string;
  isLoading?: boolean;
  isError?: boolean;
  emptyText: string;
}

interface DashboardListCardProps {
  title: string;
  subtitle?: string;
  /** More than one section becomes tabs, one list shown at a time. */
  sections: DashboardListSection[];
  className?: string;
}

const TAB_ACTIVE =
  'relative font-semibold text-(--tab-active-text,var(--module-btn-bg,var(--color-brand))) after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t-full after:bg-(--tab-active-text,var(--module-btn-bg,var(--color-brand)))';
const TAB_IDLE = 'text-gray-600 hover:text-(--text-hover-strong,var(--color-gray-900))';

/** A fixed-height dashboard card (the height of the charts beside it) listing the few items that need attention, with a link to all. */
export function DashboardListCard({
  title,
  subtitle,
  sections,
  className,
}: DashboardListCardProps) {
  const [activeTitle, setActiveTitle] = useState(sections[0]?.title);
  const section = sections.find((s) => s.title === activeTitle) ?? sections[0];
  if (!section) return null;

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-60', 'glass'), className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
        </div>
        <Link
          href={section.href}
          className="shrink-0 text-xs font-medium text-brand hover:underline"
        >
          View all
        </Link>
      </div>

      {sections.length > 1 && (
        <div className="flex gap-4 border-b border-gray-200" role="tablist">
          {sections.map((s) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={s.title === section.title}
              onClick={() => setActiveTitle(s.title)}
              className={cn(
                'flex items-center gap-1.5 py-1.5 text-xs transition-colors whitespace-nowrap',
                s.title === section.title ? TAB_ACTIVE : TAB_IDLE,
              )}
            >
              {s.title}
              {(s.count ?? 0) > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                  {s.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {section.isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : section.isError ? (
          <span className="text-sm text-gray-400">Could not be loaded.</span>
        ) : section.rows.length === 0 ? (
          <span className="text-sm text-gray-400">{section.emptyText}</span>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {section.rows.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3 py-1.5">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-gray-900">{row.primary}</span>
                  {row.secondary && (
                    <span className="truncate text-xs text-gray-500">{row.secondary}</span>
                  )}
                </div>
                {row.trailing && (
                  <span className="shrink-0 text-xs tabular-nums text-gray-700">
                    {row.trailing}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
