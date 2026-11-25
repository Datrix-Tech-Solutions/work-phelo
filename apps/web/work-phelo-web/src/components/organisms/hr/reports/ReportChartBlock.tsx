'use client';

import { useState } from 'react';
import { ScatterChart } from '@mui/x-charts/ScatterChart';
import { Skeleton } from '@/components/atoms/Skeleton';
import { PieBreakdown } from '@/components/molecules/hr/projects/PieBreakdown';
import { ChartTooltip } from '@/components/molecules/shared/ChartTooltip';
import { PeriodBarChart } from '@/components/molecules/shared/PeriodBarChart';
import { PeriodLineChart } from '@/components/molecules/shared/PeriodLineChart';
import { useRunReportBlock } from '@/hooks/hr/useReports';
import { useElementSize } from '@/hooks/useElementSize';
import { apiErrorMessage } from '@/lib/apiError';
import { CHART_TYPE_LABELS } from '@/lib/hr/reportBuilder';
import { cardClass, cn } from '@/lib/utils';
import { ChartResult, ReportBlock, ReportPeriod } from '@/types/reports';

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

/** Past these, a card is too crowded at normal width: bars side by side, or points along a line. */
const WIDE_BARS = 8;
const WIDE_POINTS = 12;

/** Whether a chart has enough along its horizontal axis to need a wider card. Horizontal bars,
 * pies and scatters gain little from extra width. */
function needsWideCard(result: ChartResult) {
  if (result.chartType === 'LINE' || result.chartType === 'AREA') {
    return result.rows.length > WIDE_POINTS;
  }
  if (result.chartType === 'BAR') return result.rows.length * result.measures.length > WIDE_BARS;
  return result.chartType === 'BAR_STACKED' && result.rows.length > WIDE_BARS;
}

const AXIS_TEXT = { fontSize: 11, fill: 'var(--color-gray-700)' };
const EMPTY_TEXT = 'No data for this selection.';

const formatNumber = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('en-GB', { maximumFractionDigits: 2 });

/** Short axis ticks, so large totals fit beside the plot. */
const formatTick = (value: number) =>
  value.toLocaleString('en-GB', { notation: 'compact', maximumFractionDigits: 1 });

function Scatter({ result }: { result: ChartResult }) {
  const [plotRef, { width, height }] = useElementSize<HTMLDivElement>();
  const points = result.points ?? [];
  const [hovered, setHovered] = useState<number | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const active = hovered !== null ? points[hovered] : undefined;

  return (
    <div
      ref={plotRef}
      className="relative flex-1 min-h-0"
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        setPointer({ x: event.clientX - box.left, y: event.clientY - box.top });
      }}
      onPointerLeave={() => setHovered(null)}
    >
      {width > 0 && height > 0 && (
        <ScatterChart
          width={width}
          height={height}
          series={[
            {
              data: points.map((p, i) => ({ x: p.x, y: p.y, id: i })),
              color: COLORS[0],
              highlightScope: { highlight: 'item' },
            },
          ]}
          onHighlightChange={(item) => setHovered(item?.dataIndex ?? null)}
          slotProps={{ tooltip: { trigger: 'none' } as never }}
          xAxis={[{ label: result.measures[0]?.label, tickLabelStyle: AXIS_TEXT }]}
          yAxis={[{ label: result.measures[1]?.label, tickLabelStyle: AXIS_TEXT }]}
          hideLegend
          grid={{ horizontal: true, vertical: true }}
          sx={{
            '& .MuiChartsGrid-line': { stroke: 'var(--color-gray-200)', strokeDasharray: '3 3' },
          }}
        />
      )}

      {active && (
        <ChartTooltip
          title={active.label ?? 'Record'}
          color={COLORS[0]}
          rows={[
            { label: result.measures[0]?.label ?? 'X', value: formatNumber(active.x) },
            { label: result.measures[1]?.label ?? 'Y', value: formatNumber(active.y) },
          ]}
          style={{ left: pointer.x, top: pointer.y - 10 }}
        />
      )}
    </div>
  );
}

