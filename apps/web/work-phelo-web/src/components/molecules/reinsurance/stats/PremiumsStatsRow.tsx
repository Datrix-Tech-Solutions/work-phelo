'use client';

import { useMemo, useState } from 'react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { CurrencyAmountListCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountListCard';
import {
  PremiumsPeriod,
  PremiumsPeriodToggle,
  PREMIUMS_PERIOD_LABEL,
  premiumsPeriodStart,
} from '@/components/atoms/PremiumsPeriodToggle';
import { TopCedantsByOffersChart } from '@/components/molecules/reinsurance/stats/TopCedantsByOffersChart';
import { Icons } from '@/components/atoms/icons';
import {
  useFacultatives,
  usePremiumsSummary,
  usePremiumsPeriodSummary,
  useCedantPlacementPaymentStatuses,
  useCurrencies,
  CLOSING_STATUSES,
  type CurrencyAmount,
} from '@/hooks';

const toAmountMap = (rows: CurrencyAmount[]) => new Map(rows.map((row) => [row.code, row.amount]));

export function PremiumsStatsRow() {
  const [period, setPeriod] = useState<PremiumsPeriod>('monthly');
  const sinceIso = useMemo(() => premiumsPeriodStart(period).toISOString(), [period]);
  const periodLabel = PREMIUMS_PERIOD_LABEL[period];

  const { data: allPlacements = [], isLoading: loadingPlacements } = useFacultatives();

  const closingPlacements = useMemo(
    () => allPlacements.filter((p) => CLOSING_STATUSES.includes(p.status)),
    [allPlacements],
  );

  // Balances (due / outstanding) — not windowable, always current.
  const {
    dueByCurrency,
    outstandingByCurrency,
    isLoading: loadingPayments,
  } = usePremiumsSummary(closingPlacements);

  // Flows (paid / brokerage / collection rate) — scoped to the selected period.
  const periodSummary = usePremiumsPeriodSummary(closingPlacements, sinceIso);

  const { data: currencies = [] } = useCurrencies();

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

  const isLoading = loadingPlacements || loadingPayments || periodSummary.isLoading;
  const collectionRate = periodSummary.collectionRate;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <PremiumsPeriodToggle value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopCedantsByOffersChart period="monthly" closedOnly sinceIso={sinceIso} className="h-56" />

        <div className="grid grid-cols-2 grid-rows-2 gap-4 lg:h-56">
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
            label={`Collection Rate ${periodLabel}`}
            value={`${collectionRate.toFixed(1)}%`}
            icon={Icons.Activity}
            iconColor="#4a3aa7"
            isLoading={isLoading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CurrencyAmountListCard
          title="Premium Due"
          columnLabel="Due"
          amountsByCode={toAmountMap(dueByCurrency)}
          currencies={currencies}
          isLoading={isLoading}
          emptyMessage="No premium due yet"
          className="h-64"
        />
        <CurrencyAmountListCard
          title={`Premium Paid ${periodLabel}`}
          columnLabel="Paid"
          amountsByCode={toAmountMap(periodSummary.paidByCurrency)}
          currencies={currencies}
          isLoading={isLoading}
          emptyMessage="No premium received in this period"
          className="h-64"
        />
        <CurrencyAmountListCard
          title="Premium Outstanding"
          columnLabel="Outstanding"
          amountsByCode={toAmountMap(outstandingByCurrency)}
          currencies={currencies}
          isLoading={isLoading}
          emptyMessage="No premium outstanding"
          className="h-64"
        />
        <CurrencyAmountListCard
          title={`Brokerage Earned ${periodLabel}`}
          columnLabel="Brokerage"
          amountsByCode={toAmountMap(periodSummary.brokerageEarnedByCurrency)}
          currencies={currencies}
          isLoading={isLoading}
          emptyMessage="No brokerage earned in this period"
          className="h-64"
        />
      </div>
    </div>
  );
}
