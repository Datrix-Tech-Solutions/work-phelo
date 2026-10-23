'use client';

import { useState } from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import type { Period } from '@/components/atoms/PeriodToggle';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useMarketingRevenueByProduct } from '@/hooks/marketing/useMarketingRevenueByProduct';
import { useElementSize } from '@/hooks/useElementSize';
import { cardClass, cn } from '@/lib/utils';
import { useThemeStore } from '@/store/theme.store';

const COLORS = [
  '#2a78d6',
  '#1baf7a',
  '#eb6834',
  '#a855f7',
  '#e34948',
  '#eda100',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#84cc16',
];

/** Products listed individually in the legend; the rest are summed into one "Other" row. */
const LEGEND_TOP = 6;
/** Slices past the top ones share two grays, so they match the "Other" legend dot. */
const OTHER_COLORS = ['#9ca3af', '#cbd5e1'];

const SUBTITLES: Record<Period, string> = {
  daily: 'Invoiced today',
  weekly: 'Invoiced this week',
  monthly: 'Invoiced this month',
  quarterly: 'Invoiced this quarter',
  yearly: 'Invoiced this year',
};

const fmt = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface RevenueByProductChartProps {
  period: Period;
  year: number;
  userId?: string;
  className?: string;
}

/** Revenue invoiced in the period, split by the product it was raised for. */
export function RevenueByProductChart({
  period,
  year,
  userId,
  className,
}: RevenueByProductChartProps) {
  const { data, isLoading, isError } = useMarketingRevenueByProduct(period, year, userId);
  const [hovered, setHovered] = useState<number | null>(null);
  const [areaRef, area] = useElementSize<HTMLDivElement>();
  const isDark = useThemeStore((s) => s.theme === 'dark');

  const currency = data?.currency ?? '';
  const money = (value: number | null) =>
    value === null ? '' : `${currency} ${fmt(value)}`.trim();
  const slices = (data?.products ?? []).map((product, i) => ({
    id: i,
    value: Number(product.amount),
    label: product.name,
    color: i < LEGEND_TOP ? COLORS[i % COLORS.length] : OTHER_COLORS[(i - LEGEND_TOP) % 2],
  }));
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  // The pie keeps every product. Only the legend folds the tail into "Other", and only when it
  // would hide more than one product.
  const grouped = slices.length > LEGEND_TOP + 1;
  const tail = grouped ? slices.slice(LEGEND_TOP) : [];
  const legendRows = [
    ...(grouped ? slices.slice(0, LEGEND_TOP) : slices).map((slice) => ({
      key: String(slice.id),
      label: slice.label,
      value: slice.value,
      color: slice.color,
      indices: [slice.id],
      title: undefined as string | undefined,
    })),
    ...(grouped
      ? [
          {
            key: 'other',
            label: `Other (${tail.length})`,
            value: tail.reduce((sum, slice) => sum + slice.value, 0),
            color: OTHER_COLORS[0],
            indices: tail.map((slice) => slice.id),
            title: tail.map((slice) => `${slice.label}: ${money(slice.value)}`).join('\n'),
          },
        ]
      : []),
  ];
  const activeSlice = hovered !== null ? slices[hovered] : null;
  // A square pie that fits the card's height, leaving most of the width for the list beside it.
  const pieSize = Math.max(0, Math.min(area.height, area.width * 0.45));

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-60', 'glass'), className)}>
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900">Achieved Revenue by Product/Service</h3>
        <span className="text-xs text-gray-400">{SUBTITLES[period]}</span>
      </div>

      <div ref={areaRef} className="relative flex-1 min-h-0">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : isError ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Revenue by product could not be loaded.
          </div>
        ) : slices.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            No invoices raised in this period.
          </div>
        ) : (
          <div className="flex h-full items-center gap-3">
            <div className="relative flex shrink-0 items-center justify-center">
              {pieSize > 0 && (
                <PieChart
                  width={pieSize}
                  height={pieSize}
                  series={[
                    {
                      data: slices,
                      outerRadius: pieSize / 2 - 4,
                      highlightScope: { fade: 'global', highlight: 'item' },
                      faded: { innerRadius: 26, additionalRadius: -26, color: 'gray' },
                      valueFormatter: (item) => money(item.value),
                    },
                  ]}
                  hideLegend
                  margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
                  onHighlightChange={(item) => setHovered(item?.dataIndex ?? null)}
                  slotProps={{ tooltip: { trigger: 'none' } as never }}
                />
              )}

              {activeSlice && (
                <div className="absolute left-1/2 -top-1 z-10 -translate-x-1/2 -translate-y-full pointer-events-none">
                  <div className="bg-(--chip-dark,#111827) text-white rounded-lg shadow-xl px-2.5 py-1.5 text-[10px] whitespace-nowrap flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: activeSlice.color }}
                      />
                      {activeSlice.label}
                      <span className="ml-auto pl-3 text-[#d1d5db]">
                        {total > 0 ? ((activeSlice.value / total) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </div>
                    <div className="border-t border-[#374151] pt-1 flex justify-between gap-4">
                      <span className="text-[#9ca3af]">Received</span>
                      <span className="font-medium">{money(activeSlice.value)}</span>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-(--chip-dark,#111827) rotate-45 rounded-sm" />
                </div>
              )}
            </div>

            <ul className="flex min-w-0 flex-1 flex-col gap-2 self-stretch justify-center overflow-y-auto">
              {legendRows.map((slice) => {
                const dimmed = hovered !== null && !slice.indices.includes(hovered);
                return (
                  <li
                    key={slice.key}
                    title={slice.title}
                    className="flex items-start justify-between gap-4 text-xs"
                  >
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
                          {money(slice.value)}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-gray-400">
                      {total > 0 ? `${((slice.value / total) * 100).toFixed(0)}%` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
