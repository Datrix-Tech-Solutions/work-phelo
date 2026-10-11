'use client';

import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { ScatterChart } from '@mui/x-charts/ScatterChart';
import { Skeleton } from '@/components/atoms/Skeleton';
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

const AXIS_TEXT = { fontSize: 11, fill: 'var(--color-gray-600)' };
const GRID_SX = {
  '& .MuiChartsGrid-line': { stroke: 'var(--color-gray-200)', strokeDasharray: '3 3' },
};

interface PlotProps {
  result: ChartResult;
  width: number;
  height: number;
}

function Plot({ result, width, height }: PlotProps) {
  const { chartType, rows, measures, points } = result;
  const groups = rows.map((row) => row.group);
  const series = measures.map((measure, i) => ({
    id: measure.key,
    label: measure.label,
    color: COLORS[i % COLORS.length],
    data: rows.map((row) => row.values[i] ?? null),
  }));
  const margin = { left: 0, right: 12, top: 8, bottom: 0 };

  if (chartType === 'PIE' || chartType === 'DONUT') {
    const data = rows
      .filter((row) => (row.values[0] ?? 0) > 0)
      .map((row, i) => ({
        id: i,
        value: row.values[0] as number,
        label: row.group,
        color: COLORS[i % COLORS.length],
      }));
    return (
      <PieChart
        width={width}
        height={height}
        series={[
          {
            data,
            innerRadius: chartType === 'DONUT' ? Math.min(width, height) * 0.2 : 0,
            outerRadius: Math.min(width, height) * 0.42,
            paddingAngle: 1,
            cornerRadius: 3,
          },
        ]}
        hideLegend
      />
    );
  }

  if (chartType === 'SCATTER') {
    return (
      <ScatterChart
        width={width}
        height={height}
        series={[
          {
            data: (points ?? []).map((p, i) => ({ x: p.x, y: p.y, id: i })),
            color: COLORS[0],
            valueFormatter: (value, { dataIndex }) =>
              value ? `${(points ?? [])[dataIndex]?.label ?? ''} (${value.x}, ${value.y})` : '',
          },
        ]}
        xAxis={[{ label: measures[0]?.label, tickLabelStyle: AXIS_TEXT }]}
        yAxis={[{ label: measures[1]?.label, tickLabelStyle: AXIS_TEXT }]}
        hideLegend
        grid={{ horizontal: true, vertical: true }}
        sx={GRID_SX}
      />
    );
  }

  if (chartType === 'LINE' || chartType === 'AREA') {
    return (
      <LineChart
        width={width}
        height={height}
        series={series.map((s) => ({
          ...s,
          area: chartType === 'AREA',
          showMark: groups.length <= 24,
          connectNulls: true,
        }))}
        xAxis={[{ data: groups, scaleType: 'point', disableLine: true, tickLabelStyle: AXIS_TEXT }]}
        yAxis={[{ disableLine: true, disableTicks: true, tickLabelStyle: AXIS_TEXT }]}
        hideLegend
        margin={margin}
        grid={{ horizontal: true }}
        sx={GRID_SX}
      />
    );
  }

  if (chartType === 'BAR_HORIZONTAL') {
    return (
      <BarChart
        layout="horizontal"
        width={width}
        height={height}
        series={series}
        yAxis={[
          {
            data: groups,
            scaleType: 'band',
            disableLine: true,
            disableTicks: true,
            width: 110,
            tickLabelStyle: AXIS_TEXT,
          },
        ]}
        xAxis={[{ disableLine: true, disableTicks: true, tickLabelStyle: AXIS_TEXT }]}
        hideLegend
        margin={margin}
        grid={{ vertical: true }}
        sx={GRID_SX}
      />
    );
  }

  return (
    <BarChart
      width={width}
      height={height}
      series={series.map((s) => (chartType === 'BAR_STACKED' ? { ...s, stack: 'total' } : s))}
      xAxis={[
        {
          data: groups,
          scaleType: 'band',
          disableLine: true,
          disableTicks: true,
          categoryGapRatio: 0.35,
          tickLabelStyle: AXIS_TEXT,
        },
      ]}
      yAxis={[{ disableLine: true, disableTicks: true, width: 48, tickLabelStyle: AXIS_TEXT }]}
      hideLegend
      margin={margin}
      grid={{ horizontal: true }}
      sx={GRID_SX}
    />
  );
}

interface ReportChartBlockProps {
  block: ReportBlock;
  period: ReportPeriod;
  /** Shown when the block has no title of its own. */
  fallbackTitle: string;
  className?: string;
}

export function ReportChartBlock({
  block,
  period,
  fallbackTitle,
  className,
}: ReportChartBlockProps) {
  const { data, isLoading, isError, error } = useRunReportBlock('CHART', block, period);
  const [plotRef, plotSize] = useElementSize<HTMLDivElement>();
  const result = data?.type === 'CHART' ? data : null;

  const isEmpty =
    !!result &&
    (result.chartType === 'SCATTER' ? !result.points?.length : result.rows.length === 0);

  // Pies colour by group, everything else by measure.
  const legend =
    result && (result.chartType === 'PIE' || result.chartType === 'DONUT')
      ? result.rows
          .filter((row) => (row.values[0] ?? 0) > 0)
          .map((row, i) => ({ label: row.group, color: COLORS[i % COLORS.length] }))
      : (result?.chartType === 'SCATTER' ? [] : (result?.measures ?? [])).map((m, i) => ({
          label: m.label,
          color: COLORS[i % COLORS.length],
        }));

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-4 h-96', 'glass'), className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {block.title || fallbackTitle}
          </h3>
          <span className="text-xs text-gray-400">
            {block.chartType ? CHART_TYPE_LABELS[block.chartType] : ''}
            {result?.groupBy ? ` · by ${result.groupBy.label.toLowerCase()}` : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-gray-600 max-w-[60%]">
          {legend.slice(0, 8).map((item) => (
            <span key={item.label} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div ref={plotRef} className="relative flex-1 min-h-0">
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : isError ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-gray-400">
            {apiErrorMessage(error, 'This chart could not be loaded.')}
          </div>
        ) : isEmpty ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            No data for this selection.
          </div>
        ) : (
          result &&
          plotSize.width > 0 &&
          plotSize.height > 0 && (
            <Plot result={result} width={plotSize.width} height={plotSize.height} />
          )
        )}
      </div>

      {result?.truncated && (
        <p className="text-xs text-amber-600">
          Only the first part of a very large dataset was read, so these figures may be incomplete.
        </p>
      )}
    </div>
  );
}
