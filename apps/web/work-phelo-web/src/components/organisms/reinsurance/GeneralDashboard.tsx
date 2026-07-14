'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { DashboardStatsRow } from '@/components/molecules/reinsurance/stats/DashboardStatsRow';
import { FinancialStatsRow } from '@/components/molecules/reinsurance/stats/FinancialStatsRow';

interface GeneralDashboardProps {
  period: Period;
  currency: string;
}

export function GeneralDashboard({ period, currency }: GeneralDashboardProps) {
  return (
    <div className="flex flex-col gap-4">
      <DashboardStatsRow period={period} currency={currency} />
      <FinancialStatsRow period={period} />
    </div>
  );
}
