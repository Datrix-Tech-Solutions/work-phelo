'use client';

import { cardClass, cn } from '@/lib/utils';

export type PremiumsPeriod = 'weekly' | 'monthly' | 'quarterly';

const PERIODS: { label: string; value: PremiumsPeriod }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
];

export const PREMIUMS_PERIOD_LABEL: Record<PremiumsPeriod, string> = {
  weekly: 'This Week',
  monthly: 'This Month',
  quarterly: 'This Quarter',
};

/** Start of the calendar week (Mon) / month / quarter that `now` falls in. */
export function premiumsPeriodStart(period: PremiumsPeriod, now: Date = new Date()): Date {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (period) {
    case 'weekly': {
      const mondayOffset = (now.getDay() + 6) % 7;
      return new Date(y, m, d - mondayOffset);
    }
    case 'monthly':
      return new Date(y, m, 1);
    case 'quarterly':
      return new Date(y, Math.floor(m / 3) * 3, 1);
  }
}

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
