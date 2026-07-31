'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { OffersOverviewRow } from '@/components/molecules/reinsurance/stats/OffersOverviewRow';
import { FinancialStatsRow } from '@/components/molecules/reinsurance/stats/FinancialStatsRow';

interface GeneralDashboardProps {
  period: Period;
}

export function GeneralDashboard({ period }: GeneralDashboardProps) {
  return (
    <div className="flex flex-col">
      <OffersOverviewRow period={period} />
      <FinancialStatsRow period={period} />
    </div>
  );
}
