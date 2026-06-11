'use client';

import { useState } from 'react';
import { Period } from '@/components/atoms/PeriodToggle';
import { DashboardFiltersBar } from '@/components/molecules/reinsurance/DashboardFiltersBar';
import { DashboardStatsRow } from '@/components/molecules/reinsurance/DashboardStatsRow';
import { FinancialStatsRow } from '@/components/molecules/reinsurance/FinancialStatsRow';

export default function ReinsuranceFoundation() {
  const [currency, setCurrency] = useState('');
  const [period, setPeriod] = useState<Period>('monthly');

  return (
    <div className="p-6 space-y-6">
      <DashboardFiltersBar
        currency={currency}
        onCurrencyChange={setCurrency}
        period={period}
        onPeriodChange={setPeriod}
      />
      <DashboardStatsRow period={period} />
      <FinancialStatsRow period={period} currency={currency} />
    </div>
  );
}
