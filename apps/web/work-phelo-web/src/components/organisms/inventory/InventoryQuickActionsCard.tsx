'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeftRight,
  ClipboardPlus,
  PackageMinus,
  PackagePlus,
  SlidersHorizontal,
  Truck,
  UserPlus,
  Wallet,
} from 'lucide-react';
import {
  QuickActionEntry,
  QuickActionTiles,
} from '@/components/molecules/marketing/QuickActionTiles';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';

type Action =
  | 'purchase-order'
  | 'receive'
  | 'stock-out'
  | 'transfer'
  | 'adjustment'
  | 'item'
  | 'supplier'
  | 'customer'
  | 'pay-supplier';

/** Where each action goes, under the tenant's inventory module. These pages open their form when
 * they arrive with ?new=1 (or ?type= for a stock movement). */
const PATHS: Record<Action, string> = {
  'purchase-order': 'purchase-orders?new=1',
  receive: 'stock-management?type=STOCK_IN',
  'stock-out': 'stock-management?type=STOCK_OUT',
  transfer: 'stock-management?type=TRANSFER',
  adjustment: 'stock-management?type=ADJUSTMENT',
  item: 'items?new=1',
  supplier: 'suppliers-customers?tab=SUPPLIER&new=1',
  customer: 'suppliers-customers?tab=CUSTOMER&new=1',
  // Payments are made against an order, from the orders list.
  'pay-supplier': 'purchase-orders',
};

/** The inventory dashboard's shortcuts: orders, stock movements and new records. */
export function InventoryQuickActionsCard({
  className,
  fillCell = false,
}: {
  className?: string;
  fillCell?: boolean;
}) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  const entries = useMemo<QuickActionEntry<Action>[]>(
    () => [
      {
        key: 'purchase-order',
        label: 'New Purchase Order',
        icon: ClipboardPlus,
        color: '#2a78d6',
        allowed: true,
      },
      {
        key: 'receive',
        label: 'Receive Stock',
        icon: PackagePlus,
        color: '#1baf7a',
        allowed: true,
      },
      { key: 'stock-out', label: 'Stock Out', icon: PackageMinus, color: '#e34948', allowed: true },
      {
        key: 'transfer',
        label: 'Transfer Stock',
        icon: ArrowLeftRight,
        color: '#0891b2',
        allowed: true,
      },
      {
        key: 'adjustment',
        label: 'Adjust Stock',
        icon: SlidersHorizontal,
        color: '#eb6834',
        allowed: true,
      },
      { key: 'item', label: 'Add Item', icon: PackagePlus, color: '#7c3aed', allowed: true },
      { key: 'supplier', label: 'Add Supplier', icon: Truck, color: '#d97706', allowed: true },
      { key: 'customer', label: 'Add Customer', icon: UserPlus, color: '#16a34a', allowed: true },
      { key: 'pay-supplier', label: 'Pay Supplier', icon: Wallet, color: '#9333ea', allowed: true },
    ],
    [],
  );

  return (
    <QuickActionTiles
      storageKey="inventory-quick-actions-usage"
      entries={entries}
      onSelect={(key) => router.push(`/${tenantSlug}/operations/inventory/${PATHS[key]}`)}
      className={className}
      fillCell={fillCell}
    />
  );
}
