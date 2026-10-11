'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { Icons } from '@/components/atoms/icons';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useMarketingDashboard } from '@/hooks/marketing/useMarketingDashboard';
import { cardClass, cn } from '@/lib/utils';

const SUBTITLES: Record<Period, string> = {
  daily: 'Targets running today',
  weekly: 'Targets running this week',
  monthly: 'Targets running this month',
  quarterly: 'Targets running this quarter',
  yearly: 'Targets running this year',
};

// Same gauge as the Reinsurance Offers Overview: an open gap at the bottom, the arc
// sweeping clockwise from just after it.
const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 90;
const STROKE = 10;
const CIRC = 2 * Math.PI * RADIUS;
const GAP_DEGREES = 80;
const ARC_LEN = ((360 - GAP_DEGREES) / 360) * CIRC;
const ROTATE = 90 + GAP_DEGREES / 2;

type MetricKey = 'target' | 'achieved' | 'remaining';

interface MetricDef {
  key: MetricKey;
  label: string;
  icon: LucideIcon;
  color: string;
}

const METRICS: MetricDef[] = [
  { key: 'target', label: 'Total Target', icon: Icons.Target, color: '#4c8dff' },
  { key: 'achieved', label: 'Achieved', icon: Icons.CircleCheck, color: '#34d399' },
  { key: 'remaining', label: 'Remaining', icon: Icons.Timer, color: '#f5a623' },
];

const compact = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
};

interface TargetsOverviewCardProps {
  period: Period;
  year: number;
  className?: string;
}

/** Total target for the period against what has been achieved, as a gauge with selectable figures. */
export function TargetsOverviewCard({ period, year, className }: TargetsOverviewCardProps) {
  const { data, isLoading } = useMarketingDashboard(period, year);
  const [selected, setSelected] = useState<MetricKey | null>(null);
  // The key being reset to zero (no transition) just before it sweeps back up, so every
  // click animates from the start of the arc.
  const [growFrom, setGrowFrom] = useState<MetricKey | null>(null);
  const [direction, setDirection] = useState<'up' | 'down'>('up');

  const targets = data?.targets;
  const currency = data?.currency ?? '';
  const target = Number(targets?.target ?? 0);
  const achieved = targets?.achieved == null ? null : Number(targets.achieved);
  const remaining = targets?.remaining == null ? null : Number(targets.remaining);
  const values: Record<MetricKey, number | null> = { target, achieved, remaining };
  const money = (value: number | null) =>
    value === null ? '—' : `${currency} ${compact(value)}`.trim();

  const metricIndex = (key: MetricKey | null) =>
    key === null ? 0 : METRICS.findIndex((m) => m.key === key);

  function handleSelect(key: MetricKey) {
    const next = selected === key ? null : key;
    if (metricIndex(next) !== metricIndex(selected)) {
      setDirection(metricIndex(next) > metricIndex(selected) ? 'up' : 'down');
    }
    setSelected(next);
    if (next) {
      setGrowFrom(next);
      requestAnimationFrame(() => requestAnimationFrame(() => setGrowFrom(null)));
    } else {
      setGrowFrom(null);
    }
  }

  // Each arc is its share of the total target; the selected one fills the ring.
  function targetPct(m: MetricDef): number {
    if (growFrom === m.key) return 0;
    if (selected) return m.key === selected ? 100 : 0;
    const value = values[m.key];
    return target > 0 && value !== null ? Math.min(100, (value / target) * 100) : 0;
  }

  // Largest first so bigger arcs sit behind smaller ones; the selected arc paints last.
  const byValue = [...METRICS].sort((a, b) => (values[b.key] ?? 0) - (values[a.key] ?? 0));
  const displayOrder = selected
    ? [...METRICS.filter((m) => m.key !== selected), METRICS.find((m) => m.key === selected)!]
    : byValue;

  const centerMetric = selected ? METRICS.find((m) => m.key === selected)! : null;
  const centerValue = centerMetric
    ? money(values[centerMetric.key])
    : targets?.percent == null
      ? '—'
      : `${targets.percent.toFixed(1)}%`;
  const centerLabel = centerMetric ? centerMetric.label : 'Target Achieved';
  const hasTargets = (targets?.count ?? 0) > 0;

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-60', 'glass'), className)}>
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900">Targets Overview</h3>
        <span className="text-xs text-gray-400">{SUBTITLES[period]}</span>
      </div>

      {!isLoading && !hasTargets ? (
        <div className="flex flex-1 min-h-0 items-center justify-center text-sm text-gray-400">
          No targets set for this period.
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 items-center gap-2">
          <div className="flex flex-col gap-1.5 shrink-0">
            {METRICS.map((m) => {
              const Icon = m.icon;
              const active = selected === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => handleSelect(m.key)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-2 py-1.5 border transition-[transform,box-shadow,background-color,border-color] duration-200 text-left cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
                    active
                      ? 'bg-(--tint) border-(--tint-border) shadow-sm'
                      : 'bg-gray-100/60 hover:bg-gray-200/60 border-(--rest-border) shadow-l',
                  )}
                  style={
                    {
                      '--tint': `color-mix(in oklab, ${m.color} 20%, white)`,
                      '--tint-border': `color-mix(in oklab, ${m.color} 50%, white)`,
                      '--rest-border': `color-mix(in oklab, ${m.color} 100%, white)`,
                    } as React.CSSProperties
                  }
                >
                  <Icon size={16} color={active ? m.color : '#9ca3af'} className="shrink-0" />
                  <span className="flex flex-col leading-tight min-w-0">
                    <span
                      className="text-[10px] text-gray-500 truncate"
                      style={{ color: active ? m.color : undefined }}
                    >
                      {m.label}
                    </span>
                    <span
                      className="text-xs font-semibold text-gray-900"
                      style={{ color: active ? m.color : undefined }}
                    >
                      {isLoading ? '—' : money(values[m.key])}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative flex h-full min-w-0 flex-1 items-center justify-center">
            <svg className="h-full max-w-full" viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <g transform={`rotate(${ROTATE} ${CENTER} ${CENTER})`}>
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${ARC_LEN} ${CIRC - ARC_LEN}`}
                />
                {!isLoading &&
                  displayOrder.map((m) => {
                    const filled = (targetPct(m) / 100) * ARC_LEN;
                    return (
                      <circle
                        key={m.key}
                        cx={CENTER}
                        cy={CENTER}
                        r={RADIUS}
                        fill="none"
                        stroke={m.color}
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        strokeDasharray={`${filled} ${CIRC - filled}`}
                        style={{
                          transition:
                            growFrom === m.key
                              ? 'none'
                              : 'stroke-dasharray 900ms cubic-bezier(0.65, 0, 0.35, 1)',
                        }}
                      />
                    );
                  })}
              </g>
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              {isLoading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <div
                  key={selected ?? 'percent'}
                  className={direction === 'up' ? 'metric-slide-up' : 'metric-slide-down'}
                >
                  <div className="text-xl font-semibold text-gray-900">{centerValue}</div>
                  <div className="text-sm text-gray-400 mt-1">{centerLabel}</div>
                  <div className="mt-1.5 text-[10px] text-gray-400">
                    {targets?.achieved == null && !selected
                      ? 'Achieved revenue unavailable'
                      : `Across ${targets?.count ?? 0} ${targets?.count === 1 ? 'target' : 'targets'}`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
