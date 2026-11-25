'use client';

import { useParams } from 'next/navigation';
import { DrilldownList, type DrilldownRow } from '@/components/molecules/shared/DrilldownList';
import { DashboardDrilldownPanel } from '@/components/organisms/shared/DashboardDrilldownPanel';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';
import { purchaseOrderValue, usePurchaseOrders } from '@/hooks/inventory/usePurchaseOrders';
import { getMovementValue, useStockMovements } from '@/hooks/inventory/useStockMovements';
import { formatDate } from '@/lib/formatters';
import { formatInventoryValue } from '@/lib/inventoryCurrency';
import type { SeriesBucket } from '@/lib/periodSeries';

export type InventoryBarKind = 'STOCK_IN' | 'STOCK_OUT' | 'ORDERED' | 'PAID';

export interface InventoryBar {
  kind: InventoryBarKind;
  bucket: SeriesBucket;
}

const BARS: Record<InventoryBarKind, { title: string; expandPath: string; empty: string }> = {
  STOCK_IN: {
    title: 'Stock In',
    expandPath: 'stock-management?filter=STOCK_IN',
    empty: 'No stock came in during this range.',
  },
  STOCK_OUT: {
    title: 'Stock Out',
    expandPath: 'stock-management?filter=STOCK_OUT',
    empty: 'No stock went out during this range.',
  },
  ORDERED: {
    title: 'Ordered',
    expandPath: 'purchase-orders',
    empty: 'Nothing was ordered in this range.',
  },
  PAID: {
    title: 'Paid to Suppliers',
    expandPath: 'purchase-orders',
    empty: 'Nothing was paid in this range.',
  },
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bar: InventoryBar | null;
}

/** The movements, orders or payments behind a bar picked on one of the dashboard's charts. */
export function InventoryBarPanel({ isOpen, onClose, bar }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/operations/inventory`;
  const { movements, isLoading: movementsLoading } = useStockMovements();
  const { purchaseOrders, isLoading: ordersLoading } = usePurchaseOrders();
  const { items } = useInventoryItems();
  const kind = bar?.kind ?? 'STOCK_IN';
  const { title, expandPath, empty } = BARS[kind];
  const isStock = kind === 'STOCK_IN' || kind === 'STOCK_OUT';

  const within = (value: string) => {
    const date = value.slice(0, 10);
    return bar !== null && bar.bucket.fromDate <= date && date <= bar.bucket.toDate;
  };
  const newestFirst = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date);
  // Records are picked the way the charts add them up.
  const liveOrders = purchaseOrders.filter((o) => o.status !== 'CANCELLED');

  let rows: DrilldownRow[];
  if (isStock) {
    rows = movements
      .filter(
        (m) =>
          m.status === 'COMPLETED' && m.kind !== 'REVALUATION' && m.type === kind && within(m.date),
      )
      .sort(newestFirst)
      .map((m) => {
        const first = items.find((i) => i.id === m.lines[0]?.itemId)?.name ?? 'Stock';
        return {
          id: m.id,
          title: m.lines.length > 1 ? `${first} +${m.lines.length - 1}` : first,
          detail: `${m.reference} · ${formatDate(m.date)}`,
          trailing: formatInventoryValue(getMovementValue(m)),
          href: `${base}/stock-management/${m.id}`,
        };
      });
  } else if (kind === 'ORDERED') {
    rows = liveOrders
      .filter((o) => within(o.date))
      .sort(newestFirst)
      .map((o) => ({
        id: o.id,
        title: o.supplierName,
        detail: `${o.reference} · ${formatDate(o.date)}`,
        trailing: formatInventoryValue(purchaseOrderValue(o)),
        href: `${base}/purchase-orders/${o.id}`,
      }));
  } else {
    rows = liveOrders
      .flatMap((order) => order.payments.map((payment, i) => ({ order, payment, i })))
      .filter(({ payment }) => within(payment.date))
      .sort((a, b) => newestFirst(a.payment, b.payment))
      .map(({ order, payment, i }) => ({
        id: `${order.id}:${i}`,
        title: order.supplierName,
        detail: `${order.reference} · ${formatDate(payment.date)}`,
        trailing: formatInventoryValue(payment.amount),
        href: `${base}/purchase-orders/${order.id}`,
      }));
  }

  return (
    <DashboardDrilldownPanel
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={bar?.bucket.detail}
      expandHref={`${base}/${expandPath}`}
    >
      <DrilldownList
        rows={rows}
        isLoading={isStock ? movementsLoading : ordersLoading}
        emptyText={empty}
      />
    </DashboardDrilldownPanel>
  );
}
