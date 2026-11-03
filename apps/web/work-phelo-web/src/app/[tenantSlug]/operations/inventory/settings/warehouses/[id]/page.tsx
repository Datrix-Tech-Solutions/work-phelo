'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { TypeChip } from '@/components/atoms/TypeChip';
import { StockMovementsTable } from '@/components/organisms/inventory/StockMovementsTable';
import {
  LOCATION_TYPE_LABEL,
  useInventoryWarehouses,
} from '@/hooks/inventory/useInventoryWarehouses';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';
import { useStockMovements } from '@/hooks/inventory/useStockMovements';

export default function InventoryWarehouseDetailsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const base = `/${tenantSlug}/operations/inventory/settings/warehouses`;

  const { warehouses, isLoading } = useInventoryWarehouses();
  const { items } = useInventoryItems();
  const { movements } = useStockMovements();

  const warehouse = warehouses.find((w) => w.id === id);

  // Every movement that took stock out of, or put stock into, this warehouse.
  const warehouseMovements = useMemo(
    () => movements.filter((m) => m.fromWarehouseId === id || m.toWarehouseId === id),
    [movements, id],
  );
  const itemsHeld = items.filter((i) => i.warehouseIds.includes(id)).length;

  if (!isLoading && !warehouse) {
    return (
      <div className="flex flex-col gap-3 text-sm text-gray-500">
        <span>Warehouse not found.</span>
        <Link href={base} className="text-brand hover:underline w-fit">
          Back to warehouses
        </Link>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-5 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-24 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Warehouses
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium">{warehouse.name}</span>
      </nav>

      <h2 className="text-lg font-bold text-gray-900">{warehouse.name}</h2>

      <CollapsibleOverview
        title="Overview"
        headerExtra={
          <TypeChip
            label={warehouse.status === 'ACTIVE' ? 'Active' : 'Inactive'}
            color={warehouse.status === 'ACTIVE' ? 'green' : 'gray'}
          />
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
          <DetailField label="Warehouse Name" value={warehouse.name} />
          <DetailField label="Code" value={warehouse.code} />
          <DetailField label="Items Held" value={itemsHeld} />
          <DetailField label="Movements" value={warehouseMovements.length} />
          <DetailField label="Type" value={LOCATION_TYPE_LABEL[warehouse.type] ?? warehouse.type} />
        </div>
      </CollapsibleOverview>

      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-gray-900">Stock Movements</h3>
        <StockMovementsTable movements={warehouseMovements} />
      </div>
    </div>
  );
}
