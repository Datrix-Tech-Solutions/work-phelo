'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/atoms/Skeleton';
import { cardClass, cn, waterIconStyle } from '@/lib/utils';

export interface TransportListItem {
  id: string;
  icon: LucideIcon;
  /** Seeds the icon's water-glass circle. */
  color: string;
  title: string;
  /** Smaller line under the title. */
  detail?: string;
  /** Right-aligned text, e.g. a time or how long ago. */
  trailing?: string;
  /** Tints the trailing text to flag lateness. */
  trailingTone?: 'red';
}

interface Props {
  title: string;
  subtitle: string;
  /** Shown beside the title, e.g. how many there are in all. */
  count?: number;
  items: TransportListItem[];
  isLoading?: boolean;
  isError?: boolean;
  emptyText: string;
  errorText?: string;
  action?: { href: string; label: string };
  /** Makes each row clickable; called with the row's id. */
  onSelect?: (id: string) => void;
  className?: string;
}

/** A dashboard card listing a few rows, laid out like HR's Recent Activity: icon, text, time. */
export function TransportListCard({
  title,
  subtitle,
  count,
  items,
  isLoading,
  isError,
  emptyText,
  errorText = 'Could not be loaded.',
  action,
  onSelect,
  className,
}: Props) {
  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-72', 'glass'), className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-gray-900">
            {title}
            {count !== undefined && count > 0 && (
              <span className="ml-1.5 rounded-full bg-orange-500 px-1.5 py-px text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </h3>
          <span className="text-xs text-gray-400">{subtitle}</span>
        </div>
        {action && (
          <Link
            href={action.href}
            className="text-xs font-medium text-(--module-btn-bg,#0466f8) hover:underline"
          >
            {action.label}
          </Link>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            {errorText}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            {emptyText}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map(({ id, icon: Icon, color, title: text, detail, trailing, trailingTone }) => (
              <li key={id}>
                {(() => {
                  const content = (
                    <>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={waterIconStyle(color)}
                      >
                        <Icon
                          className="w-3.5 h-3.5"
                          style={{ color: `color-mix(in oklab, ${color} 65%, black)` }}
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-xs font-semibold text-gray-900">{text}</span>
                        {detail && (
                          <span className="truncate text-[10px] text-gray-400">{detail}</span>
                        )}
                      </div>
                      {trailing && (
                        <span
                          className={cn(
                            'shrink-0 text-[10px]',
                            trailingTone === 'red' ? 'text-red-600' : 'text-gray-400',
                          )}
                        >
                          {trailing}
                        </span>
                      )}
                    </>
                  );
                  const rowClass = 'flex w-full items-start gap-2.5 text-left';
                  return onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(id)}
                      className={cn(
                        rowClass,
                        '-mx-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-gray-100/70',
                      )}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className={rowClass}>{content}</div>
                  );
                })()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
