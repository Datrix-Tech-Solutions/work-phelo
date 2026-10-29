'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import {
  useInventoryCategories,
  useDeleteInventoryCategory,
  type InventoryCategory,
} from '@/hooks/inventory/useInventoryCategories';
import { CategoryModal } from '@/components/organisms/inventory/CategoryModal';
import { DeleteInventoryRecordModal } from '@/components/organisms/inventory/DeleteInventoryRecordModal';
import { useToast } from '@/hooks/useToast';
import { CategoryIconBadge } from '@/lib/inventoryCategoryIcons';
import { formatDate } from '@/lib/formatters';

const PAGE_SIZE = 10;

export default function InventoryCategoriesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryCategory | null>(null);
  const toast = useToast();
  const { deleteCategory } = useDeleteInventoryCategory();

  const { categories, isLoading } = useInventoryCategories();

  const term = search.trim().toLowerCase();
  const filtered = categories.filter((c) => !term || c.name.toLowerCase().includes(term));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<InventoryCategory>[] = [
    {
      key: 'name',
      label: 'Category Name',
      width: 'minmax(160px, 1fr)',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <CategoryIconBadge icon={row.icon} name={row.name} />
          <span className="font-medium text-gray-900">{row.name}</span>
        </div>
      ),
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
      key: 'itemCount',
      label: 'No. of Items',
      width: '120px',
      render: (row) => <span className="text-sm text-gray-600">{row.itemCount}</span>,
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
    deleteCategory(deleteTarget.id);
    toast.success('Category deleted successfully');
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Categories</h2>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage="No categories found"
        searchPlaceholder="Search categories..."
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'Add Category', onClick: () => setModalOpen(true) }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <CategoryModal
        isOpen={modalOpen || !!editTarget}
        onClose={() => {
          setModalOpen(false);
          setEditTarget(null);
        }}
        category={editTarget}
      />
      <DeleteInventoryRecordModal
        kind="Category"
        name={deleteTarget?.name ?? null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
