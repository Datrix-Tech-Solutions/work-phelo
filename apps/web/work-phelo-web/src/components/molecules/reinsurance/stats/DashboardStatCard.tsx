'use client';

import { TrendBadge } from '@/components/atoms/TrendBadge';
import { Skeleton } from '@/components/atoms/Skeleton';
import { cardClass } from '@/lib/utils';

interface DashboardStatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  trendTooltip?: string;
  isLoading?: boolean;
  periodLabel: string;
  subtext?: string;
}

export function DashboardStatCard({
  label,
  value,
  trend,
  trendTooltip,
  isLoading,
  periodLabel,
  subtext,
}: DashboardStatCardProps) {
  return (
    <div className={cardClass('flex flex-col gap-2 p-5', 'glass')}>
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>

      {isLoading ? (
        <>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-5 w-20" />
        </>
      ) : (
        <>
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {trend !== undefined && <TrendBadge change={trend} tooltip={trendTooltip} />}
              <span className="text-xs text-gray-400">vs previous {periodLabel}</span>
            </div>
            {subtext && <span className="text-s font-medium text-gray-400">{subtext}</span>}
          </div>
        </>
      )}
    </div>
  );
}
