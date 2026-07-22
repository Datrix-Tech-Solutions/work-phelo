'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { DashboardStatsRow } from '@/components/molecules/reinsurance/stats/DashboardStatsRow';
import { FinancialStatsRow } from '@/components/molecules/reinsurance/stats/FinancialStatsRow';

interface GeneralDashboardProps {
  period: Period;
}

export function GeneralDashboard({ period }: GeneralDashboardProps) {
  return (
    <div className="flex flex-col gap-4">
      <DashboardStatsRow period={period} />
      <FinancialStatsRow period={period} />
    </div>
  );
}
