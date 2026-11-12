'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  DashboardListCard,
  type DashboardListRow,
} from '@/components/molecules/accounting/DashboardListCard';
import { useInventoryItems, getStockStatus } from '@/hooks/inventory/useInventoryItems';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';
import { getMovementQuantity, useStockMovements } from '@/hooks/inventory/useStockMovements';
import {
  isOpenOrder,
  purchaseOrderBalance,
  purchaseOrderValue,
  usePurchaseOrders,
  PURCHASE_ORDER_STATUS_BADGE,
  type PurchaseOrder,
} from '@/hooks/inventory/usePurchaseOrders';
import { formatInventoryValue } from '@/lib/inventoryCurrency';
import { formatDate } from '@/lib/formatters';
import { MOVEMENT_TYPE_LABEL } from '@/lib/inventoryMovement';

const SHOWN = 6;
const today = () => new Date().toISOString().slice(0, 10);

const useBase = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  return `/${tenantSlug}/operations/inventory`;
};

/** Items at or below their reorder level, and items with nothing left. */
export function LowStockCard({ className }: { className?: string }) {
  const base = useBase();
  const { items, isLoading } = useInventoryItems();

  const { low, out } = useMemo(() => {
    const active = items.filter((i) => i.status === 'ACTIVE');
    const row = (i: (typeof items)[number]): DashboardListRow => ({
      key: i.id,
      primary: i.name,
      secondary: i.sku,
      trailing:
        i.reorderLevel !== null
          ? `${i.currentStock.toLocaleString()} / ${i.reorderLevel.toLocaleString()}`
          : i.currentStock.toLocaleString(),
    });
    const lowItems = active
      .filter((i) => getStockStatus(i) === 'LOW_STOCK')
      // Closest to running out first, as a share of the reorder level.
      .sort(
        (a, b) => a.currentStock / (a.reorderLevel || 1) - b.currentStock / (b.reorderLevel || 1),
      );
    const outItems = active.filter((i) => getStockStatus(i) === 'OUT_OF_STOCK');
    return {
      low: { count: lowItems.length, rows: lowItems.slice(0, SHOWN).map(row) },
      out: { count: outItems.length, rows: outItems.slice(0, SHOWN).map(row) },
    };
  }, [items]);

  return (
    <DashboardListCard
      title="Stock Alerts"
      subtitle="On hand / reorder level"
      className={className}
      sections={[
        {
          title: 'Low Stock',
          count: low.count,
          rows: low.rows,
          href: `${base}/items`,
          isLoading,
          emptyText: 'No items are running low.',
        },
        {
          title: 'Out of Stock',
          count: out.count,
          rows: out.rows,
          href: `${base}/items`,
          isLoading,
          emptyText: 'Nothing is out of stock.',
        },
      ]}
    />
  );
}

/** The latest stock movements. Drafts and cancelled or reversed movements are left out. */
export function RecentActivityCard({ className }: { className?: string }) {
  const base = useBase();
  const { movements, isLoading } = useStockMovements();
  const { items } = useInventoryItems();
  const { warehouses } = useInventoryWarehouses();

  const rows = useMemo<DashboardListRow[]>(() => {
    const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? 'Item';
    const warehouseName = (id: string | null) => warehouses.find((w) => w.id === id)?.name ?? null;
    return movements
      .filter((m) => m.status === 'COMPLETED' && m.kind !== 'REVALUATION')
      .slice(0, SHOWN)
      .map((m) => {
        const first = m.lines[0] ? itemName(m.lines[0].itemId) : 'Stock';
        const where = warehouseName(m.toWarehouseId ?? m.fromWarehouseId);
        return {
          key: m.id,
          primary: `${MOVEMENT_TYPE_LABEL[m.type]} · ${first}${m.lines.length > 1 ? ` +${m.lines.length - 1}` : ''}`,
          secondary: [where, formatDate(m.date)].filter(Boolean).join(' · '),
          trailing: `${getMovementQuantity(m).toLocaleString()} units`,
        };
      });
  }, [movements, items, warehouses]);

  return (
    <DashboardListCard
      title="Recent Inventory Activity"
      subtitle="Latest completed movements"
      className={className}
      sections={[
        {
          title: 'Movements',
          count: undefined,
          rows,
          href: `${base}/stock-management`,
          isLoading,
          emptyText: 'No stock movements yet.',
        },
      ]}
    />
  );
}

