'use client';

import { useMemo, useState } from 'react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { CurrencyAmountScrollCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountScrollCard';
import { PremiumsPeriod, PremiumsPeriodToggle } from '@/components/atoms/PremiumsPeriodToggle';
import { TopCedantsByOffersChart } from '@/components/molecules/reinsurance/stats/TopCedantsByOffersChart';
import { Icons } from '@/components/atoms/icons';
import {
  useFacultatives,
  usePremiumsSummary,
  useCedantPlacementPaymentStatuses,
  CLOSING_STATUSES,
} from '@/hooks';

export function PremiumsStatsRow() {
  const [period, setPeriod] = useState<PremiumsPeriod>('monthly');

  const { data: allPlacements = [], isLoading: loadingPlacements } = useFacultatives();

  const closingPlacements = useMemo(
    () => allPlacements.filter((p) => CLOSING_STATUSES.includes(p.status)),
    [allPlacements],
  );

  const {
    totalDue,
    totalPaid,
    dueByCurrency,
    paidByCurrency,
    outstandingByCurrency,
    brokerageEarnedByCurrency,
    isLoading: loadingPayments,
  } = usePremiumsSummary(closingPlacements);

  const paymentStatuses = useCedantPlacementPaymentStatuses(closingPlacements);
  const fullyPaidCount = useMemo(
    () => [...paymentStatuses.values()].filter((s) => s === 'paid').length,
    [paymentStatuses],
  );
  const outstandingCount = useMemo(
    () =>
      [...paymentStatuses.values()].filter((s) => s === 'outstanding' || s === 'partial').length,
    [paymentStatuses],
  );
  const premiumDueCount = paymentStatuses.size;

  const isLoading = loadingPlacements || loadingPayments;
  const collectionRate = totalDue > 0 ? Math.min((totalPaid / totalDue) * 100, 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <PremiumsPeriodToggle value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Premium Due"
          value={premiumDueCount}
          icon={Icons.FileCheck2}
          iconColor="#2a78d6"
          isLoading={isLoading}
        />
        <KpiCard
          label="Premium Fully Paid"
          value={fullyPaidCount}
          icon={Icons.CircleDollarSign}
          iconColor="#008300"
          isLoading={isLoading}
        />
        <KpiCard
          label="Outstanding"
          value={outstandingCount}
          icon={Icons.Clock}
          iconColor="#eda100"
          isLoading={isLoading}
        />
        <KpiCard
          label="Collection Rate"
          value={`${collectionRate.toFixed(1)}%`}
          icon={Icons.Activity}
          iconColor="#4a3aa7"
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CurrencyAmountScrollCard
          title="Premium Due"
          rows={dueByCurrency}
          isLoading={isLoading}
          emptyMessage="No premium due yet"
        />
        <CurrencyAmountScrollCard
          title="Premium Paid"
          rows={paidByCurrency}
          isLoading={isLoading}
          emptyMessage="No premium received yet"
        />
        <CurrencyAmountScrollCard
          title="Premium Outstanding"
          rows={outstandingByCurrency}
          isLoading={isLoading}
          emptyMessage="No premium outstanding"
        />
        <CurrencyAmountScrollCard
          title="Brokerage Earned"
          rows={brokerageEarnedByCurrency}
          isLoading={isLoading}
          emptyMessage="No brokerage earned yet"
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <TopCedantsByOffersChart period="monthly" />
      </div>
    </div>
  );
}
