'use client';

import { useMemo } from 'react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { Icons } from '@/components/atoms/icons';
import { useFacultatives, useClaimsSummary, useClaimsByTab } from '@/hooks';
import { FacultativeStatus } from '@/types/reinsurance';

const CLOSING_STATUSES: FacultativeStatus[] = [
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

export function ClaimsStatsRow() {
  const { data: allPlacements = [], isLoading: loadingPlacements } = useFacultatives();

  const closingPlacements = useMemo(
    () => allPlacements.filter((p) => CLOSING_STATUSES.includes(p.status)),
    [allPlacements],
  );

  const {
    totalClaims,
    // settledClaims,
    isLoading: loadingClaims,
  } = useClaimsSummary(closingPlacements);

  // Open/Closed counts mirror the Open Claims/Closed Claims tables exactly — both draw
  // from useClaimsByTab, which buckets by actual reinsurer recovery rather than claim.status.
  const {
    open,
    closed,
    isLoadingClaims: loadingTabClaims,
    isLoadingFinancials,
  } = useClaimsByTab(closingPlacements);
  const openClaims = open.length;
  const closedClaims = closed.length;
  const finalizedClaims = openClaims + closedClaims;

  const isLoading = loadingPlacements || loadingClaims || loadingTabClaims || isLoadingFinancials;
  // % of finalized claims fully recovered from reinsurers.
  const recoveryRate = finalizedClaims > 0 ? (closedClaims / finalizedClaims) * 100 : 0;
  // % of all claims settled with the cedant (claim.status), independent of recovery.
  // const settlementRate = totalClaims > 0 ? (settledClaims / totalClaims) * 100 : 0;

  return (
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
        label="Recovery Rate"
        value={`${recoveryRate.toFixed(1)}%`}
        icon={Icons.RotateCcw}
        iconColor="#eda100"
        isLoading={isLoading}
      />
      {/* <KpiCard
        label="Settlement Rate"
        value={`${settlementRate.toFixed(1)}%`}
        icon={Icons.Activity}
        iconColor="#008300"
        isLoading={isLoading}
      /> */}
    </div>
  );
}
