'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  PackageX,
  Truck,
  Warehouse,
  Wallet,
} from 'lucide-react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import {
  InventoryKpiPanel,
  type InventoryKpi,
} from '@/components/organisms/inventory/InventoryKpiPanel';
import {
  getItemValue,
  getStockStatus,
  useInventoryItems,
} from '@/hooks/inventory/useInventoryItems';
import {
  useInventoryCustomers,
  useInventorySuppliers,
} from '@/hooks/inventory/useInventoryParties';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';
import { summarizePurchaseOrders, usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { formatInventoryValue } from '@/lib/inventoryCurrency';

const MODULE_COLOR = 'var(--module-inventory, #0047ab)';

/** Current-state KPIs for the inventory dashboard. Stock levels are a snapshot, so they do not
 * follow the period filter. Only active items and warehouses are counted. */
export function InventoryDashboardKpis() {
  const { items, isLoading: itemsLoading } = useInventoryItems();
  const { warehouses, isLoading: warehousesLoading } = useInventoryWarehouses();

  const { purchaseOrders, isLoading: ordersLoading } = usePurchaseOrders();
  const { parties: suppliers, isLoading: suppliersLoading } = useInventorySuppliers();
  const { parties: customers } = useInventoryCustomers();

  const orders = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const summary = summarizePurchaseOrders(purchaseOrders);
    const overdue = purchaseOrders.filter(
      (o) =>
        (o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED') &&
        o.expectedDate !== null &&
        o.expectedDate < today,
    ).length;
    return { ...summary, overdue };
  }, [purchaseOrders]);

  const stats = useMemo(() => {
    const active = items.filter((i) => i.status === 'ACTIVE');
    return {
      totalItems: active.length,
      totalValue: active.reduce((sum, i) => sum + getItemValue(i), 0),
      lowStock: active.filter((i) => getStockStatus(i) === 'LOW_STOCK').length,
      outOfStock: active.filter((i) => getStockStatus(i) === 'OUT_OF_STOCK').length,
      warehouses: warehouses.filter((w) => w.status === 'ACTIVE').length,
    };
  }, [items, warehouses]);

  // Open state is kept apart from the figure, so the panel keeps its content while it slides shut.
  const [kpi, setKpi] = useState<InventoryKpi>('value');
  const [panelOpen, setPanelOpen] = useState(false);
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/operations/inventory`;
  const opens = (next: InventoryKpi) => () => {
    setKpi(next);
    setPanelOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Items"
          href={`${base}/items`}
          value={stats.totalItems.toLocaleString()}
          icon={Boxes}
          iconColor={MODULE_COLOR}
          isLoading={itemsLoading}
        />
        <KpiCard
          label="Total Inventory Value"
          onClick={opens('value')}
          selected={panelOpen && kpi === 'value'}
          value={formatInventoryValue(stats.totalValue)}
          icon={Wallet}
          iconColor="#1baf7a"
          isLoading={itemsLoading}
        />
        <KpiCard
          label="Out of Stock"
          onClick={opens('out')}
          selected={panelOpen && kpi === 'out'}
          value={stats.outOfStock.toLocaleString()}
          icon={PackageX}
          iconColor="#ef4444"
          isLoading={itemsLoading}
        />
        <KpiCard
          label="Total Warehouses"
          href={`${base}/warehouses`}
          value={stats.warehouses.toLocaleString()}
          icon={Warehouse}
          iconColor="#8b5cf6"
          isLoading={warehousesLoading}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Low Stock Items"
          onClick={opens('low')}
          selected={panelOpen && kpi === 'low'}
          value={stats.lowStock.toLocaleString()}
          icon={AlertTriangle}
          iconColor="#f59e0b"
          isLoading={itemsLoading}
        />
        <KpiCard
          label="Pending Purchase Orders"
          onClick={opens('pending')}
          selected={panelOpen && kpi === 'pending'}
          value={orders.pendingOrders.toLocaleString()}
          icon={ClipboardList}
          iconColor="#2a78d6"
          sub={[{ label: 'Overdue', value: orders.overdue.toLocaleString() }]}
          isLoading={ordersLoading}
        />
        <KpiCard
          label="Owed to Suppliers"
          onClick={opens('owed')}
          selected={panelOpen && kpi === 'owed'}
          value={formatInventoryValue(orders.amountOwed)}
          icon={Wallet}
          iconColor="#ef4444"
          sub={[
            {
              label: 'Awaiting delivery',
              value: formatInventoryValue(orders.pendingDeliveryValue),
            },
          ]}
          subPlacement="below"
          isLoading={ordersLoading}
        />
        <KpiCard
          label="Suppliers"
          href={`${base}/suppliers-customers`}
          value={suppliers.filter((p) => p.status === 'ACTIVE').length.toLocaleString()}
          icon={Truck}
          iconColor="#d97706"
          sub={[
            {
              label: 'Customers',
              value: customers.filter((p) => p.status === 'ACTIVE').length.toLocaleString(),
            },
          ]}
          isLoading={suppliersLoading}
        />
      </div>
      <InventoryKpiPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} kpi={kpi} />
    </>
  );
}
