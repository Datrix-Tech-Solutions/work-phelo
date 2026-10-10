'use client';

import { useState } from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import type { Period } from '@/components/atoms/PeriodToggle';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useMarketingRevenueByProduct } from '@/hooks/marketing/useMarketingRevenueByProduct';
import { useElementSize } from '@/hooks/useElementSize';
import { cardClass, cn } from '@/lib/utils';

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

const SUBTITLES: Record<Period, string> = {
  daily: 'Received today',
  weekly: 'Received this week',
  monthly: 'Received this month',
  quarterly: 'Received this quarter',
  yearly: 'Received this year',
};

const fmt = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface RevenueByProductChartProps {
  period: Period;
  year: number;
  className?: string;
}

/** Revenue received in the period, split by the product it was raised for. */
export function RevenueByProductChart({ period, year, className }: RevenueByProductChartProps) {
  const { data, isLoading, isError } = useMarketingRevenueByProduct(period, year);
  const [hovered, setHovered] = useState<number | null>(null);
  const [areaRef, area] = useElementSize<HTMLDivElement>();

  const currency = data?.currency ?? '';
  const money = (value: number | null) =>
    value === null ? '' : `${currency} ${fmt(value)}`.trim();
  const slices = (data?.products ?? []).map((product, i) => ({
    id: i,
    value: Number(product.amount),
    label: product.name,
    color: COLORS[i % COLORS.length],
  }));
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  // A square pie that fits the card's height, leaving most of the width for the list beside it.
  const pieSize = Math.max(0, Math.min(area.height, area.width * 0.45));

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-60', 'glass'), className)}>
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900">Achieved Revenue by Product</h3>
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
            No revenue received in this period.
          </div>
        ) : (
          <div className="flex h-full items-center gap-3">
            <div className="flex shrink-0 items-center justify-center">
              {pieSize > 0 && (
                <PieChart
                  width={pieSize}
                  height={pieSize}
                  series={[
                    {
                      data: slices,
                      outerRadius: pieSize / 2 - 4,
                      highlightScope: { fade: 'global', highlight: 'item' },
                      faded: { additionalRadius: -4, color: 'gray' },
                      valueFormatter: (item) => money(item.value),
                    },
                  ]}
                  hideLegend
                  margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
                  onHighlightChange={(item) => setHovered(item?.dataIndex ?? null)}
                />
              )}
            </div>

            <ul className="flex min-w-0 flex-1 flex-col gap-2 self-stretch justify-center overflow-y-auto">
              {slices.map((slice, i) => (
                <li
                  key={slice.id}
                  className="flex items-start gap-2 text-xs transition-opacity"
                  style={{ opacity: hovered !== null && hovered !== i ? 0.4 : 1 }}
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: slice.color }}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-gray-700">{slice.label}</span>
                    <span className="truncate text-[10px] text-gray-500">
                      <span className="font-semibold text-gray-700">{money(slice.value)}</span>
                      {total > 0 ? ` · ${((slice.value / total) * 100).toFixed(0)}%` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
