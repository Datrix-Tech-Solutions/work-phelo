'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import {
  useInventoryUnits,
  useDeleteInventoryUnit,
  type InventoryUnit,
} from '@/hooks/inventory/useInventoryUnits';
import { UnitModal } from '@/components/organisms/inventory/UnitModal';
import { DeleteInventoryRecordModal } from '@/components/organisms/inventory/DeleteInventoryRecordModal';
import { useToast } from '@/hooks/useToast';
import { formatDate } from '@/lib/formatters';

const PAGE_SIZE = 10;

export default function InventoryUnitsOfMeasurePage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryUnit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryUnit | null>(null);
  const toast = useToast();
  const { deleteUnit } = useDeleteInventoryUnit();

  const { units, isLoading } = useInventoryUnits();

  const term = search.trim().toLowerCase();
  const filtered = units.filter(
    (u) => !term || u.name.toLowerCase().includes(term) || u.symbol.toLowerCase().includes(term),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<InventoryUnit>[] = [
    {
      key: 'name',
      label: 'Unit Name',
      width: 'minmax(160px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'description',
      label: 'Description',
      width: 'minmax(200px, 2fr)',
      className: 'overflow-hidden min-w-0 pr-4',
      render: (row) => (
        <span className="text-sm text-gray-500 block truncate" title={row.description ?? undefined}>
          {row.description || <span className="text-gray-400 italic">No description</span>}
        </span>
      ),
    },
    {
      key: 'symbol',
      label: 'Symbol',
      width: '100px',
      render: (row) => <span className="text-sm text-gray-600">{row.symbol}</span>,
    },
    {
      key: 'createdAt',
      label: 'Date Created',
      width: '140px',
      render: (row) => <span className="text-sm text-gray-600">{formatDate(row.createdAt)}</span>,
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
    deleteUnit(deleteTarget.id);
    toast.success('Unit of measure deleted successfully');
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Units of Measure</h2>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage="No units of measure found"
        searchPlaceholder="Search units..."
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'Add Unit', onClick: () => setModalOpen(true) }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <UnitModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      <UnitModal isOpen={!!editTarget} onClose={() => setEditTarget(null)} unit={editTarget} />
      <DeleteInventoryRecordModal
        kind="Unit of measure"
        name={deleteTarget?.name ?? null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
