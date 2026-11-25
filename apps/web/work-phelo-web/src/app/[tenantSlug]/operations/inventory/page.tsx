'use client';

import { InventoryDashboardKpis } from '@/components/organisms/inventory/InventoryDashboardKpis';
import {
  PurchasesPaymentsChart,
  StockFlowChart,
} from '@/components/organisms/inventory/InventoryDashboardCharts';
import {
  LowStockCard,
  PurchaseOrdersCard,
  RecentActivityCard,
  SupplierBalancesCard,
} from '@/components/organisms/inventory/InventoryDashboardLists';
import { InventoryQuickActionsCard } from '@/components/organisms/inventory/InventoryQuickActionsCard';
import { DashboardShell } from '@/components/organisms/shared/DashboardShell';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';

export default function InventoryDashboardPage() {
  const filters = useDashboardFilters();

  return (
    <DashboardShell filters={filters}>
      <InventoryDashboardKpis />
      {/* Quick Actions takes the same width as on the Marketing dashboards: 5 of 20 columns. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_calc(25%-0.5625rem)] gap-3">
        <StockFlowChart period={filters.period} />
        <PurchasesPaymentsChart period={filters.period} />
        <InventoryQuickActionsCard fillCell className="h-60 lg:h-auto" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <LowStockCard />
        <RecentActivityCard />
        <PurchaseOrdersCard />
        <SupplierBalancesCard />
      </div>
    </DashboardShell>
  );
}
