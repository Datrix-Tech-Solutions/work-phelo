'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
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

const MAX_INLINE = 9;

const TILE_CLASS =
  'group relative flex flex-col items-center gap-1 rounded-xl border border-(--qa-tile-border,rgba(255,255,255,0.4)) bg-(--qa-tile-bg,rgba(255,255,255,0.95)) p-1.5 shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-1 hover:bg-(--tint) hover:shadow-lg';

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
 * A dashboard's "Quick Actions" card, in the HR home page's tile grid. The most-used actions float to the top, like the HR home
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
  const [expanded, setExpanded] = useState(false);
  if (ordered.length === 0) return null;

  const hasOverflow = ordered.length > MAX_INLINE;
  const overflow = hasOverflow ? ordered.slice(MAX_INLINE - 1) : [];
  const shown = hasOverflow && !expanded ? ordered.slice(0, MAX_INLINE - 1) : ordered;

  return (
    // Filling the cell adds no height of its own, so the row is as tall as the charts beside it
    // and the tiles scroll if they don't fit.
    <div className={cn('relative', className)}>
      <QuickActionsPanel className={cn(fillCell && 'lg:absolute lg:inset-0')}>
        <div className="grid grid-cols-4 gap-1.5 min-h-0 overflow-y-auto">
          {shown.map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                recordUse(key);
                onSelect(key);
              }}
              className={TILE_CLASS}
              title={label}
              aria-label={label}
              style={
                {
                  '--tint': `color-mix(in oklab, ${color} 14%, var(--background))`,
                } as React.CSSProperties
              }
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
                style={waterIconStyle(color)}
              >
                <Icon
                  className="w-5 h-5"
                  style={{ color: `color-mix(in oklab, ${color} 65%, black)` }}
                />
              </div>
              <span className="w-full text-center text-[11px] font-medium leading-tight text-gray-700 line-clamp-2">
                {label}
              </span>
            </button>
          ))}

          {hasOverflow && (
            <button
              type="button"
              onClick={() => setExpanded((o) => !o)}
              className="col-span-4 flex w-full items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
            >
              {expanded ? 'Show less' : `More (${overflow.length})`}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      </QuickActionsPanel>
    </div>
  );
}
