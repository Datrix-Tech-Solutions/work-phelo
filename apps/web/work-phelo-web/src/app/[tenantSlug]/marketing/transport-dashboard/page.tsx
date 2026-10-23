'use client';

import { DashboardShell } from '@/components/organisms/shared/DashboardShell';
import { FleetSnapshotCard } from '@/components/molecules/marketing/FleetSnapshotCard';
import { TransportRequestsChart } from '@/components/molecules/marketing/TransportRequestsChart';
import { PendingApprovalCard } from '@/components/organisms/marketing/PendingApprovalCard';
import { TripsTodayCard } from '@/components/organisms/marketing/TripsTodayCard';
import { TransportAttentionCard } from '@/components/organisms/marketing/TransportAttentionCard';
import { TransportDashboardKpis } from '@/components/organisms/marketing/TransportDashboardKpis';
import { TransportQuickActions } from '@/components/organisms/marketing/TransportQuickActions';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';

export default function TransportDashboardPage() {
  const filters = useDashboardFilters();
  // The figures cover every request in the company, so they follow the permission to see (or
  // approve) all of them. Anyone else still gets their shortcuts.
  const canViewAll = useAnyPermissionRules([
    'marketing.requests.all:VIEW',
    'marketing.requests.all:APPROVE',
  ]);

  return (
    <DashboardShell filters={filters}>
      {canViewAll ? (
        <>
          <TransportDashboardKpis period={filters.period} year={filters.year} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-20 gap-3">
            <TransportRequestsChart
              period={filters.period}
              className="md:col-span-2 lg:col-span-8"
            />
            <FleetSnapshotCard
              period={filters.period}
              year={filters.year}
              className="lg:col-span-7"
            />
            <TransportQuickActions fillCell className="md:col-span-2 lg:col-span-5" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-20 gap-3">
            <PendingApprovalCard
              period={filters.period}
              year={filters.year}
              className="md:col-span-2 lg:col-span-7"
            />
            <TripsTodayCard
              period={filters.period}
              year={filters.year}
              className="md:col-span-2 lg:col-span-7"
            />
            <TransportAttentionCard
              period={filters.period}
              year={filters.year}
              className="md:col-span-2 lg:col-span-6"
            />
          </div>
        </>
      ) : (
        <TransportQuickActions className="max-w-xs" />
      )}
    </DashboardShell>
  );
}
