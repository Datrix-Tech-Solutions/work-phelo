'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { useInventoryCategories } from '@/hooks/inventory/useInventoryCategories';
import {
  STOCK_STATUS_BADGE,
  getStockStatus,
  type InventoryItem,
} from '@/hooks/inventory/useInventoryItems';
import { useInventoryUnits } from '@/hooks/inventory/useInventoryUnits';
import { useStockPositions } from '@/hooks/inventory/useStockBalances';
import { formatInventoryValue } from '@/lib/inventoryCurrency';

const PAGE_SIZE = 10;

const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

interface WarehouseItemsTableProps {
  warehouseId: string;
  /** All inventory items; the table keeps those with stock in this warehouse. */
  items: InventoryItem[];
}

/** Items held in one warehouse, with the quantity and value held there. */
export function WarehouseItemsTable({ warehouseId, items }: WarehouseItemsTableProps) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { categories } = useInventoryCategories();
  const { units } = useInventoryUnits();
  const { positions, isLoading } = useStockPositions();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const stockHere = (i: InventoryItem) => positions.get(i.id)?.get(warehouseId) ?? 0;
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—';
  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? '—';

  const term = search.trim().toLowerCase();
  const filtered = items.filter(
    (i) =>
      stockHere(i) > 0 &&
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
      key: 'stock',
      label: 'Stock Here',
      width: '110px',
      render: (row) => (
        <span className="text-sm font-bold text-gray-900">{formatNumber(stockHere(row))}</span>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      width: '150px',
      className: 'text-right pr-4',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-900">
          {formatInventoryValue(stockHere(row) * (row.costPrice ?? 0))}
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

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage="No items held in this warehouse"
      searchPlaceholder="Search by item, SKU or category..."
      searchValue={search}
      onSearch={(q) => {
        setSearch(q);
        setPage(1);
      }}
      onRowClick={(row) => router.push(`/${tenantSlug}/operations/inventory/items/${row.id}`)}
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      noInternalScroll
    />
  );
}
