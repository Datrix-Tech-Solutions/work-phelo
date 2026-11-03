'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { TableButton } from '@/components/atoms/TableButton';
import { ItemPanel } from '@/components/organisms/inventory/ItemPanel';
import { DeleteInventoryRecordModal } from '@/components/organisms/inventory/DeleteInventoryRecordModal';
import { useInventoryCategories } from '@/hooks/inventory/useInventoryCategories';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';
import { useInventoryUnits } from '@/hooks/inventory/useInventoryUnits';
import { useToast } from '@/hooks/useToast';
import { pageHeader, pageContent } from '@/lib/layout';
import {
  useInventoryItems,
  useDeleteInventoryItem,
  getItemValue,
  getStockStatus,
  type InventoryItem,
  type InventoryStockStatus,
} from '@/hooks/inventory/useInventoryItems';
import { extractError } from '@/lib/extractError';

const PAGE_SIZE = 10;

const STATUS_BADGE: Record<
  InventoryStockStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' }
> = {
  IN_STOCK: { label: 'In Stock', variant: 'success' },
  LOW_STOCK: { label: 'Low Stock', variant: 'warning' },
  OUT_OF_STOCK: { label: 'Out of Stock', variant: 'danger' },
};

const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });
const formatValue = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InventoryItemsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const toast = useToast();
  const { items, isLoading } = useInventoryItems();
  const { deleteItem } = useDeleteInventoryItem();
  const { categories } = useInventoryCategories();
  const { units } = useInventoryUnits();
  const { warehouses } = useInventoryWarehouses();

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';
  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? '—';

  const term = search.trim().toLowerCase();
  const filtered = items.filter(
    (i) =>
      (!categoryFilter || i.categoryId === categoryFilter) &&
      (!warehouseFilter || i.warehouseIds.includes(warehouseFilter)) &&
      (!statusFilter || getStockStatus(i) === statusFilter) &&
      (!term ||
        i.name.toLowerCase().includes(term) ||
        i.sku.toLowerCase().includes(term) ||
        categoryName(i.categoryId).toLowerCase().includes(term)),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<InventoryItem>[] = [
    {
      key: 'item',
      label: 'Item',
      width: 'minmax(180px, 2fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'sku',
      label: 'SKU',
      width: '120px',
      render: (row) => <span className="text-sm text-gray-600 font-mono">{row.sku}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      width: '140px',
      render: (row) => (
        <span className="text-sm text-gray-600">{categoryName(row.categoryId)}</span>
      ),
    },
    {
      key: 'unit',
      label: 'Unit',
      width: '70px',
      render: (row) => <span className="text-sm text-gray-600">{unitName(row.unitId)}</span>,
    },
    {
      key: 'currentStock',
      label: 'Current Stock',
      width: '130px',
      render: (row) => (
        <span className="text-sm text-gray-900">{formatNumber(row.currentStock)}</span>
      ),
    },
    {
      key: 'reorderLevel',
      label: 'Reorder Level',
      width: '130px',
      render: (row) => (
        <span className="text-sm text-gray-600">
          {row.reorderLevel === null ? '—' : formatNumber(row.reorderLevel)}
        </span>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      width: '130px',
      render: (row) => (
        <span className="text-sm text-gray-900">{formatValue(getItemValue(row))}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '80px',
      render: (row) => {
        const { label, variant } = STATUS_BADGE[getStockStatus(row)];
        return <Badge variant={variant} label={label} />;
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 'minmax(130px, auto)',
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteItem(deleteTarget.id);
    } catch (err) {
      toast.error(extractError(err, 'Could not deactivate item'));
      return;
    }
    toast.success('Item deactivated');
    setDeleteTarget(null);
  };

  return (
    <>
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
      </div>

      <div className={`${pageContent} flex flex-col`}>
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No inventory items found"
          searchPlaceholder="Search by item, SKU or category..."
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          extraFilters={
            <div className="flex items-center gap-2">
              <div className="w-44">
                <SearchSelect
                  placeholder="Category"
                  allLabel="All Categories"
                  showAllOption
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  value={categoryFilter}
                  onChange={(v) => {
                    setCategoryFilter(v);
                    setPage(1);
                  }}
                />
              </div>
              <div className="w-44">
                <SearchSelect
                  placeholder="Warehouse"
                  allLabel="All Warehouses"
                  showAllOption
                  options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                  value={warehouseFilter}
                  onChange={(v) => {
                    setWarehouseFilter(v);
                    setPage(1);
                  }}
                />
              </div>
              <div className="w-40">
                <SearchSelect
                  placeholder="Status"
                  allLabel="All Statuses"
                  showAllOption
                  clearable={false}
                  options={Object.entries(STATUS_BADGE).map(([value, { label }]) => ({
                    value,
                    label,
                  }))}
                  value={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          }
          actionButton={{ label: 'Add Item', onClick: () => setModalOpen(true) }}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          noInternalScroll
        />
      </div>

      <ItemPanel
        isOpen={modalOpen || !!editTarget}
        onClose={() => {
          setModalOpen(false);
          setEditTarget(null);
        }}
        item={editTarget}
      />
      <DeleteInventoryRecordModal
        kind="Item"
        name={deleteTarget?.name ?? null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