interface ReportChartBlockProps {
  block: ReportBlock;
  period: ReportPeriod;
  /** Shown when the block has no title of its own. */
  fallbackTitle: string;
  className?: string;
}

/** One chart of a report, drawn as the matching dashboard card. It sizes itself within the
 * report's wrapping row: it grows to share the space, a wide one claiming more, up to half the row. */
export function ReportChartBlock({
  block,
  period,
  fallbackTitle,
  className: extraClassName,
}: ReportChartBlockProps) {
  const { data, isLoading, isError, error } = useRunReportBlock('CHART', block, period);
  const result = data?.type === 'CHART' ? data : null;
  const chartType = result?.chartType ?? block.chartType;
  const className = cn(
    // Never more than half the row (less half the gap), except on small screens.
    'min-w-0 lg:max-w-[calc(50%-0.375rem)]',
    result && needsWideCard(result) ? 'flex-[2_1_44rem]' : 'flex-[1_1_22rem]',
    extraClassName,
  );

  const title = block.title || fallbackTitle;
  const subtitle = [
    chartType ? CHART_TYPE_LABELS[chartType] : '',
    result?.groupBy ? `by ${result.groupBy.label.toLowerCase()}` : '',
    result?.truncated ? 'incomplete, dataset too large' : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const rows = result?.rows ?? [];
  const buckets = rows.map((row) => ({ label: row.group, detail: row.group }));
  const series = (result?.measures ?? []).map((measure, i) => ({
    label: measure.label,
    color: COLORS[i % COLORS.length],
    data: rows.map((row) => row.values[i] ?? null),
    valueFormatter: formatNumber,
  }));
  const errorText = isError ? apiErrorMessage(error, 'This chart could not be loaded.') : undefined;

  // A share of the total only means something for values that add up.
  const showShare = (block.measures ?? []).every(
    (measure) => measure.aggregation === 'count' || measure.aggregation === 'sum',
  );

  const shared = {
    showShare,
    title,
    subtitle,
    buckets,
    series,
    isLoading,
    isError,
    errorText,
    emptyText: EMPTY_TEXT,
    axisFormatter: formatTick,
    className,
  };

  if (chartType === 'LINE' || chartType === 'AREA') {
    return <PeriodLineChart {...shared} area={chartType === 'AREA'} />;
  }

  if (chartType === 'BAR' || chartType === 'BAR_STACKED' || chartType === 'BAR_HORIZONTAL') {
    return (
      <PeriodBarChart
        {...shared}
        stacked={chartType === 'BAR_STACKED'}
        horizontal={chartType === 'BAR_HORIZONTAL'}
        wholeNumbers={series.every((s) =>
          s.data.every((value) => value === null || Number.isInteger(value)),
        )}
      />
    );
  }

  // Pies colour by group and only show the groups that have something to slice.
  const slices = rows
    .filter((row) => (row.values[0] ?? 0) > 0)
    .map((row, i) => ({
      label: row.group,
      value: row.values[0] as number,
      color: COLORS[i % COLORS.length],
    }));
  const isEmpty = chartType === 'SCATTER' ? !result?.points?.length : slices.length === 0;

  return (
    <div
      className={cn(
        cardClass('relative hover:z-20 flex flex-col gap-2 p-3 h-60', 'glass'),
        className,
      )}
    >
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-400">{subtitle}</span>
      </div>

      {isLoading ? (
        <Skeleton className="flex-1 min-h-0 w-full" />
      ) : isError || isEmpty || !result ? (
        <div className="flex flex-1 min-h-0 items-center justify-center text-center text-sm text-gray-400">
          {errorText ?? EMPTY_TEXT}
        </div>
      ) : chartType === 'SCATTER' ? (
        <Scatter result={result} />
      ) : (
        <PieBreakdown
          className="flex-1"
          slices={slices}
          valueLabel={result.measures[0]?.label}
          formatValue={formatNumber}
        />
      )}
    </div>
  );
}
