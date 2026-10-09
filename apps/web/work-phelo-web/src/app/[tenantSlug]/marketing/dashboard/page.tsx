'use client';

import { MarketingDashboardKpis } from '@/components/organisms/marketing/MarketingDashboardKpis';
import { DashboardShell } from '@/components/organisms/shared/DashboardShell';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';

export default function MarketingDashboardPage() {
  const filters = useDashboardFilters();

  return (
    <DashboardShell filters={filters}>
      <MarketingDashboardKpis period={filters.period} year={filters.year} />
    </DashboardShell>
  );
}
