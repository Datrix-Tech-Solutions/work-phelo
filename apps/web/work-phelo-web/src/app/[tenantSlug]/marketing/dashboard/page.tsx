'use client';

import { ClientsProspectsChart } from '@/components/molecules/marketing/ClientsProspectsChart';
import { RevenueByProductChart } from '@/components/molecules/marketing/RevenueByProductChart';
import { TopSalesPersonnelChart } from '@/components/molecules/marketing/TopSalesPersonnelChart';
import { TargetsOverviewCard } from '@/components/molecules/marketing/TargetsOverviewCard';
import { PipelineStageCards } from '@/components/molecules/marketing/PipelineStageCards';
import { MarketingDashboardKpis } from '@/components/organisms/marketing/MarketingDashboardKpis';
import type { DashboardViewOption } from '@/components/atoms/DashboardViewToggle';
import { DashboardShell } from '@/components/organisms/shared/DashboardShell';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';

const VIEWS: DashboardViewOption[] = [
  { label: 'General Dashboard', value: 'general' },
  { label: 'Personal Dashboard', value: 'personal' },
];

export default function MarketingDashboardPage() {
  const filters = useDashboardFilters();
  // The general dashboard is the organisation-wide view and needs its own permission. Without
  // it the user only has their personal dashboard, so there is nothing to toggle.
  const canViewGeneral = usePermissionRule('marketing.dashboard:VIEW');
  const view = canViewGeneral ? filters.view : 'personal';

  return (
    <DashboardShell filters={filters} showViewToggle={canViewGeneral} viewOptions={VIEWS}>
      {view === 'general' && (
        <>
          <MarketingDashboardKpis period={filters.period} year={filters.year} />
          <PipelineStageCards period={filters.period} year={filters.year} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-20 gap-3">
            <ClientsProspectsChart
              period={filters.period}
              className="md:col-span-2 lg:col-span-8"
            />
            <RevenueByProductChart
              period={filters.period}
              year={filters.year}
              className="lg:col-span-7"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-20 gap-3">
            <TopSalesPersonnelChart
              period={filters.period}
              year={filters.year}
              className="md:col-span-2 lg:col-span-10"
            />
            <TargetsOverviewCard
              period={filters.period}
              year={filters.year}
              className="md:col-span-2 lg:col-span-10"
            />
          </div>
        </>
      )}
    </DashboardShell>
  );
}
