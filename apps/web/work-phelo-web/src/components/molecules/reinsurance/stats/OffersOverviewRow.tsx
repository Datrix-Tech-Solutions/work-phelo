'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { OffersOverviewCard } from '@/components/molecules/reinsurance/stats/OffersOverviewCard';
import { TopCedantsByOffersChart } from '@/components/molecules/reinsurance/stats/TopCedantsByOffersChart';
import { QuickActionsCard } from '@/components/molecules/reinsurance/QuickActionsCard';

interface OffersOverviewRowProps {
  period: Period;
}

export function OffersOverviewRow({ period }: OffersOverviewRowProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-2">
      <OffersOverviewCard period={period} />
      <div className="w-full lg:w-100">
        <TopCedantsByOffersChart period={period} />
      </div>
      <div className="w-full lg:w-72">
        <QuickActionsCard className="h-72" />
      </div>
    </div>
  );
}
