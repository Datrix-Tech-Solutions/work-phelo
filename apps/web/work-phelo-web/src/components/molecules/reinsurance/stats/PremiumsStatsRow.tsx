'use client';

import { useMemo } from 'react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { Icons } from '@/components/atoms/icons';
import { useFacultatives, usePremiumsSummary, CLOSING_STATUSES } from '@/hooks';

function fmtAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

export function PremiumsStatsRow() {
  const { data: allPlacements = [], isLoading: loadingPlacements } = useFacultatives();

  const closingPlacements = useMemo(
    () => allPlacements.filter((p) => CLOSING_STATUSES.includes(p.status)),
    [allPlacements],
  );

  const { totalDue, totalPaid, isLoading: loadingPayments } = usePremiumsSummary(closingPlacements);

  const isLoading = loadingPlacements || loadingPayments;
  const outstanding = Math.max(0, totalDue - totalPaid);
  const collectionRate = totalDue > 0 ? Math.min((totalPaid / totalDue) * 100, 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <KpiCard
        label="Cedant Premium Due"
        value={fmtAmount(totalDue)}
        icon={Icons.FileCheck2}
        iconColor="#2a78d6"
        isLoading={isLoading}
      />
      <KpiCard
        label="Premium Received"
        value={fmtAmount(totalPaid)}
        icon={Icons.CircleDollarSign}
        iconColor="#008300"
        isLoading={isLoading}
      />
      <KpiCard
        label="Outstanding Premium"
        value={fmtAmount(outstanding)}
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
  );
}
