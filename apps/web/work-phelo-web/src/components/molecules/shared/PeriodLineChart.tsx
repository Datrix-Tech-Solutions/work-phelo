'use client';

import { useState } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';
import { Skeleton } from '@/components/atoms/Skeleton';
import { bucketTooltip, ChartTooltip } from '@/components/molecules/shared/ChartTooltip';
import { useElementSize } from '@/hooks/useElementSize';
import type { SeriesBucket } from '@/lib/periodSeries';
import { cardClass, chartCardHoverClass, cn } from '@/lib/utils';

export interface PeriodLineSeries {
  label: string;
  color: string;
  /** One value per bucket, in bucket order; null leaves a gap (nothing to measure). */
  data: (number | null)[];
  /** Formats a value in the tooltip. */
  valueFormatter?: (value: number | null) => string;
}

interface PeriodLineChartProps {
  title: string;
  subtitle: string;
  buckets: Pick<SeriesBucket, 'label' | 'detail'>[];
  series: PeriodLineSeries[];
  isLoading?: boolean;
  isError?: boolean;
  errorText?: string;
  emptyText?: string;
  /** Formats the y-axis ticks. Defaults to plain numbers. */
  axisFormatter?: (value: number) => string;
  /** Fills the space under each line. */
  area?: boolean;
  /** With one series of counts or totals, the tooltip also shows each bucket's share. */
  showShare?: boolean;
  className?: string;
}

const AXIS_WIDTH = 48;
const MARGIN_RIGHT = 16;

/** Lines over the ranges of a period filter, in a dashboard card. */
export function PeriodLineChart({
  title,
  subtitle,
  buckets,
  series,
  isLoading,
  isError,
  errorText = 'Could not be loaded.',
  emptyText = 'Nothing in this range.',
  axisFormatter = String,
  area,
  showShare,
  className,
}: PeriodLineChartProps) {
  const [plotRef, plotSize] = useElementSize<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);
  const isEmpty = !isLoading && series.every((s) => s.data.every((value) => value === null));

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
          // The nearest point to the pointer, as the points are spread evenly across the plot.
          const box = event.currentTarget.getBoundingClientRect();
          const inner = box.width - AXIS_WIDTH - MARGIN_RIGHT;
          const x = event.clientX - box.left - AXIS_WIDTH;
          if (buckets.length === 0 || inner <= 0 || x < 0) return setHovered(null);
          const nearest = Math.round((x / inner) * (buckets.length - 1));
          setHovered(Math.min(buckets.length - 1, nearest));
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
            <LineChart
              width={plotSize.width}
              height={plotSize.height}
              series={series.map((s) => ({
                data: s.data,
                label: s.label,
                color: s.color,
                valueFormatter: s.valueFormatter,
                curve: 'monotoneX',
                // Marks crowd into each other on long series.
                showMark: buckets.length <= 24,
                area,
                connectNulls: false,
                // Pointing at a line fades the others.
                highlightScope: { highlight: 'series', fade: 'global' },
              }))}
              xAxis={[
                {
                  data: buckets.map((b) => b.label),
                  scaleType: 'point',
                  disableLine: true,
                  disableTicks: true,
                  tickLabelStyle: { fontSize: 11, fill: 'var(--color-gray-700)' },
                  valueFormatter: (label: string, context) =>
                    context.location === 'tooltip'
                      ? (buckets.find((b) => b.label === label)?.detail ?? label)
                      : label,
                },
              ]}
              yAxis={[
                {
                  disableLine: true,
                  disableTicks: true,
                  width: AXIS_WIDTH,
                  valueFormatter: (value: number) => axisFormatter(value),
                  tickLabelStyle: { fontSize: 10, fill: 'var(--color-gray-500)' },
                },
              ]}
              hideLegend
              slotProps={{ tooltip: { trigger: 'none' } as never }}
              margin={{ left: 0, right: MARGIN_RIGHT, top: 8, bottom: 0 }}
              grid={{ horizontal: true }}
              sx={{
                '& .MuiChartsGrid-line': {
                  stroke: 'var(--color-gray-200)',
                  strokeDasharray: '3 3',
                },
              }}
            />
          )
        )}

        {!isLoading && !isError && !isEmpty && hovered !== null && buckets[hovered] && (
          <ChartTooltip
            {...bucketTooltip(
              buckets[hovered].detail ?? buckets[hovered].label,
              series,
              hovered,
              showShare,
            )}
            className="-top-1"
            style={{
              // A lone point sits in the middle of the plot.
              left: `calc(${AXIS_WIDTH}px + (100% - ${AXIS_WIDTH + MARGIN_RIGHT}px) * ${buckets.length > 1 ? hovered / (buckets.length - 1) : 0.5})`,
            }}
          />
        )}
      </div>
    </div>
  );
}
