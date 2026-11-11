'use client';

import { useMemo } from 'react';
import { ClipboardList, Hourglass, PackageCheck, Receipt, Wallet } from 'lucide-react';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { summarizePurchaseOrders, type PurchaseOrder } from '@/hooks/inventory/usePurchaseOrders';
import { formatInventoryValue } from '@/lib/inventoryCurrency';

const MODULE_COLOR = 'var(--module-inventory, #0047ab)';

/** How a supplier's purchase orders stand: counts, what is still to arrive, and what is owed. */
export function SupplierOrderStats({
  orders,
  isLoading,
}: {
  orders: PurchaseOrder[];
  isLoading?: boolean;
}) {
  const stats = useMemo(() => summarizePurchaseOrders(orders), [orders]);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        compact
        label="Total Orders"
        value={stats.totalOrders.toLocaleString()}
        icon={ClipboardList}
        iconColor={MODULE_COLOR}
        isLoading={isLoading}
      />
      <KpiCard
        compact
        label="Pending Orders"
        value={stats.pendingOrders.toLocaleString()}
        icon={Hourglass}
        iconColor="#f59e0b"
        isLoading={isLoading}
      />
      <KpiCard
        compact
        label="Completed Orders"
        value={stats.receivedOrders.toLocaleString()}
        icon={PackageCheck}
        iconColor="#1baf7a"
        isLoading={isLoading}
      />
      <KpiCard
        compact
        label="Total Ordered"
        value={formatInventoryValue(stats.totalOrdered)}
        icon={Receipt}
        iconColor="#8b5cf6"
        isLoading={isLoading}
      />
      <KpiCard
        compact
        label="Pending Delivery Value"
        value={formatInventoryValue(stats.pendingDeliveryValue)}
        icon={Wallet}
        iconColor="#f59e0b"
        isLoading={isLoading}
      />
      <KpiCard
        compact
        label="Amount Owed"
        value={formatInventoryValue(stats.amountOwed)}
        icon={Wallet}
        iconColor="#ef4444"
        isLoading={isLoading}
      />
    </div>
  );
}
