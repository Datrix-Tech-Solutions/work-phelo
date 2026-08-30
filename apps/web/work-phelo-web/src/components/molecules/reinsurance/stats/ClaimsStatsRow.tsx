'use client';

import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { CurrencyAmountListCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountListCard';
import { Icons } from '@/components/atoms/icons';
import { useClaimsWorklistSummary, useCurrencies } from '@/hooks';
import type { ClaimsCurrencyAmount } from '@/types/reinsurance';

const toAmountMap = (rows: ClaimsCurrencyAmount[]) =>
  new Map(rows.map((row) => [row.code, row.amount]));

export function ClaimsStatsRow() {
  const { data: summary, isLoading } = useClaimsWorklistSummary();
  const { data: currencies = [] } = useCurrencies();

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
        <CurrencyAmountListCard
          title="Claims Amount by Currency"
          columnLabel="Claim Amount"
          amountsByCode={toAmountMap(summary?.claimsByCurrency ?? [])}
          currencies={currencies}
          isLoading={isLoading}
          emptyMessage="No claims yet"
          className="h-64"
        />
        <CurrencyAmountListCard
          title="Recovered by Currency"
          columnLabel="Recovered"
          amountsByCode={toAmountMap(summary?.recoveredByCurrency ?? [])}
          currencies={currencies}
          isLoading={isLoading}
          emptyMessage="No recoveries yet"
          className="h-64"
        />
      </div>
    </div>
  );
}
