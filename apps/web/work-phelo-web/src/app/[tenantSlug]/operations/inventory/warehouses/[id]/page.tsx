'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { TypeChip } from '@/components/atoms/TypeChip';
import { DeleteInventoryRecordModal } from '@/components/organisms/inventory/DeleteInventoryRecordModal';
import { WarehouseManagePanel } from '@/components/organisms/inventory/WarehouseManagePanel';
import { WarehouseStaffTable } from '@/components/organisms/inventory/WarehouseStaffTable';
import { WarehouseModal } from '@/components/organisms/inventory/WarehouseModal';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { WarehouseItemsTable } from '@/components/organisms/inventory/WarehouseItemsTable';
import { StockMovementsTable } from '@/components/organisms/inventory/StockMovementsTable';
import {
  LOCATION_TYPE_LABEL,
  useDeleteInventoryWarehouse,
  useInventoryWarehouses,
} from '@/hooks/inventory/useInventoryWarehouses';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';
import { useStockMovements } from '@/hooks/inventory/useStockMovements';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { pageContent, pageHeader } from '@/lib/layout';

export default function InventoryWarehouseDetailsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const base = `/${tenantSlug}/operations/inventory/warehouses`;

  const { warehouses, isLoading } = useInventoryWarehouses();
  const { items } = useInventoryItems();
  const { movements } = useStockMovements();

  const router = useRouter();
  const toast = useToast();
  const { deleteWarehouse } = useDeleteInventoryWarehouse();
  const [tab, setTab] = useState('movements');
  const [manageOpen, setManageOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteWarehouse(id);
    } catch (err) {
      toast.error(extractError(err, 'Could not delete warehouse'));
      return;
    }
    toast.success('Warehouse deleted successfully');
    router.push(base);
  };

  const warehouse = warehouses.find((w) => w.id === id);

  // Every movement that took stock out of, or put stock into, this warehouse.
  const warehouseMovements = useMemo(
    () => movements.filter((m) => m.fromWarehouseId === id || m.toWarehouseId === id),
    [movements, id],
  );
  const itemsHeld = items.filter((i) => i.warehouseIds.includes(id)).length;

  if (!isLoading && !warehouse) {
    return (
      <div className={`${pageHeader} flex flex-col gap-3 text-sm text-gray-500`}>
        <span>Warehouse not found.</span>
        <Link href={base} className="text-brand hover:underline w-fit">
          Back to warehouses
        </Link>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className={`${pageHeader} flex flex-col gap-6`}>
        <div className="h-5 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-24 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <div className={`${pageHeader} shrink-0 flex flex-col gap-3`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={base} className="hover:text-gray-700 transition-colors">
            Warehouses
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-700 font-medium">{warehouse.name}</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{warehouse.name}</h1>
          <div className="flex items-center gap-3">
            <Button size="xs" variant="outline" onClick={() => setManageOpen(true)}>
              Manage
            </Button>
            <Button size="xs" variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button size="xs" variant="danger" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className={`${pageContent} flex flex-col gap-6`}>
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
            <DetailField
              label="Type"
              value={LOCATION_TYPE_LABEL[warehouse.type] ?? warehouse.type}
            />
          </div>
        </CollapsibleOverview>

        <div className="flex flex-col gap-2">
          <TabBar
            tabs={[
              { key: 'movements', label: 'Stock Movements' },
              { key: 'items', label: 'Items' },
              { key: 'staff', label: 'Staff' },
            ]}
            activeTab={tab}
            onTabChange={setTab}
            className="px-0 [--tab-first-pl:0px]"
          />
          {tab === 'items' ? (
            <WarehouseItemsTable warehouseId={id} items={items} />
          ) : tab === 'staff' ? (
            <WarehouseStaffTable />
          ) : (
            <StockMovementsTable movements={warehouseMovements} typeFilter />
          )}
        </div>
      </div>

      <WarehouseManagePanel
        warehouse={manageOpen ? warehouse : null}
        onClose={() => setManageOpen(false)}
      />
      <WarehouseModal isOpen={editOpen} onClose={() => setEditOpen(false)} warehouse={warehouse} />
      <DeleteInventoryRecordModal
        kind="Warehouse"
        name={deleteOpen ? warehouse.name : null}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
