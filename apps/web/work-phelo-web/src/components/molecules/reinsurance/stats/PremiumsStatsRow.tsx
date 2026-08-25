'use client';

import { useMemo } from 'react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { CurrencyAmountScrollCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountScrollCard';
import { Icons } from '@/components/atoms/icons';
import {
  useFacultatives,
  usePremiumsSummary,
  useCedantPlacementPaymentStatuses,
  CLOSING_STATUSES,
} from '@/hooks';

export function PremiumsStatsRow() {
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
    isLoading: loadingPayments,
  } = usePremiumsSummary(closingPlacements);

  // Same 'paid' | 'partial' | 'outstanding' classification the Cedant Placements tab uses —
  // Outstanding here folds in both 'outstanding' and 'partial' (part payment), so every
  // placement lands in exactly one of Fully Paid / Outstanding, and Premium Due is the total.
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
          label="Premium Due"
          value={premiumDueCount}
          icon={Icons.FileCheck2}
          iconColor="#2a78d6"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CurrencyAmountScrollCard
          title="Premium Due by Currency"
          rows={dueByCurrency}
          isLoading={isLoading}
          emptyMessage="No premium due yet"
        />
        <CurrencyAmountScrollCard
          title="Premium Received by Currency"
          rows={paidByCurrency}
          isLoading={isLoading}
          emptyMessage="No premium received yet"
        />
      </div>
    </div>
  );
}
