'use client';

import { cn } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';

interface TrendBadgeProps {
  change: number;
}

export function TrendBadge({ change }: TrendBadgeProps) {
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full',
        isNeutral && 'bg-gray-100 text-gray-500',
        !isNeutral && isPositive && 'bg-green-50 text-green-600',
        !isNeutral && !isPositive && 'bg-red-50 text-red-500',
      )}
    >
      {!isNeutral &&
        (isPositive ? (
          <Icons.TrendingUp className="w-3 h-3" />
        ) : (
          <Icons.TrendingDown className="w-3 h-3" />
        ))}
      {isNeutral ? '—' : `${Math.abs(change).toFixed(1)}%`}
    </span>
  );
}
