'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import {
  useInventoryWarehouses,
  useDeleteInventoryWarehouse,
  type InventoryWarehouse,
} from '@/hooks/inventory/useInventoryWarehouses';
import { WarehouseModal } from '@/components/organisms/inventory/WarehouseModal';
import { DeleteInventoryRecordModal } from '@/components/organisms/inventory/DeleteInventoryRecordModal';
import { useToast } from '@/hooks/useToast';
import { formatMoney } from '@/lib/formatMoney';

const PAGE_SIZE = 10;

export default function InventoryWarehousesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryWarehouse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryWarehouse | null>(null);
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
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'code',
      label: 'Code',
      width: '110px',
      render: (row) => <span className="text-sm text-gray-600">{row.code}</span>,
    },
    {
      key: 'address',
      label: 'Address',
      width: 'minmax(200px, 2fr)',
      className: 'overflow-hidden min-w-0 pr-4',
      render: (row) => (
        <span className="text-sm text-gray-500 block truncate" title={row.address ?? undefined}>
          {row.address || <span className="text-gray-400 italic">No address</span>}
        </span>
      ),
    },
    {
      key: 'itemCount',
      label: 'No. of Items',
      width: '120px',
      render: (row) => <span className="text-sm text-gray-600">{row.itemCount}</span>,
    },
    {
      key: 'stockValue',
      label: 'Stock Value',
      width: '140px',
      render: (row) => <span className="text-sm text-gray-600">{formatMoney(row.stockValue)}</span>,
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
      width: 'minmax(160px, auto)',
      render: (row) => (
        <div className="flex items-center gap-3.5" onClick={(e) => e.stopPropagation()}>
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

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteWarehouse(deleteTarget.id);
    toast.success('Warehouse deleted successfully');
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Warehouses</h2>
      </div>

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
        actionButton={{ label: 'Add Warehouse', onClick: () => setModalOpen(true) }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

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
    </div>
  );
}
