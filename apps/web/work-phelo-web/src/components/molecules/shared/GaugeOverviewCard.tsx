'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/atoms/Skeleton';
import { cardClass, cn } from '@/lib/utils';

// An open gap at the bottom, the arc sweeping clockwise from just after it.
const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 90;
const STROKE = 10;
const CIRC = 2 * Math.PI * RADIUS;
const GAP_DEGREES = 80;
const ARC_LEN = ((360 - GAP_DEGREES) / 360) * CIRC;
const ROTATE = 90 + GAP_DEGREES / 2;

export interface GaugeMetric {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  /** Drives the arc length against `total`; null draws nothing for this metric. */
  value: number | null;
  /** The figure as shown, on the button and in the centre when selected. */
  display: string;
}

interface GaugeOverviewCardProps {
  title: string;
  subtitle?: string;
  /** Right-aligned in the header, e.g. a filter. */
  headerAction?: React.ReactNode;
  /** Shown as the buttons beside the gauge, in order. */
  metrics: GaugeMetric[];
  /** What a full arc stands for; each metric's arc is its `value` as a share of this. */
  total: number;
  /** The centre when no metric is selected, e.g. the overall percentage. */
  defaultCenter: { value: string; label: string };
  /** Small line under the centre figure. */
  caption?: string;
  isLoading?: boolean;
  /** Replaces the gauge with `emptyMessage` once loaded. */
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
}

/**
 * A card with a gauge of stacked arcs and a button per metric. Selecting a metric fills the ring
 * with it and shows its figure in the centre; selecting it again goes back to the overview.
 */
export function GaugeOverviewCard({
  title,
  subtitle,
  headerAction,
  metrics,
  total,
  defaultCenter,
  caption,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'Nothing to show for this period.',
  className,
}: GaugeOverviewCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  // The key being reset to zero (no transition) just before it sweeps back up, so every
  // click animates from the start of the arc.
  const [growFrom, setGrowFrom] = useState<string | null>(null);
  const [direction, setDirection] = useState<'up' | 'down'>('up');

  const metricIndex = (key: string | null) =>
    key === null ? 0 : metrics.findIndex((m) => m.key === key);
  const selectedMetric = metrics.find((m) => m.key === selected) ?? null;

  function handleSelect(key: string) {
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

  // Each arc is its share of the total; the selected one fills the ring.
  function arcPct(m: GaugeMetric): number {
    if (growFrom === m.key) return 0;
    if (selectedMetric) return m.key === selectedMetric.key ? 100 : 0;
    return total > 0 && m.value !== null ? Math.min(100, (m.value / total) * 100) : 0;
  }

  // Largest first so bigger arcs sit behind smaller ones; the selected arc paints last.
  const byValue = [...metrics].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const displayOrder = selectedMetric
    ? [...metrics.filter((m) => m.key !== selectedMetric.key), selectedMetric]
    : byValue;

  const center = selectedMetric
    ? { value: selectedMetric.display, label: selectedMetric.label }
    : defaultCenter;

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-60', 'glass'), className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
        </div>
        {headerAction}
      </div>

      {!isLoading && isEmpty ? (
        <div className="flex flex-1 min-h-0 items-center justify-center text-sm text-gray-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 items-center gap-2">
          <div className="flex flex-col gap-1.5 shrink-0">
            {metrics.map((m) => {
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
                      {isLoading ? '—' : m.display}
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
                    const filled = (arcPct(m) / 100) * ARC_LEN;
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
                  key={selected ?? 'overview'}
                  className={direction === 'up' ? 'metric-slide-up' : 'metric-slide-down'}
                >
                  <div className="text-xl font-semibold text-gray-900">{center.value}</div>
                  <div className="text-sm text-gray-400 mt-1">{center.label}</div>
                  {caption && <div className="mt-1.5 text-[10px] text-gray-400">{caption}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
