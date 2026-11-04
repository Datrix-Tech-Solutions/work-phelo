'use client';

import { InventoryDashboardKpis } from '@/components/organisms/inventory/InventoryDashboardKpis';
import { DashboardShell } from '@/components/organisms/shared/DashboardShell';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';

export default function InventoryDashboardPage() {
  const filters = useDashboardFilters();

  return (
    <DashboardShell filters={filters}>
      <InventoryDashboardKpis />
    </DashboardShell>
  );
}
