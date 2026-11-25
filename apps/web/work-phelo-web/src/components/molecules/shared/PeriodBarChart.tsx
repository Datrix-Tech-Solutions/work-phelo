'use client';

import { useState } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useElementSize } from '@/hooks/useElementSize';
import type { SeriesBucket } from '@/lib/periodSeries';
import { cardClass, chartCardHoverClass, cn } from '@/lib/utils';

export interface PeriodBarSeries {
  label: string;
  color: string;
  /** One value per bucket, in bucket order; null draws no bar. */
  data: (number | null)[];
  /** Formats a value in the tooltip. */
  valueFormatter?: (value: number | null) => string;
}

interface PeriodBarChartProps {
  title: string;
  subtitle: string;
  buckets: Pick<SeriesBucket, 'label' | 'detail'>[];
  series: PeriodBarSeries[];
  isLoading?: boolean;
  isError?: boolean;
  errorText?: string;
  emptyText?: string;
  /** Formats the y-axis ticks. Defaults to plain numbers. */
  axisFormatter?: (value: number) => string;
  /** Count charts: no fractional ticks. */
  wholeNumbers?: boolean;
  /** Stacks the series into one bar per bucket instead of placing them side by side. */
  stacked?: boolean;
  /** Bars run left to right, with the buckets down the side. */
  horizontal?: boolean;
  /** Makes the bars clickable, naming the bar picked by its bucket and series positions. */
  onBarClick?: (bucketIndex: number, seriesIndex: number) => void;
  className?: string;
}

// Plot geometry shared with the chart below: the y-axis width and the right margin.
const AXIS_WIDTH = 48;
const MARGIN_RIGHT = 8;
// Used by horizontal bars, whose side axis holds names and whose bottom axis holds numbers.
const NAME_AXIS_WIDTH = 110;
const BOTTOM_AXIS_HEIGHT = 25;
const MARGIN_TOP = 8;

