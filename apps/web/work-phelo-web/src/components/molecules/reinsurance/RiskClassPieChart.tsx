'use client';

import { useMemo, useState } from 'react';
import { PieChart } from '@mui/x-charts/PieChart';
import { Period } from '@/components/atoms/PeriodToggle';
import { useFacultatives, useRiskTypes, useRiskClasses } from '@/hooks';

const COLORS = [
  '#f97316',
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#ef4444',
  '#eab308',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
];

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

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

interface SliceMeta {
  totalPremium: number;
  totalSumInsured: number;
  color: string;
}

interface RiskClassPieChartProps {
  period: Period;
}

export function RiskClassPieChart({ period }: RiskClassPieChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const { data: all = [] } = useFacultatives();
  const { data: riskTypes = [] } = useRiskTypes();
  const { data: riskClasses = [] } = useRiskClasses();

  const { pieData, meta } = useMemo(() => {
    const start = periodStart(period, new Date());
    const placements = all.filter((f) => new Date(f.createdAt) >= start);

    const riskTypeMap = new Map(riskTypes.map((rt) => [rt.id, rt]));
    const riskClassMap = new Map(riskClasses.map((rc) => [rc.id, rc.name]));

    const counts = new Map<string, { count: number; premium: number; sumInsured: number }>();
    for (const f of placements) {
      const name = f.riskTypeId
        ? (riskClassMap.get(riskTypeMap.get(f.riskTypeId)?.riskClassId ?? '') ?? 'Unclassified')
        : 'Unclassified';
      const prev = counts.get(name) ?? { count: 0, premium: 0, sumInsured: 0 };
      counts.set(name, {
        count: prev.count + 1,
        premium: prev.premium + (f.premium ?? 0),
        sumInsured: prev.sumInsured + (f.sumInsured ?? 0),
      });
    }

    const entries = Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count);

    const pieData = entries.map(([name, d], i) => ({
      id: i,
      value: d.count,
      label: name,
      color: COLORS[i % COLORS.length],
    }));

    const meta: SliceMeta[] = entries.map(([, d], i) => ({
      totalPremium: d.premium,
      totalSumInsured: d.sumInsured,
      color: COLORS[i % COLORS.length],
    }));

    return { pieData, meta };
  }, [all, riskTypes, riskClasses, period]);

  if (pieData.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">
        No offers for this period.
      </div>
    );
  }

  const activeSlice = hovered !== null ? { ...pieData[hovered], ...meta[hovered] } : null;
  const total = pieData.reduce((s, x) => s + x.value, 0);

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="relative shrink-0">
        <PieChart
          series={[
            {
              data: pieData,
              highlightScope: { fade: 'global', highlight: 'item' },
              faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
              valueFormatter: (item) => `${item.value} offers`,
              outerRadius: 80,
            },
          ]}
          width={200}
          height={200}
          onHighlightChange={(h) => setHovered(h?.dataIndex ?? null)}
          sx={{ '& .MuiChartsLegend-root': { display: 'none' } }}
          slotProps={{ tooltip: { trigger: 'none' } as never }}
        />

        {/* Centre label */}
        {/* <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-gray-900">{total}</span>
          <span className="text-[10px] text-gray-400">total offers</span>
        </div> */}

        {/* Tooltip */}
        {activeSlice && (
          <div className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full z-10 pointer-events-none">
            <div className="bg-gray-900 text-white rounded-xl shadow-xl px-4 py-3 text-xs whitespace-nowrap flex flex-col gap-1.5">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: activeSlice.color }}
                />
                {activeSlice.label}
                <span className="ml-auto pl-4 text-gray-300">
                  {((activeSlice.value / total) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="border-t border-gray-700 pt-1.5 flex flex-col gap-1">
                <div className="flex justify-between gap-6">
                  <span className="text-gray-400">Offers</span>
                  <span className="font-medium">{activeSlice.value}</span>
                </div>
                <div className="flex justify-between gap-6">
                  <span className="text-gray-400">Premium</span>
                  <span className="font-medium">{fmt(activeSlice.totalPremium)}</span>
                </div>
                <div className="flex justify-between gap-6">
                  <span className="text-gray-400">Sum Insured</span>
                  <span className="font-medium">{fmt(activeSlice.totalSumInsured)}</span>
                </div>
              </div>
            </div>
            {/* Arrow pointing down */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45 rounded-sm" />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 min-w-0 flex-1 pt-1">
        {pieData.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-200"
              style={{ background: hovered !== null && hovered !== i ? '#d1d5db' : s.color }}
            />
            <span
              className="truncate flex-1 transition-colors duration-200"
              style={{ color: hovered !== null && hovered !== i ? '#9ca3af' : '#374151' }}
            >
              {s.label}
            </span>
            <span className="font-semibold text-gray-900 shrink-0">{s.value}</span>
            <span className="text-gray-400 text-xs shrink-0 w-12 text-right">
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