/** Orders still to arrive (with overdue ones marked), and the latest orders placed. */
export function PurchaseOrdersCard({ className }: { className?: string }) {
  const base = useBase();
  const { purchaseOrders, isLoading } = usePurchaseOrders();

  const { pending, recent } = useMemo(() => {
    const row = (o: PurchaseOrder): DashboardListRow => {
      const overdue = isOpenOrder(o) && o.expectedDate !== null && o.expectedDate < today();
      return {
        key: o.id,
        primary: `${o.reference} · ${o.supplierName}`,
        secondary: overdue
          ? `Overdue since ${formatDate(o.expectedDate!)}`
          : `${PURCHASE_ORDER_STATUS_BADGE[o.status].label} · ${formatDate(o.date)}`,
        trailing: formatInventoryValue(purchaseOrderValue(o)),
      };
    };
    const open = purchaseOrders
      .filter(isOpenOrder)
      // Soonest expected first; orders with no date last.
      .sort((a, b) => (a.expectedDate ?? '9999').localeCompare(b.expectedDate ?? '9999'));
    const latest = [...purchaseOrders].sort((a, b) => b.date.localeCompare(a.date));
    return {
      pending: { count: open.length, rows: open.slice(0, SHOWN).map(row) },
      recent: { count: undefined, rows: latest.slice(0, SHOWN).map(row) },
    };
  }, [purchaseOrders]);

  return (
    <DashboardListCard
      title="Purchase Orders"
      subtitle="Awaiting delivery, and the latest placed"
      className={className}
      sections={[
        {
          title: 'Pending',
          count: pending.count,
          rows: pending.rows,
          href: `${base}/purchase-orders`,
          isLoading,
          emptyText: 'No orders are waiting for delivery.',
        },
        {
          title: 'Recent',
          count: recent.count,
          rows: recent.rows,
          href: `${base}/purchase-orders`,
          isLoading,
          emptyText: 'No purchase orders yet.',
        },
      ]}
    />
  );
}

/** What is owed to each supplier: received goods not yet paid for, largest first. */
export function SupplierBalancesCard({ className }: { className?: string }) {
  const base = useBase();
  const { purchaseOrders, isLoading } = usePurchaseOrders();

  const { rows, count } = useMemo(() => {
    const owed = new Map<string, { name: string; amount: number; orders: number }>();
    for (const o of purchaseOrders) {
      if (o.status === 'CANCELLED') continue;
      const balance = purchaseOrderBalance(o);
      if (balance < 0.01) continue;
      const entry = owed.get(o.supplierId) ?? { name: o.supplierName, amount: 0, orders: 0 };
      entry.amount += balance;
      entry.orders += 1;
      owed.set(o.supplierId, entry);
    }
    const sorted = [...owed.entries()].sort((a, b) => b[1].amount - a[1].amount);
    return {
      count: sorted.length,
      rows: sorted.slice(0, SHOWN).map(([id, s]) => ({
        key: id,
        primary: s.name,
        secondary: `${s.orders} unpaid order${s.orders === 1 ? '' : 's'}`,
        trailing: formatInventoryValue(s.amount),
      })),
    };
  }, [purchaseOrders]);

  return (
    <DashboardListCard
      title="Owed to Suppliers"
      subtitle="Received, not yet paid"
      className={className}
      sections={[
        {
          title: 'Suppliers',
          count,
          rows,
          href: `${base}/suppliers-customers`,
          isLoading,
          emptyText: 'No supplier is owed anything.',
        },
      ]}
    />
  );
}
