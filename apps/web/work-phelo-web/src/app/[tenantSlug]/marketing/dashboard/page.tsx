'use client';

import { DashboardShell } from '@/components/organisms/shared/DashboardShell';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';

export default function MarketingDashboardPage() {
  const filters = useDashboardFilters();

  return <DashboardShell filters={filters} />;
}
