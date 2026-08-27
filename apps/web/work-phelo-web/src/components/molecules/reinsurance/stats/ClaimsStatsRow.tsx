'use client';

import { useMemo } from 'react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import {
  CurrencyAmountScrollCard,
  CurrencyAmountRow,
} from '@/components/molecules/reinsurance/stats/CurrencyAmountScrollCard';
import { Icons } from '@/components/atoms/icons';
import { useFacultatives, useClaimsSummary, useClaimsByTab, ClaimTabRow } from '@/hooks';
import { FacultativeStatus } from '@/types/reinsurance';

const CLOSING_STATUSES: FacultativeStatus[] = [
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

/** Sums `amountFor(row)` per claim currency, most first — each caller sorts independently,
 *  since the currency with the biggest claims total isn't necessarily the one with the
 *  biggest recovered total. */
function sumByCurrency(
  rows: ClaimTabRow[],
  amountFor: (row: ClaimTabRow) => number | undefined,
): CurrencyAmountRow[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const amount = amountFor(row);
    if (amount == null) continue;
    const code = row.claim.currency;
    totals.set(code, (totals.get(code) ?? 0) + amount);
  }
  return Array.from(totals.entries())
    .map(([code, amount]) => ({ code, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function ClaimsStatsRow() {
  const { data: allPlacements = [], isLoading: loadingPlacements } = useFacultatives();

  const closingPlacements = useMemo(
    () => allPlacements.filter((p) => CLOSING_STATUSES.includes(p.status)),
    [allPlacements],
  );

  const { totalClaims, isLoading: loadingClaims } = useClaimsSummary(closingPlacements);

  // Open/Closed counts mirror the Open Claims/Closed Claims tables exactly — both draw
  // from useClaimsByTab, which buckets by actual reinsurer recovery rather than claim.status.
  const {
    notification,
    open,
    closed,
    isLoadingClaims: loadingTabClaims,
    isLoadingFinancials,
  } = useClaimsByTab(closingPlacements);
  const notificationClaims = notification.length;
  const openClaims = open.length;
  const closedClaims = closed.length;

  const isLoading = loadingPlacements || loadingClaims || loadingTabClaims || isLoadingFinancials;

  // Finalized claims only (Open + Closed) — Notification-stage claims are still just an
  // estimate, so folding them in here would overstate exposure with unconfirmed amounts.
  const finalizedRows = useMemo(() => [...open, ...closed], [open, closed]);

  const claimsByCurrency = useMemo(
    () =>
      sumByCurrency(finalizedRows, (row) =>
        row.claim.finalLossAmount != null ? parseFloat(row.claim.finalLossAmount) : undefined,
      ),
    [finalizedRows],
  );

  const recoveredByCurrency = useMemo(
    () => sumByCurrency(finalizedRows, (row) => row.recoveredAmount),
    [finalizedRows],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Total Claims"
          value={totalClaims}
          icon={Icons.FileWarning}
          iconColor="#2a78d6"
          isLoading={isLoading}
        />
        <KpiCard
          label="Open Claims"
          value={openClaims}
          icon={Icons.Clock}
          iconColor="#4a3aa7"
          isLoading={isLoading}
        />
        <KpiCard
          label="Closed Claims"
          value={closedClaims}
          icon={Icons.CircleCheckBig}
          iconColor="#6b7280"
          isLoading={isLoading}
        />
        <KpiCard
          label="Notifications"
          value={notificationClaims}
          icon={Icons.Bell}
          iconColor="#eda100"
          isLoading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CurrencyAmountScrollCard
          title="Claims Amount by Currency"
          rows={claimsByCurrency}
          isLoading={isLoading}
        />
        <CurrencyAmountScrollCard
          title="Recovered by Currency"
          rows={recoveredByCurrency}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
