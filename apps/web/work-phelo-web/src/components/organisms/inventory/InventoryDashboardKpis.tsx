'use client';

import { useMemo } from 'react';
import { Boxes, PackageX, Warehouse, Wallet } from 'lucide-react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import {
  getItemValue,
  getStockStatus,
  useInventoryItems,
} from '@/hooks/inventory/useInventoryItems';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';
import { formatInventoryValue } from '@/lib/inventoryCurrency';

const MODULE_COLOR = 'var(--module-inventory, #0047ab)';

/** Current-state KPIs for the inventory dashboard. Stock levels are a snapshot, so they do not
 * follow the period filter. Only active items and warehouses are counted. */
export function InventoryDashboardKpis() {
  const { items, isLoading: itemsLoading } = useInventoryItems();
  const { warehouses, isLoading: warehousesLoading } = useInventoryWarehouses();

  const stats = useMemo(() => {
    const active = items.filter((i) => i.status === 'ACTIVE');
    return {
      totalItems: active.length,
      totalValue: active.reduce((sum, i) => sum + getItemValue(i), 0),
      outOfStock: active.filter((i) => getStockStatus(i) === 'OUT_OF_STOCK').length,
      warehouses: warehouses.filter((w) => w.status === 'ACTIVE').length,
    };
  }, [items, warehouses]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Total Items"
        value={stats.totalItems.toLocaleString()}
        icon={Boxes}
        iconColor={MODULE_COLOR}
        isLoading={itemsLoading}
      />
      <KpiCard
        label="Total Inventory Value"
        value={formatInventoryValue(stats.totalValue)}
        icon={Wallet}
        iconColor="#1baf7a"
        isLoading={itemsLoading}
      />
      <KpiCard
        label="Out of Stock"
        value={stats.outOfStock.toLocaleString()}
        icon={PackageX}
        iconColor="#ef4444"
        isLoading={itemsLoading}
      />
      <KpiCard
        label="Total Warehouses"
        value={stats.warehouses.toLocaleString()}
        icon={Warehouse}
        iconColor="#8b5cf6"
        isLoading={warehousesLoading}
      />
    </div>
  );
}
