'use client';

import { useParams } from 'next/navigation';
import { DrilldownList, type DrilldownRow } from '@/components/molecules/shared/DrilldownList';
import { DashboardDrilldownPanel } from '@/components/organisms/shared/DashboardDrilldownPanel';
import {
  getItemValue,
  getStockStatus,
  useInventoryItems,
  type InventoryItem,
} from '@/hooks/inventory/useInventoryItems';
import {
  isOpenOrder,
  purchaseOrderBalance,
  purchaseOrderValue,
  PURCHASE_ORDER_STATUS_BADGE,
  usePurchaseOrders,
} from '@/hooks/inventory/usePurchaseOrders';
import { formatDate } from '@/lib/formatters';
import { formatInventoryValue } from '@/lib/inventoryCurrency';

export type InventoryKpi = 'value' | 'out' | 'low' | 'pending' | 'owed';

const PANELS: Record<
  InventoryKpi,
  { title: string; description: string; expandPath: string; empty: string }
> = {
  value: {
    title: 'Inventory Value',
    description: 'Stock on hand at cost, largest first',
    expandPath: 'items',
    empty: 'No stock on hand has a value.',
  },
  out: {
    title: 'Out of Stock',
    description: 'Active items with nothing left',
    expandPath: 'items?status=OUT_OF_STOCK',
    empty: 'Nothing is out of stock.',
  },
  low: {
    title: 'Low Stock Items',
    description: 'On hand / reorder level, closest to running out first',
    expandPath: 'items?status=LOW_STOCK',
    empty: 'No items are running low.',
  },
  pending: {
    title: 'Pending Purchase Orders',
    description: 'Awaiting delivery, soonest expected first',
    expandPath: 'purchase-orders',
    empty: 'No orders are waiting for delivery.',
  },
  owed: {
    title: 'Owed to Suppliers',
    description: 'Payable and not yet paid',
    expandPath: 'suppliers-customers',
    empty: 'No supplier is owed anything.',
  },
};

const quantity = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

interface Props {
  isOpen: boolean;
  onClose: () => void;
  kpi: InventoryKpi;
}

/** The items, orders or suppliers behind one of the inventory dashboard's figures. */
export function InventoryKpiPanel({ isOpen, onClose, kpi }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/operations/inventory`;
  const { items, isLoading: itemsLoading } = useInventoryItems();
  const { purchaseOrders, isLoading: ordersLoading } = usePurchaseOrders();
  const { title, description, expandPath, empty } = PANELS[kpi];
  const usesOrders = kpi === 'pending' || kpi === 'owed';

  const active = items.filter((i) => i.status === 'ACTIVE');
  const itemRow = (item: InventoryItem, trailing: string): DrilldownRow => ({
    id: item.id,
    title: item.name,
    detail: item.sku,
    trailing,
    href: `${base}/items/${item.id}`,
  });

  let rows: DrilldownRow[];
  if (kpi === 'value') {
    rows = active
      .filter((i) => getItemValue(i) !== 0)
      .sort((a, b) => getItemValue(b) - getItemValue(a))
      .map((i) => itemRow(i, formatInventoryValue(getItemValue(i))));
  } else if (kpi === 'out') {
    rows = active
      .filter((i) => getStockStatus(i) === 'OUT_OF_STOCK')
      .map((i) => itemRow(i, quantity(i.currentStock)));
  } else if (kpi === 'low') {
    rows = active
      .filter((i) => getStockStatus(i) === 'LOW_STOCK')
      .sort(
        (a, b) => a.currentStock / (a.reorderLevel || 1) - b.currentStock / (b.reorderLevel || 1),
      )
      .map((i) => itemRow(i, `${quantity(i.currentStock)} / ${quantity(i.reorderLevel ?? 0)}`));
  } else if (kpi === 'pending') {
    const today = new Date().toISOString().slice(0, 10);
    rows = purchaseOrders
      .filter(isOpenOrder)
      // Orders with no expected date go last.
      .sort((a, b) => (a.expectedDate ?? '9999').localeCompare(b.expectedDate ?? '9999'))
      .map((o) => ({
        id: o.id,
        title: o.supplierName,
        detail: `${o.reference} · ${
          o.expectedDate && o.expectedDate < today
            ? `Overdue since ${formatDate(o.expectedDate)}`
            : PURCHASE_ORDER_STATUS_BADGE[o.status].label
        }`,
        trailing: formatInventoryValue(purchaseOrderValue(o)),
        href: `${base}/purchase-orders/${o.id}`,
      }));
  } else {
    const owed = new Map<string, { name: string; amount: number; orders: number }>();
    for (const o of purchaseOrders) {
      // The same orders the card's total counts.
      if (['CANCELLED', 'REJECTED', 'PENDING_APPROVAL'].includes(o.status)) continue;
      const balance = purchaseOrderBalance(o);
      if (balance <= 0) continue;
      const entry = owed.get(o.supplierId) ?? { name: o.supplierName, amount: 0, orders: 0 };
      entry.amount += balance;
      entry.orders += 1;
      owed.set(o.supplierId, entry);
    }
    rows = [...owed]
      .filter(([, s]) => s.amount >= 0.01)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .map(([id, s]) => ({
        id,
        title: s.name,
        detail: `${s.orders} unpaid order${s.orders === 1 ? '' : 's'}`,
        trailing: formatInventoryValue(s.amount),
        href: `${base}/suppliers-customers/${id}`,
      }));
  }

  return (
    <DashboardDrilldownPanel
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      expandHref={`${base}/${expandPath}`}
    >
      <DrilldownList
        rows={rows}
        isLoading={usesOrders ? ordersLoading : itemsLoading}
        emptyText={empty}
      />
    </DashboardDrilldownPanel>
  );
}
