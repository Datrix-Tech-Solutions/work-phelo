'use client';

import { BarChart } from '@mui/x-charts/BarChart';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useElementSize } from '@/hooks/useElementSize';
import type { SeriesBucket } from '@/lib/periodSeries';
import { cardClass, cn } from '@/lib/utils';

export interface PeriodBarSeries {
  label: string;
  color: string;
  /** One value per bucket, in bucket order. */
  data: number[];
  /** Formats a value in the tooltip. */
  valueFormatter?: (value: number | null) => string;
}

interface PeriodBarChartProps {
  title: string;
  subtitle: string;
  buckets: SeriesBucket[];
  series: PeriodBarSeries[];
  isLoading?: boolean;
  isError?: boolean;
  errorText?: string;
  emptyText?: string;
  /** Formats the y-axis ticks. Defaults to plain numbers. */
  axisFormatter?: (value: number) => string;
  /** Count charts: no fractional ticks. */
  wholeNumbers?: boolean;
  className?: string;
}

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
  className,
}: PeriodBarChartProps) {
  const [plotRef, plotSize] = useElementSize<HTMLDivElement>();
  const isEmpty = !isLoading && series.every((s) => s.data.every((value) => value === 0));

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-60', 'glass'), className)}>
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

      <div ref={plotRef} className="relative flex-1 min-h-0">
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
              series={series.map((s) => ({
                data: s.data,
                label: s.label,
                color: s.color,
                valueFormatter: s.valueFormatter,
              }))}
              xAxis={[
                {
                  data: buckets.map((b) => b.label),
                  scaleType: 'band',
                  disableLine: true,
                  disableTicks: true,
                  categoryGapRatio: 0.35,
                  barGapRatio: 0.1,
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
                  width: 48,
                  ...(wholeNumbers ? { tickMinStep: 1 } : {}),
                  valueFormatter: (value: number) => axisFormatter(value),
                  tickLabelStyle: { fontSize: 10, fill: 'var(--color-gray-500)' },
                },
              ]}
              hideLegend
              margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
              grid={{ horizontal: true }}
              sx={{
                '& .MuiBarChart-element': { rx: 3, ry: 3 },
                '& .MuiChartsGrid-line': {
                  stroke: 'var(--color-gray-200)',
                  strokeDasharray: '3 3',
                },
              }}
            />
          )
        )}
      </div>
    </div>
  );
}
