'use client';

import { Button } from '@/components/atoms/Button';

export interface ShareBreakdownEntry {
  id: string;
  label: string;
  value: number;
  color: string;
  isPlaced: boolean;
}

interface PlacementShareBreakdownProps {
  total: number;
  totalLabel: string;
  entries: ShareBreakdownEntry[];
  onAddReinsurers: () => void;
  isAdding?: boolean;
}

export function PlacementShareBreakdown({
  total,
  totalLabel,
  entries,
  onAddReinsurers,
  isAdding = false,
}: PlacementShareBreakdownProps) {
  const placedEntries = entries.filter((e) => e.isPlaced);
  const placedPct = +placedEntries.reduce((sum, e) => sum + e.value, 0).toFixed(4);
  const availablePct = Math.max(0, +(total - placedPct).toFixed(4));

  return (
    <div className="bg-white rounded-xl border border-(--module-border,var(--color-gray-200)) p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-gray-900">Placement Share Breakdown</h3>
          <p className="text-xs text-gray-400">
            Distributed offers of the {totalLabel}{' '}
            <span className="font-semibold text-gray-600">{total}%</span>
          </p>
        </div>
        <Button size="sm" onClick={onAddReinsurers} isLoading={isAdding}>
          Add Reinsurers
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-medium text-gray-500">
          <span>Placed Capacity</span>
          <span>
            <span className="text-gray-700">{placedPct}%</span>
            <span className="text-gray-400"> / {total}%</span>
          </span>
        </div>

        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
          {placedEntries.map((entry) => (
            <div
              key={entry.id}
              style={{
                width: total > 0 ? `${(entry.value / total) * 100}%` : '0%',
                backgroundColor: entry.color,
              }}
              className="h-full transition-all duration-500"
            />
          ))}
        </div>

        <p className="text-xs text-gray-400">
          Available: <span className="font-semibold text-gray-600">{availablePct}%</span>
        </p>

        {entries.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span
                  className="text-xs"
                  style={{ color: entry.isPlaced ? entry.color : undefined }}
                >
                  <span className={entry.isPlaced ? 'font-medium' : 'text-gray-400'}>
                    {entry.label}
                  </span>
                  {entry.isPlaced && (
                    <span className="text-gray-400 font-normal"> · {entry.value}%</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
