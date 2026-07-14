'use client';

import { SearchSelect } from '@/components/atoms/SearchSelect';
import { PeriodToggle, Period } from '@/components/atoms/PeriodToggle';
import { useCurrencyOptions } from '@/hooks';

interface DashboardFiltersBarProps {
  currency: string;
  onCurrencyChange: (value: string) => void;
  period: Period;
  onPeriodChange: (value: Period) => void;
  showCurrency?: boolean;
}

export function DashboardFiltersBar({
  currency,
  onCurrencyChange,
  period,
  onPeriodChange,
  showCurrency = true,
}: DashboardFiltersBarProps) {
  const { data: currencyOptions = [] } = useCurrencyOptions();

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {showCurrency && (
        <div className="w-64">
          <SearchSelect
            placeholder="Select currency…"
            options={currencyOptions}
            value={currency}
            onChange={onCurrencyChange}
            size="sm"
          />
        </div>
      )}

      <PeriodToggle value={period} onChange={onPeriodChange} />
    </div>
  );
}
