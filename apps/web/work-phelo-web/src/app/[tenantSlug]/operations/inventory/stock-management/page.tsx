'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TypeChip, type TypeChipColor } from '@/components/atoms/TypeChip';
import { StockMovementTypeModal } from '@/components/organisms/inventory/StockMovementTypeModal';
import { StockMovementPanel } from '@/components/organisms/inventory/StockMovementPanel';
import { pageHeader, pageContent } from '@/lib/layout';
import { formatDate } from '@/lib/formatters';
import {
  useStockMovements,
  getMovementQuantity,
  getMovementValue,
  type StockMovement,
  type StockMovementStatus,
  type StockMovementType,
} from '@/hooks/inventory/useStockMovements';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';

const PAGE_SIZE = 10;

const TYPE_LABEL: Record<StockMovementType, string> = {
  STOCK_IN: 'Stock In',
  STOCK_OUT: 'Stock Out',
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Adjustment',
};

const TYPE_COLOR: Record<StockMovementType, TypeChipColor> = {
  STOCK_IN: 'green',
  STOCK_OUT: 'red',
  TRANSFER: 'blue',
  ADJUSTMENT: 'amber',
};

const STATUS_BADGE: Record<
  StockMovementStatus,
  { label: string; variant: 'success' | 'warning' | 'neutral' }
> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });
const formatValue = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StockManagementPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [movementType, setMovementType] = useState<StockMovementType | null>(null);
  const { movements, isLoading } = useStockMovements();
  const { items } = useInventoryItems();
  const { warehouses } = useInventoryWarehouses();

  const warehouseName = (id: string | null) =>
    id ? (warehouses.find((w) => w.id === id)?.name ?? '—') : null;

  // "3 items" for a multi-line movement; the item's own name for a single line.
  const itemsLabel = (m: StockMovement) => {
    if (m.lines.length === 1) {
      return items.find((i) => i.id === m.lines[0].itemId)?.name ?? '1 item';
    }
    return `${m.lines.length} items`;
  };

  const fromLabel = (m: StockMovement) => warehouseName(m.fromWarehouseId) ?? m.source ?? '—';
  const toLabel = (m: StockMovement) => warehouseName(m.toWarehouseId) ?? '—';

  const term = search.trim().toLowerCase();
  const filtered = movements.filter(
    (m) =>
      !term ||
      m.reference.toLowerCase().includes(term) ||
      TYPE_LABEL[m.type].toLowerCase().includes(term) ||
      itemsLabel(m).toLowerCase().includes(term),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<StockMovement>[] = [
    {
      key: 'reference',
      label: 'Reference',
      width: 'minmax(130px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900 font-mono">{row.reference}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      width: '120px',
      render: (row) => <span className="text-sm text-gray-600">{formatDate(row.date)}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      width: '120px',
      render: (row) => <TypeChip label={TYPE_LABEL[row.type]} color={TYPE_COLOR[row.type]} />,
    },
    {
      key: 'items',
      label: 'Items',
      width: 'minmax(140px, 1.5fr)',
      className: 'overflow-hidden min-w-0 pr-4',
      render: (row) => (
        <span className="text-sm text-gray-900 block truncate" title={itemsLabel(row)}>
          {itemsLabel(row)}
        </span>
      ),
    },
    {
      key: 'from',
      label: 'From',
      width: 'minmax(120px, 1fr)',
      render: (row) => <span className="text-sm text-gray-600">{fromLabel(row)}</span>,
    },
    {
      key: 'to',
      label: 'To',
      width: 'minmax(120px, 1fr)',
      render: (row) => <span className="text-sm text-gray-600">{toLabel(row)}</span>,
    },
    {
      key: 'quantity',
      label: 'QTY',
      width: '80px',
      render: (row) => (
        <span className="text-sm text-gray-900">{formatNumber(getMovementQuantity(row))}</span>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      width: '130px',
      render: (row) => (
        <span className="text-sm text-gray-900">{formatValue(getMovementValue(row))}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (row) => {
        const { label, variant } = STATUS_BADGE[row.status];
        return <Badge variant={variant} label={label} />;
      },
    },
  ];

  return (
    <>
      <div className={`${pageHeader} shrink-0`}>
        <h1 className="text-xl font-semibold text-gray-900">Stock Management</h1>
      </div>

      <div className={`${pageContent} flex flex-col`}>
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No stock movements found"
          searchPlaceholder="Search by reference, type or item..."
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          actionButton={{ label: 'Record Movement', onClick: () => setTypePickerOpen(true) }}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          noInternalScroll
        />
      </div>

      <StockMovementTypeModal
        isOpen={typePickerOpen}
        onClose={() => setTypePickerOpen(false)}
        onSelect={(t) => {
          setTypePickerOpen(false);
          setMovementType(t);
        }}
      />
      <StockMovementPanel
        type="STOCK_IN"
        isOpen={movementType === 'STOCK_IN'}
        onClose={() => setMovementType(null)}
      />
      <StockMovementPanel
        type="STOCK_OUT"
        isOpen={movementType === 'STOCK_OUT'}
        onClose={() => setMovementType(null)}
      />
      <StockMovementPanel
        type="TRANSFER"
        isOpen={movementType === 'TRANSFER'}
        onClose={() => setMovementType(null)}
      />
      <StockMovementPanel
        type="ADJUSTMENT"
        isOpen={movementType === 'ADJUSTMENT'}
        onClose={() => setMovementType(null)}
      />
    </>
  );
}
