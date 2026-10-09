'use client';

import { DashboardShell } from '@/components/organisms/shared/DashboardShell';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';

export default function HrDashboardPage() {
  const filters = useDashboardFilters();

  return <DashboardShell filters={filters} showViewToggle />;
}
