'use client';

import { useMemo } from 'react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { Icons } from '@/components/atoms/icons';
import { useFacultatives, useClaimsSummary } from '@/hooks';
import { FacultativeStatus } from '@/types/reinsurance';

const CLOSING_STATUSES: FacultativeStatus[] = [
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

function fmtAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

export function ClaimsStatsRow() {
  const { data: allPlacements = [], isLoading: loadingPlacements } = useFacultatives();

  const closingPlacements = useMemo(
    () => allPlacements.filter((p) => CLOSING_STATUSES.includes(p.status)),
    [allPlacements],
  );

  const {
    totalClaims,
    totalClaimedAmount,
    openClaims,
    settledClaims,
    isLoading: loadingClaims,
  } = useClaimsSummary(closingPlacements);

  const isLoading = loadingPlacements || loadingClaims;
  const settlementRate = totalClaims > 0 ? (settledClaims / totalClaims) * 100 : 0;

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
        label="Total Claimed Amount"
        value={fmtAmount(totalClaimedAmount)}
        icon={Icons.CircleDollarSign}
        iconColor="#eda100"
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
        label="Settlement Rate"
        value={`${settlementRate.toFixed(1)}%`}
        icon={Icons.Activity}
        iconColor="#008300"
        isLoading={isLoading}
      />
    </div>
  );
}
