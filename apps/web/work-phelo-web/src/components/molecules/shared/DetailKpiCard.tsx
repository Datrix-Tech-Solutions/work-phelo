'use client';

import { LucideIcon } from 'lucide-react';
import { TrendBadge } from '@/components/atoms/TrendBadge';
import { Skeleton } from '@/components/atoms/Skeleton';
import { cardClass, waterIconStyle } from '@/lib/utils';

interface DetailKpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Hex/CSS color seed for the icon's water-glass circle. */
  iconColor?: string;
  trend?: number;
  trendTooltip?: string;
  periodLabel?: string;
  /** Lines under the value that explain or break it down. */
  details: { label: string; value: string }[];
  isLoading?: boolean;
}

/** A KPI card with a headline figure and a short breakdown underneath it. */
export function DetailKpiCard({
  label,
  value,
  icon: Icon,
  iconColor = 'var(--module-btn-bg, var(--brand))',
  trend,
  trendTooltip,
  periodLabel,
  details,
  isLoading,
}: DetailKpiCardProps) {
  return (
    <div className={cardClass('flex flex-col gap-1.5 p-2', 'glass')}>
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={waterIconStyle(iconColor)}
        >
          <Icon
            className="w-4 h-4"
            style={{ color: `color-mix(in oklab, ${iconColor} 65%, black)` }}
          />
        </div>
        <span className="text-xs font-light text-gray-700">{label}</span>
      </div>

      {isLoading ? (
        <>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-full" />
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg font-bold text-gray-900">{value}</span>
            {trend !== undefined && (
              <div className="flex items-center gap-1">
                <TrendBadge change={trend} tooltip={trendTooltip} />
                <span className="text-[10px] text-gray-400">vs previous {periodLabel}</span>
              </div>
            )}
          </div>
          <dl className="flex flex-col gap-0.5 border-t border-gray-200 pt-1.5">
            {details.map((detail) => (
              <div key={detail.label} className="flex items-center justify-between gap-3 text-xs">
                <dt className="text-gray-500">{detail.label}</dt>
                <dd className="font-semibold text-gray-700 tabular-nums">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
