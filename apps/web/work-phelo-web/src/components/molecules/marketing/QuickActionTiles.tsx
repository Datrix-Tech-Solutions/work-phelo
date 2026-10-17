'use client';

import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { QuickActionsPanel } from '@/components/atoms/QuickActionsPanel';
import { useTabUsage } from '@/hooks/useTabUsage';
import { cn, waterIconStyle } from '@/lib/utils';

export interface QuickActionEntry<K extends string> {
  key: K;
  label: string;
  icon: LucideIcon;
  color: string;
  /** Hidden when false, e.g. the user lacks the permission. */
  allowed: boolean;
}

const TILE_CLASS =
  'group flex w-full items-center gap-3 rounded-2xl border border-(--qa-tile-border,rgba(255,255,255,0.4)) bg-(--qa-tile-bg,rgba(255,255,255,0.95)) px-3 py-1.5 text-left shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-1 hover:bg-(--tint) hover:shadow-lg';

interface Props<K extends string> {
  /** localStorage key the usage counts are kept under; one per dashboard. */
  storageKey: string;
  /** Keep this list stable (memoised): it is the ordering input. */
  entries: QuickActionEntry<K>[];
  onSelect: (key: K) => void;
  className?: string;
  /** On wide screens, fill the grid cell instead of adding to its height. */
  fillCell?: boolean;
}

/**
 * A dashboard's "Quick Actions" card. The most-used actions float to the top, like the HR home
 * page; the order is frozen for the visit. Renders nothing when no action is allowed.
 */
export function QuickActionTiles<K extends string>({
  storageKey,
  entries,
  onSelect,
  className,
  fillCell = false,
}: Props<K>) {
  const visible = useMemo(() => entries.filter((entry) => entry.allowed), [entries]);
  const { tabs: ordered, recordUse } = useTabUsage(storageKey, visible, { pinFirst: false });
  if (ordered.length === 0) return null;

  return (
    // Filling the cell adds no height of its own, so the row is as tall as the charts beside it
    // and the tiles scroll if they don't fit.
    <div className={cn('relative', className)}>
      <QuickActionsPanel className={cn('py-3 gap-2', fillCell && 'lg:absolute lg:inset-0')}>
        <div className="flex flex-col gap-2 min-h-0 overflow-y-auto">
          {ordered.map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                recordUse(key);
                onSelect(key);
              }}
              className={TILE_CLASS}
              style={
                {
                  '--tint': `color-mix(in oklab, ${color} 14%, var(--background))`,
                } as React.CSSProperties
              }
            >
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
                style={waterIconStyle(color)}
              >
                <Icon
                  className="w-4 h-4"
                  style={{ color: `color-mix(in oklab, ${color} 65%, black)` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      </QuickActionsPanel>
    </div>
  );
}
