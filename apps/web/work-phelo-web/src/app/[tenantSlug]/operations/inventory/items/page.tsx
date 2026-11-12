'use client';

import { Suspense, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { EditItemValueModal } from '@/components/organisms/inventory/EditItemValueModal';
import { EditReorderLevelModal } from '@/components/organisms/inventory/EditReorderLevelModal';
import { ItemPanel } from '@/components/organisms/inventory/ItemPanel';
import { ItemImportDialog } from '@/components/organisms/inventory/ItemImportDialog';
import { DeleteInventoryRecordModal } from '@/components/organisms/inventory/DeleteInventoryRecordModal';
import { useInventoryCategories } from '@/hooks/inventory/useInventoryCategories';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';
import { useStockPositions } from '@/hooks/inventory/useStockBalances';
import { useInventoryUnits } from '@/hooks/inventory/useInventoryUnits';
import { useToast } from '@/hooks/useToast';
import { formatInventoryValue } from '@/lib/inventoryCurrency';
import { pageHeader, pageContent } from '@/lib/layout';
import {
  useInventoryItems,
  useDeleteInventoryItem,
  getStockStatus,
  STOCK_STATUS_BADGE,
  type InventoryItem,
} from '@/hooks/inventory/useInventoryItems';
import { extractError } from '@/lib/extractError';

const PAGE_SIZE = 10;

const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

function InventoryItemsInner() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // The dashboard's "Add Item" shortcut arrives with ?new=1.
  const [modalOpen, setModalOpen] = useState(useSearchParams().get('new') === '1');
  const [importOpen, setImportOpen] = useState(false);

  const [valueTarget, setValueTarget] = useState<InventoryItem | null>(null);
  const [reorderTarget, setReorderTarget] = useState<InventoryItem | null>(null);
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const toast = useToast();
  const { items, isLoading } = useInventoryItems();
  const { deleteItem } = useDeleteInventoryItem();
  const { categories } = useInventoryCategories();
  const { units } = useInventoryUnits();
  const { warehouses } = useInventoryWarehouses();
  const { positions } = useStockPositions();

  // With a warehouse selected, stock and value are that warehouse's; the status below still
  // judges the item's total, because a reorder level is set per item, not per warehouse.
  const shownStock = (i: InventoryItem) =>
    warehouseFilter ? (positions.get(i.id)?.get(warehouseFilter) ?? 0) : i.currentStock;

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
      render: (row) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={row.name} avatarUrl={row.imageUrl} size="sm" />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="font-bold text-gray-900 truncate">{row.name}</span>
            <span className="text-xs font-bold text-gray-500 truncate">
              {categoryName(row.categoryId)}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'sku',
      label: 'SKU',
      width: '120px',
      render: (row) => <span className="text-sm text-gray-600 font-mono">{row.sku}</span>,
    },
    {
      key: 'unit',
      label: 'Unit',
      width: '70px',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-600">{unitName(row.unitId)}</span>
      ),
    },
    {
      key: 'currentStock',
      label: 'Current Stock',
      width: '100px',
      render: (row) => (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-gray-900">{formatNumber(shownStock(row))}</span>
          {/* {warehouseFilter && (
            <span className="text-xs text-gray-500">of {formatNumber(row.currentStock)}</span>
          )} */}
        </div>
      ),
    },
    {
      key: 'reorderLevel',
      label: 'Reorder Level',
      width: '100px',
      render: (row) => (
        <span className="text-sm font-extrabold text-gray-600">
          {row.reorderLevel === null ? '—' : formatNumber(row.reorderLevel)}
        </span>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      width: '150px',
      className: 'text-right pr-4',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-900">
          {formatInventoryValue(shownStock(row) * (row.costPrice ?? 0))}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '100px',
      render: (row) => {
        const { label, variant } = STOCK_STATUS_BADGE[getStockStatus(row)];
        return <Badge variant={variant} label={label} />;
      },
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
          rowActions={(row) => [
            { label: 'Edit', onClick: () => setEditTarget(row) },
            { label: 'Edit Value', onClick: () => setValueTarget(row) },
            { label: 'Edit Reorder Level', onClick: () => setReorderTarget(row) },
            { label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) },
          ]}
          data={rows}
          onRowClick={(row) => router.push(`/${tenantSlug}/operations/inventory/items/${row.id}`)}
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
                  options={Object.entries(STOCK_STATUS_BADGE).map(([value, { label }]) => ({
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
          secondaryButtons={[{ label: 'Import', onClick: () => setImportOpen(true) }]}
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
      <ItemImportDialog isOpen={importOpen} onClose={() => setImportOpen(false)} />
      <EditItemValueModal
        key={`value-${valueTarget?.id ?? 'none'}`}
        item={valueTarget}
        onClose={() => setValueTarget(null)}
      />
      <EditReorderLevelModal
        key={`reorder-${reorderTarget?.id ?? 'none'}`}
        item={reorderTarget}
        onClose={() => setReorderTarget(null)}
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

export default function InventoryItemsPage() {
  return (
    <Suspense>
      <InventoryItemsInner />
    </Suspense>
  );
}
