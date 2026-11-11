'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Badge } from '@/components/atoms/Badge';
import { formatInventoryValue } from '@/lib/inventoryCurrency';
import { formatDate } from '@/lib/formatters';
import {
  PURCHASE_ORDER_STATUS_BADGE,
  purchaseOrderQuantity,
  purchaseOrderValue,
  canCancelOrder,
  canReceive,
  type PurchaseOrder,
} from '@/hooks/inventory/usePurchaseOrders';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';

const PAGE_SIZE = 10;

const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

interface PurchaseOrdersTableProps {
  purchaseOrders: PurchaseOrder[];
  isLoading?: boolean;
  onReceive?: (order: PurchaseOrder) => void;
  onCancel?: (order: PurchaseOrder) => void;
  /** The primary toolbar button, e.g. "New Purchase Order". */
  actionButton?: { label: string; onClick: () => void };
}

/** Searchable, paged table of purchase orders. */
export function PurchaseOrdersTable({
  purchaseOrders,
  isLoading,
  actionButton,
  onReceive,
  onCancel,
}: PurchaseOrdersTableProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusValue, setStatusValue] = useState('');
  const { items } = useInventoryItems();
  const { warehouses } = useInventoryWarehouses();

  const supplierName = (po: PurchaseOrder) => po.supplierName;
  const warehouseName = (po: PurchaseOrder) =>
    warehouses.find((w) => w.id === po.warehouseId)?.name ?? '—';
  // "3 items" for a multi-line order; the item's own name for a single line.
  const itemsLabel = (po: PurchaseOrder) =>
    po.lines.length === 1
      ? (items.find((i) => i.id === po.lines[0].itemId)?.name ?? '1 item')
      : `${po.lines.length} items`;

  const term = search.trim().toLowerCase();
  const filtered = purchaseOrders.filter(
    (po) =>
      (!statusValue || po.status === statusValue) &&
      (!term ||
        po.reference.toLowerCase().includes(term) ||
        supplierName(po).toLowerCase().includes(term) ||
        itemsLabel(po).toLowerCase().includes(term)),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'reference',
      label: 'Reference',
      width: 'minmax(130px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900 font-mono">{row.reference}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      width: '100px',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-500">{formatDate(row.date)}</span>
      ),
    },
    {
      key: 'supplier',
      label: 'Supplier',
      width: 'minmax(140px, 1.5fr)',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-900">{supplierName(row)}</span>
      ),
    },
    {
      key: 'items',
      label: 'Items',
      width: '140px',
      className: 'overflow-hidden min-w-0 pr-4',
      render: (row) => (
        <span
          className="text-sm font-semibold text-gray-900 block truncate"
          title={itemsLabel(row)}
        >
          {itemsLabel(row)}
        </span>
      ),
    },
    {
      key: 'warehouse',
      label: 'Warehouse',
      width: 'minmax(120px, 1fr)',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-500">{warehouseName(row)}</span>
      ),
    },
    {
      key: 'quantity',
      label: 'QTY',
      width: '80px',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-500">
          {formatNumber(purchaseOrderQuantity(row))}
        </span>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      width: '150px',
      className: 'text-right pr-4',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-600">
          {formatInventoryValue(purchaseOrderValue(row))}
        </span>
      ),
    },
    {
      key: 'amountPaid',
      label: 'Amount Paid',
      width: '150px',
      className: 'text-right pr-4',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-600">
          {formatInventoryValue(row.amountPaid)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (row) => {
        const { label, variant } = PURCHASE_ORDER_STATUS_BADGE[row.status];
        return <Badge variant={variant} label={label} />;
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage="No purchase orders found"
      searchPlaceholder="Search by reference, supplier or item..."
      searchValue={search}
      onSearch={(q) => {
        setSearch(q);
        setPage(1);
      }}
      extraFilters={
        <div className="w-48">
          <SearchSelect
            placeholder="Status"
            allLabel="All Statuses"
            showAllOption
            clearable={false}
            options={Object.entries(PURCHASE_ORDER_STATUS_BADGE).map(([value, { label }]) => ({
              value,
              label,
            }))}
            value={statusValue}
            onChange={(v) => {
              setStatusValue(v);
              setPage(1);
            }}
          />
        </div>
      }
      rowActions={(row) => [
        ...(canReceive(row) && onReceive
          ? [{ label: 'Receive Items', onClick: () => onReceive(row) }]
          : []),
        ...(canCancelOrder(row) && onCancel
          ? [{ label: 'Cancel Order', danger: true, onClick: () => onCancel(row) }]
          : []),
      ]}
      actionButton={actionButton}
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      noInternalScroll
    />
  );
}
