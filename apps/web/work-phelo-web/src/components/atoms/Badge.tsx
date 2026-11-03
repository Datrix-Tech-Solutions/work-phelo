import { cn } from '@/lib/utils';

export interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  const variants = {
    success: 'bg-green-50 border-green-200 text-green-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    danger: 'bg-red-50 border-red-200 text-red-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    neutral: 'bg-gray-50 border-gray-200 text-gray-600',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md border-2 text-xs font-semibold uppercase tracking-wide w-fit whitespace-nowrap',
        variants[variant],
      )}
    >
      {label}
    </span>
  );
}
