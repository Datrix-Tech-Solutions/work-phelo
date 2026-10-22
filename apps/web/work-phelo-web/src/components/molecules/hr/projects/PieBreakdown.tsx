'use client';

import { useState } from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import { useElementSize } from '@/hooks/useElementSize';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/theme.store';

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: PieSlice[];
  /** Singular noun for the legend and tooltip, e.g. "task". */
  unit: string;
  className?: string;
}

/**
 * A pie with its legend beside it, styled like the HR dashboard's department distribution: hover a slice
 * for a tooltip, and the legend dims everything else. Give it a height; the pie fits inside.
 */
export function PieBreakdown({ slices, unit, className }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [areaRef, area] = useElementSize<HTMLDivElement>();
  const isDark = useThemeStore((s) => s.theme === 'dark');

  const data = slices.map((slice, id) => ({ id, ...slice }));
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const active = hovered !== null ? data[hovered] : null;
  const share = (value: number) => (total > 0 ? (value / total) * 100 : 0);
  const plural = (n: number) => (n === 1 ? unit : `${unit}s`);
  // A square pie that fits the height, leaving most of the width for the list beside it.
  const pieSize = Math.max(0, Math.min(area.height, area.width * 0.45));

  return (
    <div ref={areaRef} className={cn('relative min-h-0', className)}>
      <div className="flex h-full items-center gap-3">
        <div className="relative flex shrink-0 items-center justify-center">
          {pieSize > 0 && (
            <PieChart
              width={pieSize}
              height={pieSize}
              series={[
                {
                  data,
                  outerRadius: pieSize / 2 - 4,
                  highlightScope: { fade: 'global', highlight: 'item' },
                  faded: { innerRadius: 18, additionalRadius: -18, color: 'gray' },
                },
              ]}
              hideLegend
              margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
              onHighlightChange={(item) => setHovered(item?.dataIndex ?? null)}
              slotProps={{ tooltip: { trigger: 'none' } as never }}
            />
          )}

          {active && (
            <div className="absolute left-1/2 -top-1 z-10 -translate-x-1/2 -translate-y-full pointer-events-none">
              <div className="bg-(--chip-dark,#111827) text-white rounded-lg shadow-xl px-2.5 py-1.5 text-[10px] whitespace-nowrap flex flex-col gap-1">
                <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: active.color }}
                  />
                  {active.label}
                  <span className="ml-auto pl-3 text-[#d1d5db]">
                    {share(active.value).toFixed(1)}%
                  </span>
                </div>
                <div className="border-t border-[#374151] pt-1 flex justify-between gap-4">
                  <span className="text-[#9ca3af] capitalize">{plural(2)}</span>
                  <span className="font-medium">{active.value}</span>
                </div>
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-(--chip-dark,#111827) rotate-45 rounded-sm" />
            </div>
          )}
        </div>

        <ul className="flex min-w-0 flex-1 flex-col gap-2 self-stretch justify-center overflow-y-auto">
          {data.map((slice) => {
            const dimmed = hovered !== null && hovered !== slice.id;
            return (
              <li key={slice.label} className="flex items-start justify-between gap-4 text-xs">
                <span className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full transition-colors duration-200"
                    style={{ background: dimmed ? '#d1d5db' : slice.color }}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span
                      className="truncate transition-colors duration-200"
                      style={{
                        color: dimmed
                          ? isDark
                            ? '#374151'
                            : '#9ca3af'
                          : isDark
                            ? '#9ca3af'
                            : '#374151',
                      }}
                    >
                      {slice.label}
                    </span>
                    <span className="truncate text-[10px] font-semibold text-gray-700">
                      {slice.value} {plural(slice.value)}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-gray-400">{share(slice.value).toFixed(0)}%</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
