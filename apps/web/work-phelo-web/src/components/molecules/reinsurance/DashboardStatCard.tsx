'use client';

import { TrendBadge } from '@/components/atoms/TrendBadge';
import { Skeleton } from '@/components/atoms/Skeleton';

interface DashboardStatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  isLoading?: boolean;
  periodLabel: string;
}

export function DashboardStatCard({
  label,
  value,
  trend,
  isLoading,
  periodLabel,
}: DashboardStatCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-5">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>

      {isLoading ? (
        <>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-5 w-20" />
        </>
      ) : (
        <>
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          <div className="flex items-center gap-1.5">
            {trend !== undefined && <TrendBadge change={trend} />}
            <span className="text-xs text-gray-400">vs previous {periodLabel}</span>
          </div>
        </>
      )}
    </div>
  );
}
