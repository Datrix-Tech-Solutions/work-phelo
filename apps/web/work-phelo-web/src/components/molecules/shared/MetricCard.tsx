'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title?: string;
  label?: string;
  value?: string | number;
  sub?: string;
  unit?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'highlight' | 'success' | 'warning' | 'danger';
  highlight?: 'green' | 'red';
  className?: string;
}

export function MetricCard({
  title,
  label,
  value,
  sub,
  unit,
  icon: Icon,
  actionLabel,
  onAction,
  variant = 'default',
  highlight,
  className = '',
}: MetricCardProps) {
  const heading = title ?? label;

  const variantStyles: Record<string, string> = {
    default: 'text-gray-900',
    highlight: 'text-brand',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-500',
  };

  const valueColor =
    highlight === 'green'
      ? 'text-green-600'
      : highlight === 'red'
        ? 'text-red-500'
        : variantStyles[variant];

  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-card px-5 py-5 flex flex-col shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium">{heading}</span>
        {Icon && <Icon className="w-5 h-5 text-gray-400" />}
      </div>

      <div className="flex items-end justify-between flex-1">
        <div>
          <p className={cn('text-l ', valueColor)}>
            {value}
            {unit && <span className="text-base font-normal text-gray-400 ml-1">{unit}</span>}
          </p>
          {sub && <span className="text-xs text-gray-400 mt-0.5 block">{sub}</span>}
        </div>

        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
