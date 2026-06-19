'use client';

import { useState } from 'react';
import { Period } from '@/components/atoms/PeriodToggle';
import { DashboardFiltersBar } from '@/components/molecules/reinsurance/DashboardFiltersBar';
import { DashboardStatsRow } from '@/components/molecules/reinsurance/stats/DashboardStatsRow';
import { FinancialStatsRow } from '@/components/molecules/reinsurance/stats/FinancialStatsRow';
import { CurrencyBreakdownCards } from '@/components/molecules/reinsurance/CurrencyBreakdownCards';
import { TopCedantsList } from '@/components/molecules/reinsurance/TopCedantsList';

export default function ReinsuranceFoundation() {
  const [currency, setCurrency] = useState('');
  const [period, setPeriod] = useState<Period>('monthly');

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
      <DashboardFiltersBar
        currency={currency}
        onCurrencyChange={setCurrency}
        period={period}
        onPeriodChange={setPeriod}
      />
      <DashboardStatsRow period={period} currency={currency} />
      <FinancialStatsRow period={period} currency={currency} />
      <CurrencyBreakdownCards period={period} />
      <TopCedantsList period={period} currency={currency} />
    </div>
  );
}
