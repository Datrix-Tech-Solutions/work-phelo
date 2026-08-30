'use client';

import { useMemo, useState } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { Period } from '@/components/atoms/PeriodToggle';
import { useFacultatives } from '@/hooks';
import { cardClass, cn } from '@/lib/utils';

const BAR_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ef4444'];

function fmtAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

function periodStart(period: Period, now: Date): Date {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const mondayOffset = (now.getDay() + 6) % 7;
  switch (period) {
    case 'daily':
      return new Date(y, m, d);
    case 'weekly':
      return new Date(y, m, d - mondayOffset);
    case 'monthly':
      return new Date(y, m, 1);
    case 'yearly':
      return new Date(y, 0, 1);
  }
}

interface TopCedantsByOffersChartProps {
  period: Period;
  /** Overrides the card's default height (`h-72`). */
  className?: string;
  /** Rank by closed offers only (status CLOSED). Retitles the card
   *  "Top 5 Cedants by Closed Offers". All-time unless `sinceIso` is given. */
  closedOnly?: boolean;
  /** Overrides the `period`-derived window start. With `closedOnly`, offers are then
   *  filtered by close date (`updatedAt`, the same close proxy the Closings tab uses). */
  sinceIso?: string;
}

export function TopCedantsByOffersChart({
  period,
  className,
  closedOnly = false,
  sinceIso,
}: TopCedantsByOffersChartProps) {
  const { data: all = [], isLoading } = useFacultatives();
  const [hovered, setHovered] = useState<number | null>(null);

  const rows = useMemo(() => {
    const start = sinceIso ? new Date(sinceIso) : periodStart(period, new Date());
    const counts = new Map<
      string,
      { name: string; count: number; premiumByCurrency: Map<string, number> }
    >();

    for (const f of all) {
      if (closedOnly) {
        if (f.status !== 'CLOSED') continue;
        if (sinceIso && new Date(f.updatedAt) < start) continue;
      } else if (new Date(f.createdAt) < start) {
        continue;
      }
      const { id, name } = f.cedant;
      const prev = counts.get(id) ?? {
        name,
        count: 0,
        premiumByCurrency: new Map<string, number>(),
      };
      if (f.premium != null && f.currency != null) {
        prev.premiumByCurrency.set(
          f.currency,
          (prev.premiumByCurrency.get(f.currency) ?? 0) + f.premium,
        );
      }
      counts.set(id, { name, count: prev.count + 1, premiumByCurrency: prev.premiumByCurrency });
    }

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [all, period, closedOnly, sinceIso]);

  const activeRow = hovered !== null ? rows[hovered] : null;

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-6 h-72', 'glass'), className)}>
      <h3 className="text-sm font-semibold text-gray-900">
        {closedOnly ? 'Top 5 Cedants by Closed Offers' : 'Top 5 Cedants by Offers'}
      </h3>
      {!isLoading && rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          {closedOnly
            ? sinceIso
              ? 'No offers closed in this period.'
              : 'No closed offers yet.'
            : 'No offers for this period.'}
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 -ml-4">
          <BarChart
            layout="horizontal"
            series={[
              {
                data: rows.map((r) => r.count),
                label: 'Offers',
                highlightScope: { fade: 'global', highlight: 'item' },
                valueFormatter: (value) => `${value} ${value === 1 ? 'offer' : 'offers'}`,
              },
            ]}
            yAxis={[
              {
                data: rows.map((r) => r.name),
                scaleType: 'band',
                colorMap: { type: 'ordinal', colors: BAR_COLORS },
                disableLine: true,
                disableTicks: true,
                width: 'auto',
                tickLabelStyle: { fontSize: 11, fill: 'var(--color-gray-700)' },
                categoryGapRatio: 0.75,
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
            loading={isLoading}
            margin={{ left: 4, right: 8, top: 5, bottom: 5 }}
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

          {activeRow && (
            <div className="absolute -top-1 right-0 z-10 pointer-events-none">
              <div className="bg-(--chip-dark,#111827) text-white rounded-lg shadow-xl px-2.5 py-1.5 text-[10px] whitespace-nowrap flex flex-col gap-1">
                <div className="font-semibold text-[11px]">{activeRow.name}</div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#9ca3af]">Offers</span>
                  <span className="font-medium">{activeRow.count}</span>
                </div>
                <div className="border-t border-[#374151] pt-1 flex flex-col gap-0.5">
                  {activeRow.premiumByCurrency.size === 0 ? (
                    <span className="text-[#9ca3af]">No premium data</span>
                  ) : (
                    Array.from(activeRow.premiumByCurrency.entries()).map(([code, amount]) => (
                      <div key={code} className="flex justify-between gap-4">
                        <span className="text-[#9ca3af]">{code}</span>
                        <span className="font-medium">{fmtAmount(amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
