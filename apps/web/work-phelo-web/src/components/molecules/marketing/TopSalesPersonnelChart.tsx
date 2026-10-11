'use client';

import { useMemo, useState } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import type { Period } from '@/components/atoms/PeriodToggle';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useMarketingSalesPersonnel } from '@/hooks/marketing/useMarketingSalesPersonnel';
import { useElementSize } from '@/hooks/useElementSize';
import { cardClass, cn } from '@/lib/utils';
import type { MarketingSalesRep } from '@/types/marketing';

const BAR_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ef4444'];
const TOP = 5;
/** Figures about what a rep holds now, not about the selected period. */
const CURRENT_METRICS: Metric[] = ['clients', 'prospects', 'conversion'];

type Metric = 'achieved' | 'expected' | 'clients' | 'prospects' | 'conversion';

const METRICS: { value: Metric; label: string; money: boolean }[] = [
  { value: 'achieved', label: 'Achieved revenue', money: true },
  { value: 'expected', label: 'Expected revenue', money: true },
  { value: 'clients', label: 'Clients', money: false },
  { value: 'prospects', label: 'Prospects', money: false },
  { value: 'conversion', label: 'Conversion rate', money: false },
];

const SUBTITLES: Record<Period, string> = {
  daily: 'Today',
  weekly: 'This week',
  monthly: 'This month',
  quarterly: 'This quarter',
  yearly: 'This year',
};

const compact = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
};

const figure = (rep: MarketingSalesRep, metric: Metric): number | null => {
  switch (metric) {
    case 'achieved':
      return rep.achieved === null ? null : Number(rep.achieved);
    case 'expected':
      return Number(rep.expected);
    case 'clients':
      return rep.clients;
    case 'prospects':
      return rep.prospects;
    case 'conversion':
      return rep.conversion;
  }
};

interface TopSalesPersonnelChartProps {
  period: Period;
  year: number;
  className?: string;
}

/** The top five sales reps for the period, ranked on a metric the viewer switches. */
export function TopSalesPersonnelChart({ period, year, className }: TopSalesPersonnelChartProps) {
  const { data, isLoading, isError } = useMarketingSalesPersonnel(period, year);
  const [metric, setMetric] = useState<Metric>('achieved');
  const [hovered, setHovered] = useState<number | null>(null);
  const [plotRef, plotSize] = useElementSize<HTMLDivElement>();

  const config = METRICS.find((m) => m.value === metric) ?? METRICS[0];
  const currency = data?.currency ?? '';
  const format = (value: number) =>
    metric === 'conversion'
      ? `${value}%`
      : config.money
        ? `${currency} ${compact(value)}`.trim()
        : String(value);

  // Achieved is unreadable for every rep at once when Accounting is down.
  const achievedUnavailable =
    metric === 'achieved' &&
    !!data &&
    data.reps.length > 0 &&
    data.reps.every((r) => r.achieved === null);

  const rows = useMemo(() => {
    const reps = data?.reps ?? [];
    return reps
      .map((rep) => ({ rep, value: figure(rep, metric) ?? 0 }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP);
  }, [data, metric]);

  const activeRow = hovered !== null ? rows[hovered] : null;

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-60', 'glass'), className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-gray-900">Top 5 Sales Personnel</h3>
          <span className="text-xs text-gray-400">
            {CURRENT_METRICS.includes(metric)
              ? `Current total · by ${config.label.toLowerCase()}`
              : `${SUBTITLES[period]} · by ${config.label.toLowerCase()}`}
          </span>
        </div>
        <div className="w-44 shrink-0">
          <SearchSelect
            size="sm"
            clearable={false}
            options={METRICS.map((m) => ({ value: m.value, label: m.label }))}
            value={metric}
            onChange={(next) => {
              if (next) setMetric(next as Metric);
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="flex-1 w-full" />
      ) : isError ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Sales personnel could not be loaded.
        </div>
      ) : achievedUnavailable ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Achieved revenue is unavailable right now.
        </div>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          {CURRENT_METRICS.includes(metric)
            ? `No ${config.label.toLowerCase()} yet.`
            : `No ${config.label.toLowerCase()} recorded in this period.`}
        </div>
      ) : (
        <div ref={plotRef} className="relative flex-1 min-h-0 -ml-4">
          {plotSize.width > 0 && plotSize.height > 0 && (
            <BarChart
              width={plotSize.width}
              height={plotSize.height}
              layout="horizontal"
              series={[
                {
                  data: rows.map((r) => r.value),
                  label: config.label,
                  highlightScope: { fade: 'global', highlight: 'item' },
                  valueFormatter: (value) => (value === null ? '' : format(value)),
                },
              ]}
              yAxis={[
                {
                  data: rows.map((r) => r.rep.name),
                  scaleType: 'band',
                  colorMap: { type: 'ordinal', colors: BAR_COLORS },
                  disableLine: true,
                  disableTicks: true,
                  width: 'auto',
                  tickLabelStyle: { fontSize: 11, fill: 'var(--color-gray-700)' },
                  categoryGapRatio: 0.65,
                },
              ]}
              xAxis={[
                {
                  tickMinStep: 1,
                  disableLine: true,
                  disableTicks: true,
                  valueFormatter: () => '',
                  domainLimit: 'strict',
                },
              ]}
              hideLegend
              margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
              axisHighlight={{ x: 'none', y: 'none' }}
              onHighlightChange={(item) =>
                setHovered(item?.type === 'bar' ? (item.dataIndex ?? null) : null)
              }
              slotProps={{ tooltip: { trigger: 'none' } as never }}
              sx={{
                '& .MuiBarChart-element': { rx: 5, ry: 5 },
                ...(hovered !== null && {
                  '& .MuiChartsAxis-tickLabel': { fill: 'var(--color-gray-400)' },
                  [`& .MuiChartsAxis-tickContainer:nth-of-type(${hovered + 1}) .MuiChartsAxis-tickLabel`]:
                    { fill: 'var(--color-gray-900)', fontWeight: 600 },
                }),
              }}
            />
          )}

          {activeRow && (
            <div className="absolute -top-1 right-0 z-10 pointer-events-none">
              <div className="bg-(--chip-dark,#111827) text-white rounded-lg shadow-xl px-2.5 py-1.5 text-[10px] whitespace-nowrap flex flex-col gap-1">
                <div className="font-semibold text-[11px]">{activeRow.rep.name}</div>
                {(
                  [
                    [
                      'Achieved',
                      activeRow.rep.achieved === null
                        ? '—'
                        : `${currency} ${compact(Number(activeRow.rep.achieved))}`.trim(),
                    ],
                    ['Expected', `${currency} ${compact(Number(activeRow.rep.expected))}`.trim()],
                    ['Clients', String(activeRow.rep.clients)],
                    ['Prospects', String(activeRow.rep.prospects)],
                    [
                      'Conversion',
                      activeRow.rep.conversion === null
                        ? '—'
                        : `${activeRow.rep.conversion}% (${activeRow.rep.converted} of ${activeRow.rep.created})`,
                    ],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-[#9ca3af]">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
