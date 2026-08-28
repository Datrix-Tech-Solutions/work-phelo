'use client';

import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { CurrencyAmountScrollCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountScrollCard';
import { Icons } from '@/components/atoms/icons';
import { useClaimsWorklistSummary } from '@/hooks';

export function ClaimsStatsRow() {
  const { data: summary, isLoading } = useClaimsWorklistSummary();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Total Claims"
          value={summary?.totalClaims ?? 0}
          icon={Icons.FileWarning}
          iconColor="#2a78d6"
          isLoading={isLoading}
        />
        <KpiCard
          label="Open Claims"
          value={summary?.openClaims ?? 0}
          icon={Icons.Clock}
          iconColor="#4a3aa7"
          isLoading={isLoading}
        />
        <KpiCard
          label="Closed Claims"
          value={summary?.closedClaims ?? 0}
          icon={Icons.CircleCheckBig}
          iconColor="#6b7280"
          isLoading={isLoading}
        />
        <KpiCard
          label="Notifications"
          value={summary?.notificationClaims ?? 0}
          icon={Icons.Bell}
          iconColor="#eda100"
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CurrencyAmountScrollCard
          title="Claims Amount by Currency"
          rows={summary?.claimsByCurrency ?? []}
          isLoading={isLoading}
        />
        <CurrencyAmountScrollCard
          title="Recovered by Currency"
          rows={summary?.recoveredByCurrency ?? []}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
