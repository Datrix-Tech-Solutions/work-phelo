'use client';

import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value?: string | number;
  unit?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'highlight' | 'success' | 'warning';
  className?: string;
}

export function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  actionLabel,
  onAction,
  variant = 'default',
  className = '',
}: MetricCardProps) {
  const variantStyles = {
    default: 'text-gray-900',
    highlight: 'text-[#0D2244]',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
  };

  return (
    <div
      className={`bg-white border border-gray-200 rounded-card px-5 py-5 flex flex-col ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium">{title}</span>
        {Icon && <Icon className="w-5 h-5 text-gray-400" />}
      </div>

      {/* Value */}
      <div className="flex items-end justify-between flex-1">
        <div>
          <p className={`text-3xl font-bold ${variantStyles[variant]}`}>
            {value}
            {unit && <span className="text-base font-normal text-gray-400 ml-1">{unit}</span>}
          </p>
        </div>

        {/* Action Button */}
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
