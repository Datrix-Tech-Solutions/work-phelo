'use client';

import { cardClass, cn } from '@/lib/utils';

export type PremiumsPeriod = 'weekly' | 'monthly' | 'quarterly';

const PERIODS: { label: string; value: PremiumsPeriod }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
];

interface PremiumsPeriodToggleProps {
  value: PremiumsPeriod;
  onChange: (value: PremiumsPeriod) => void;
}

export function PremiumsPeriodToggle({ value, onChange }: PremiumsPeriodToggleProps) {
  return (
    <div className={cardClass('flex items-center gap-1 p-1 shadow-none')}>
      {PERIODS.map(({ label, value: v }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            'px-4 py-1.5 text-sm font-medium rounded-input transition-colors',
            value === v
              ? 'bg-(--module-btn-bg,var(--color-brand)) text-white'
              : 'text-gray-600 hover:bg-gray-100',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
