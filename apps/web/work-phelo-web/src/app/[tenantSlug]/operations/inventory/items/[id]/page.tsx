'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { Boxes, ChevronRight, Layers } from 'lucide-react';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { StockMovementsTable } from '@/components/organisms/inventory/StockMovementsTable';
import { useInventoryCategories } from '@/hooks/inventory/useInventoryCategories';
import {
  STOCK_STATUS_BADGE,
  getStockStatus,
  useInventoryItems,
} from '@/hooks/inventory/useInventoryItems';
import { useItemVariants, useVariantBalances } from '@/hooks/inventory/useItemVariants';
import { useInventoryUnits } from '@/hooks/inventory/useInventoryUnits';
import { useStockMovements } from '@/hooks/inventory/useStockMovements';
import { formatInventoryValue } from '@/lib/inventoryCurrency';
import { variantStock } from '@/lib/inventoryVariants';
import { compactCardGrid, pageContent, pageHeader } from '@/lib/layout';

const VARIANT_COLORS = ['#1baf7a', '#8b5cf6', '#f59e0b', '#ef4444', '#0ea5e9', '#ec4899'];

const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

export default function InventoryItemDetailsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const base = `/${tenantSlug}/operations/inventory/items`;

  const { items, isLoading } = useInventoryItems();
  const { categories } = useInventoryCategories();
  const { units } = useInventoryUnits();
  const { movements } = useStockMovements();

  const item = items.find((i) => i.id === id);
  const { variants } = useItemVariants();
  const { balances } = useVariantBalances();

  // Stock per variant comes from the movements that name one; whatever the item holds beyond
  // those is shown as "No variant", so the rows always add up to the item's total stock.
  const variantRows = useMemo(() => {
    const byVariant = variantStock(balances, id);
    const own = variants.filter((v) => v.itemId === id && v.status === 'ACTIVE').map((v) => v.name);
    const names = [...new Set([...own, ...byVariant.keys()])];
    const rows = names.map((name) => ({ name, stock: byVariant.get(name) ?? 0 }));
    const assigned = rows.reduce((n, r) => n + r.stock, 0);
    const rest = (item?.currentStock ?? 0) - assigned;
    return rows.length && rest !== 0 ? [...rows, { name: 'No variant', stock: rest }] : rows;
  }, [balances, variants, id, item?.currentStock]);

  // Movements that include this item, narrowed to its own lines so QTY and Value are the item's.
  const itemMovements = useMemo(
    () =>
      movements
        .filter((m) => m.lines.some((l) => l.itemId === id))
        .map((m) => ({ ...m, lines: m.lines.filter((l) => l.itemId === id) })),
    [movements, id],
  );

  if (!isLoading && !item) {
    return (
      <div className={`${pageHeader} flex flex-col gap-3 text-sm text-gray-500`}>
        <span>Item not found.</span>
        <Link href={base} className="text-brand hover:underline w-fit">
          Back to inventory
        </Link>
      </div>
    );
  }

  if (!item) {
    return (
      <div className={`${pageHeader} flex flex-col gap-6`}>
        <div className="h-5 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-24 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  const status = STOCK_STATUS_BADGE[getStockStatus(item)];

  return (
    <>
      <div className={`${pageHeader} shrink-0 flex flex-col gap-3`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={base} className="hover:text-gray-700 transition-colors">
            Inventory
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-700 font-medium">{item.name}</span>
        </nav>

        <div className="flex items-center gap-3">
          <Avatar name={item.name} avatarUrl={item.imageUrl} size="sm" />
          <h2 className="text-lg font-bold text-gray-900">{item.name}</h2>
        </div>
      </div>

      <div className={`${pageContent} flex flex-col gap-6`}>
        <CollapsibleOverview
          title="Overview"
          headerExtra={<Badge variant={status.variant} label={status.label} />}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
            <DetailField label="Item Name" value={item.name} />
            <DetailField label="SKU" value={item.sku} />
            <DetailField
              label="Category"
              value={categories.find((c) => c.id === item.categoryId)?.name ?? '—'}
            />
            <DetailField
              label="Unit"
              value={units.find((u) => u.id === item.unitId)?.name ?? '—'}
            />
            <DetailField label="Current Stock" value={formatNumber(item.currentStock)} />
            <DetailField
              label="Reorder Level"
              value={item.reorderLevel === null ? '—' : formatNumber(item.reorderLevel)}
            />
            <DetailField label="Warehouses Holding" value={item.warehouseIds.length} />
            <DetailField label="Movements" value={itemMovements.length} />
            <DetailField
              label="Cost Price"
              value={item.costPrice === null ? '—' : formatInventoryValue(item.costPrice)}
            />
            <DetailField
              label="Selling Price"
              value={item.sellingPrice === null ? '—' : formatInventoryValue(item.sellingPrice)}
            />
            <DetailField
              label="Stock Value"
              value={formatInventoryValue(item.currentStock * (item.costPrice ?? 0))}
            />
            <DetailField label="Description" value={item.description || '—'} />
          </div>
        </CollapsibleOverview>

        {variantRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold text-gray-900">Stock by Variant</h3>
            <div className={compactCardGrid}>
              <KpiCard
                label="Total Stock"
                value={formatNumber(item.currentStock)}
                icon={Boxes}
                iconColor="var(--module-inventory, #0047ab)"
              />
              {variantRows.map((r, i) => (
                <KpiCard
                  key={r.name}
                  label={r.name}
                  value={formatNumber(r.stock)}
                  icon={Layers}
                  iconColor={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold text-gray-900">Stock Movements</h3>
          <StockMovementsTable movements={itemMovements} typeFilter showVariant />
        </div>
      </div>
    </>
  );
}
