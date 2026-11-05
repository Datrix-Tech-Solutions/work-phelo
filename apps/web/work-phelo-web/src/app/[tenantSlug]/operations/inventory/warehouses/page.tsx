'use client';

import { pageContent, pageHeader } from '@/lib/layout';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TypeChip, type TypeChipColor } from '@/components/atoms/TypeChip';
import { TableButton } from '@/components/atoms/TableButton';
import {
  useInventoryWarehouses,
  useDeleteInventoryWarehouse,
  LOCATION_TYPE_LABEL,
  type InventoryLocationType,
  type InventoryWarehouse,
} from '@/hooks/inventory/useInventoryWarehouses';
import { WarehouseManagePanel } from '@/components/organisms/inventory/WarehouseManagePanel';
import { WarehouseModal } from '@/components/organisms/inventory/WarehouseModal';
import { DeleteInventoryRecordModal } from '@/components/organisms/inventory/DeleteInventoryRecordModal';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

const PAGE_SIZE = 10;

const LOCATION_TYPE_COLOR: Record<InventoryLocationType, TypeChipColor> = {
  WAREHOUSE: 'blue',
  STORE: 'green',
  BRANCH: 'purple',
  OFFICE_STORE: 'teal',
  OTHER: 'gray',
};

export default function InventoryWarehousesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryWarehouse | null>(null);
  const [manageTarget, setManageTarget] = useState<InventoryWarehouse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryWarehouse | null>(null);
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const toast = useToast();
  const { deleteWarehouse } = useDeleteInventoryWarehouse();

  const { warehouses, isLoading } = useInventoryWarehouses();

  const term = search.trim().toLowerCase();
  const filtered = warehouses.filter(
    (w) => !term || w.name.toLowerCase().includes(term) || w.code.toLowerCase().includes(term),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<InventoryWarehouse>[] = [
    {
      key: 'name',
      label: 'Location Name',
      width: 'minmax(160px, 1fr)',
      render: (row) => <span className="font-semibold text-gray-900">{row.name}</span>,
    },
    {
      key: 'code',
      label: 'Code',
      width: '110px',
      render: (row) => <span className="text-sm font-semibold text-gray-500">{row.code}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      width: 'minmax(140px, 1fr)',
      render: (row) => (
        <TypeChip
          label={LOCATION_TYPE_LABEL[row.type] ?? row.type}
          color={LOCATION_TYPE_COLOR[row.type] ?? 'gray'}
        />
      ),
    },
    {
      key: 'itemCount',
      label: 'No. of Items',
      width: '120px',
      render: (row) => <span className="text-sm font-bold text-gray-900">{row.itemCount}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (row) => (
        <Badge
          variant={row.status === 'ACTIVE' ? 'success' : 'neutral'}
          label={row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 'minmax(230px, auto)',
      render: (row) => (
        <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
          <TableButton variant="green" onClick={() => setManageTarget(row)}>
            Manage
          </TableButton>
          <TableButton variant="blue" onClick={() => setEditTarget(row)}>
            Edit
          </TableButton>
          <TableButton variant="red" onClick={() => setDeleteTarget(row)}>
            Delete
          </TableButton>
        </div>
      ),
    },
  ];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWarehouse(deleteTarget.id);
    } catch (err) {
      toast.error(extractError(err, 'Could not delete warehouse'));
      return;
    }
    toast.success('Warehouse deleted successfully');
    setDeleteTarget(null);
  };

  return (
    <>
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-semibold text-gray-900">Warehouses</h1>
      </div>

      <div className={`${pageContent} flex flex-col`}>
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No warehouses found"
          searchPlaceholder="Search warehouses..."
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          onRowClick={(row) =>
            router.push(`/${tenantSlug}/operations/inventory/warehouses/${row.id}`)
          }
          actionButton={{ label: 'Add Warehouse', onClick: () => setModalOpen(true) }}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          noInternalScroll
        />
      </div>

      <WarehouseManagePanel warehouse={manageTarget} onClose={() => setManageTarget(null)} />
      <WarehouseModal
        isOpen={modalOpen || !!editTarget}
        onClose={() => {
          setModalOpen(false);
          setEditTarget(null);
        }}
        warehouse={editTarget}
      />
      <DeleteInventoryRecordModal
        kind="Warehouse"
        name={deleteTarget?.name ?? null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