/** Grouped vertical bars over the ranges of a period filter, in a dashboard card. */
export function PeriodBarChart({
  title,
  subtitle,
  buckets,
  series,
  isLoading,
  isError,
  errorText = 'Could not be loaded.',
  emptyText = 'Nothing in this range.',
  axisFormatter = String,
  wholeNumbers,
  stacked,
  horizontal,
  onBarClick,
  className,
}: PeriodBarChartProps) {
  const [plotRef, plotSize] = useElementSize<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);
  const isEmpty = !isLoading && series.every((s) => s.data.every((value) => !value));

  const bandAxis = {
    data: buckets.map((b) => b.label),
    scaleType: 'band' as const,
    disableLine: true,
    disableTicks: true,
    categoryGapRatio: 0.35,
    // Leaves room for a hovered bar to grow without covering its neighbour.
    barGapRatio: 0.25,
    tickLabelStyle: { fontSize: 11, fill: 'var(--color-gray-700)' },
    valueFormatter: (label: string, context: { location: string }) =>
      context.location === 'tooltip'
        ? (buckets.find((b) => b.label === label)?.detail ?? label)
        : label,
  };
  const valueAxis = {
    disableLine: true,
    disableTicks: true,
    ...(wholeNumbers ? { tickMinStep: 1 } : {}),
    valueFormatter: (value: number) => axisFormatter(value),
    tickLabelStyle: { fontSize: 10, fill: 'var(--color-gray-500)' },
  };

  return (
    <div
      className={cn(
        cardClass('relative hover:z-20 flex flex-col gap-2 p-3 h-60', 'glass'),
        chartCardHoverClass,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <span className="text-xs text-gray-400">{subtitle}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div
        ref={plotRef}
        className="relative flex-1 min-h-0"
        onMouseMove={(event) => {
          // The hovered bucket comes from the pointer position, so the whole band is a target,
          // not only the bars. The tooltip is drawn by the card, like the pie charts', so it
          // can never fall outside the page.
          const box = event.currentTarget.getBoundingClientRect();
          const inner = horizontal
            ? box.height - MARGIN_TOP - BOTTOM_AXIS_HEIGHT
            : box.width - AXIS_WIDTH - MARGIN_RIGHT;
          const at = horizontal
            ? event.clientY - box.top - MARGIN_TOP
            : event.clientX - box.left - AXIS_WIDTH;
          if (buckets.length === 0 || inner <= 0 || at < 0 || at > inner) return setHovered(null);
          setHovered(Math.min(buckets.length - 1, Math.floor((at / inner) * buckets.length)));
        }}
        onMouseLeave={() => setHovered(null)}
      >
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : isError ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            {errorText}
          </div>
        ) : isEmpty ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            {emptyText}
          </div>
        ) : (
          plotSize.width > 0 &&
          plotSize.height > 0 && (
            <BarChart
              width={plotSize.width}
              height={plotSize.height}
              layout={horizontal ? 'horizontal' : 'vertical'}
              onItemClick={
                onBarClick && ((_, item) => onBarClick(item.dataIndex, Number(item.seriesId)))
              }
              series={series.map((s, i) => ({
                id: String(i),
                data: s.data,
                label: s.label,
                color: s.color,
                valueFormatter: s.valueFormatter,
                ...(stacked ? { stack: 'total' } : {}),
              }))}
              xAxis={[horizontal ? { ...valueAxis, height: BOTTOM_AXIS_HEIGHT } : bandAxis]}
              yAxis={[
                horizontal
                  ? { ...bandAxis, width: NAME_AXIS_WIDTH }
                  : { ...valueAxis, width: AXIS_WIDTH },
              ]}
              hideLegend
              slotProps={{ tooltip: { trigger: 'none' } as never }}
              axisHighlight={{ x: 'none', y: 'none' }}
              margin={{ left: 0, right: MARGIN_RIGHT, top: MARGIN_TOP, bottom: 0 }}
              grid={horizontal ? { vertical: true } : { horizontal: true }}
              sx={{
                '& .MuiBarChart-element': {
                  rx: 3,
                  ry: 3,
                  ...(onBarClick && { cursor: 'pointer' }),
                },
                // Each series lists its bars in period order (wrapped in a clip group when rounded).
                '& .MuiBarChart-series > *': {
                  // The overshoot on the outline gives the growth a small spring.
                  transition:
                    'filter 150ms ease, opacity 150ms ease, stroke-width 300ms cubic-bezier(0.34, 1.8, 0.64, 1)',
                  strokeWidth: 0,
                  strokeLinejoin: 'round',
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                },
                // An outline in the bar's own colour, so a hovered bar grows where it stands.
                ...Object.fromEntries(
                  series.map((s, i) => [
                    `& .MuiBarChart-series[data-series="${i}"] > *`,
                    { stroke: s.color },
                  ]),
                ),
                // The hovered period's bars get brighter and the others fade back, with no gray
                // band behind them.
                ...(hovered !== null && {
                  '& .MuiBarChart-series > *': {
                    opacity: 0.45,
                  },
                  [`& .MuiBarChart-series > :nth-of-type(${hovered + 1})`]: {
                    opacity: 1,
                    filter: 'brightness(1.15) saturate(1.2)',
                    strokeWidth: 5,
                  },
                }),
                // A clickable bar under the pointer stands out from its neighbour.
                ...(onBarClick && {
                  '& .MuiBarChart-element:hover': { filter: 'brightness(1.12) saturate(1.25)' },
                }),
                '& .MuiChartsGrid-line': {
                  stroke: 'var(--color-gray-200)',
                  strokeDasharray: '3 3',
                },
              }}
            />
          )
        )}

        {!isLoading && !isError && !isEmpty && hovered !== null && buckets[hovered] && (
          <div
            className={cn(
              'absolute z-10 -translate-x-1/2 -translate-y-full pointer-events-none',
              !horizontal && '-top-1',
            )}
            style={
              horizontal
                ? {
                    left: '50%',
                    top: `calc(${MARGIN_TOP}px + (100% - ${MARGIN_TOP + BOTTOM_AXIS_HEIGHT}px) * ${hovered / buckets.length})`,
                  }
                : {
                    left: `calc(${AXIS_WIDTH}px + (100% - ${AXIS_WIDTH + MARGIN_RIGHT}px) * ${(hovered + 0.5) / buckets.length})`,
                  }
            }
          >
            <div className="bg-(--chip-dark,#111827) text-white rounded-lg shadow-xl px-2.5 py-1.5 text-[10px] whitespace-nowrap flex flex-col gap-1">
              <div className="font-semibold text-[11px]">
                {buckets[hovered].detail ?? buckets[hovered].label}
              </div>
              <div className="border-t border-[#374151] pt-1 flex flex-col gap-0.5">
                {series.map((s) => {
                  const value = s.data[hovered] ?? null;
                  return (
                    <div key={s.label} className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-[#9ca3af]">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: s.color }}
                        />
                        {s.label}
                      </span>
                      <span className="font-medium">
                        {s.valueFormatter ? s.valueFormatter(value) : String(value ?? '')}
                      </span>
                    </div>
                  );
                })}
              </div>
              {onBarClick && (
                <div className="border-t border-[#374151] pt-1 text-[#9ca3af]">
                  Click a bar for details
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-(--chip-dark,#111827) rotate-45 rounded-sm" />
          </div>
        )}
      </div>
    </div>
  );
}
