'use client';

import { ClientsProspectsChart } from '@/components/molecules/marketing/ClientsProspectsChart';
import { RevenueByProductChart } from '@/components/molecules/marketing/RevenueByProductChart';
import { PipelineStageCards } from '@/components/molecules/marketing/PipelineStageCards';
import { MarketingDashboardKpis } from '@/components/organisms/marketing/MarketingDashboardKpis';
import { DashboardShell } from '@/components/organisms/shared/DashboardShell';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';

export default function MarketingDashboardPage() {
  const filters = useDashboardFilters();

  return (
    <DashboardShell filters={filters}>
      <MarketingDashboardKpis period={filters.period} year={filters.year} />
      <PipelineStageCards period={filters.period} year={filters.year} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-20 gap-3">
        <ClientsProspectsChart period={filters.period} className="md:col-span-2 lg:col-span-8" />
        <RevenueByProductChart
          period={filters.period}
          year={filters.year}
          className="lg:col-span-7"
        />
      </div>
    </DashboardShell>
  );
}
