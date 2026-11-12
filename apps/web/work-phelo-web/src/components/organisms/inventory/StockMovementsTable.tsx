'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Badge } from '@/components/atoms/Badge';
import { TypeChip } from '@/components/atoms/TypeChip';
import {
  MOVEMENT_STATUS_BADGE,
  MOVEMENT_TYPE_COLOR,
  MOVEMENT_TYPE_LABEL,
} from '@/lib/inventoryMovement';
import { formatInventoryValue } from '@/lib/inventoryCurrency';
import { formatDate } from '@/lib/formatters';
import {
  getMovementQuantity,
  getMovementValue,
  type StockMovement,
} from '@/hooks/inventory/useStockMovements';
import {
  canCancel,
  canDelete,
  canReverse,
  useMovementActions,
} from '@/hooks/inventory/useMovementActions';
import { useMovementReview } from '@/hooks/inventory/useMovementReview';
import { useUserNames } from '@/hooks/inventory/useUserNames';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';

const PAGE_SIZE = 10;

const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

interface StockMovementsTableProps {
  movements: StockMovement[];
  isLoading?: boolean;
  /** The primary toolbar button, e.g. "Record Movement". */
  actionButton?: { label: string; onClick: () => void };
  /** Opens a draft row; drafts have no details page. */
  onDraftClick?: (id: string) => void;
  /** Show a filter for the movement type. */
  typeFilter?: boolean;
  /** Show a Variant column and filter: for the history of one item. */
  showVariant?: boolean;
}

/** Searchable, paged table of stock movements — shared by Stock Management and warehouse details. */
export function StockMovementsTable({
  movements,
  isLoading,
  actionButton,
  onDraftClick,
  typeFilter,
  showVariant,
}: StockMovementsTableProps) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const {
    exportMovement,
    requestReverse,
    requestDelete,
    requestCancel,
    requestDeleteDraft,
    modals,
  } = useMovementActions();
  const { canReview, approve, requestReject, modals: reviewModals } = useMovementReview();
  const userName = useUserNames();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typeValue, setTypeValue] = useState('');
  const [variantValue, setVariantValue] = useState('');
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
  // A stock out goes to a customer rather than a warehouse; the service keeps the name as the recipient.
  const toLabel = (m: StockMovement) =>
    warehouseName(m.toWarehouseId) ?? (m.type === 'STOCK_OUT' ? m.source : null) ?? '—';

  const term = search.trim().toLowerCase();
  // With a variant chosen, each movement keeps only that variant's lines, so the Variant, QTY and
  // Value columns describe that variant alone.
  const scoped = variantValue
    ? movements
        .map((m) => ({ ...m, lines: m.lines.filter((l) => l.variant === variantValue) }))
        .filter((m) => m.lines.length > 0)
    : movements;
  const filtered = scoped.filter(
    (m) =>
      (!typeValue || m.type === typeValue) &&
      (!term ||
        m.reference.toLowerCase().includes(term) ||
        MOVEMENT_TYPE_LABEL[m.type].toLowerCase().includes(term) ||
        itemsLabel(m).toLowerCase().includes(term)),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // The variants named on these movements, for the filter.
  const variantNames = [
    ...new Set(movements.flatMap((m) => m.lines.map((l) => l.variant).filter(Boolean) as string[])),
  ];
  const variantsLabel = (m: StockMovement) =>
    [...new Set(m.lines.map((l) => l.variant).filter(Boolean))].join(', ');

  const hasOut = movements.some((m) => m.type === 'STOCK_OUT');
  const hasOther = movements.some((m) => m.type !== 'STOCK_OUT');
  const recordedByLabel =
    hasOut && hasOther ? 'Recorded / Issued By' : hasOut ? 'Issued By' : 'Recorded By';

  const columns: Column<StockMovement>[] = [
    {
      key: 'reference',
      label: 'Reference',
      width: '120px',
      render: (row) => <span className="font-medium text-gray-900 font-mono">{row.reference}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      width: '90px',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-500">{formatDate(row.date)}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: '100px',
      render: (row) => (
        <TypeChip label={MOVEMENT_TYPE_LABEL[row.type]} color={MOVEMENT_TYPE_COLOR[row.type]} />
      ),
    },
    {
      key: 'items',
      label: 'Items',
      width: '90px',
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
    ...(showVariant
      ? [
          {
            key: 'variant',
            label: 'Variant',
            width: 'minmax(100px, 1fr)',
            render: (row: StockMovement) => (
              <span className="text-sm font-semibold text-gray-600 block truncate">
                {variantsLabel(row) || '—'}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'from',
      label: 'From',
      width: 'minmax(120px, 1fr)',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-500">{fromLabel(row)}</span>
      ),
    },
    {
      key: 'to',
      label: 'To',
      width: 'minmax(120px, 1fr)',
      render: (row) => <span className="text-sm font-semibold text-gray-500">{toLabel(row)}</span>,
    },
    {
      key: 'quantity',
      label: 'QTY',
      width: '70px',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-500">
          {formatNumber(getMovementQuantity(row))}
        </span>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      width: '120px',
      className: 'text-right pr-4',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-600">
          {formatInventoryValue(getMovementValue(row))}
        </span>
      ),
    },
    {
      key: 'recordedBy',
      // Stock is issued out and recorded in; a table with both says so.
      label: recordedByLabel,
      width: 'minmax(110px, 1fr)',
      className: 'overflow-hidden min-w-0 pr-4',
      render: (row) => (
        <span className="text-sm font-semibold text-gray-500 block truncate">
          {row.status === 'DRAFT' ? '—' : userName(row.createdBy)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (row) => {
        const { label, variant } = MOVEMENT_STATUS_BADGE[row.status];
        return <Badge variant={variant} label={label} />;
      },
    },
  ];

  return (
    <>
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
        extraFilters={
          typeFilter || (showVariant && variantNames.length > 0) ? (
            <div className="flex items-center gap-2">
              {typeFilter && (
                <div className="w-44">
                  <SearchSelect
                    placeholder="Type"
                    allLabel="All Types"
                    showAllOption
                    clearable={false}
                    options={Object.entries(MOVEMENT_TYPE_LABEL).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    value={typeValue}
                    onChange={(v) => {
                      setTypeValue(v);
                      setPage(1);
                    }}
                  />
                </div>
              )}
              {showVariant && variantNames.length > 0 && (
                <div className="w-44">
                  <SearchSelect
                    placeholder="Variant"
                    allLabel="All Variants"
                    showAllOption
                    clearable={false}
                    options={variantNames.map((v) => ({ value: v, label: v }))}
                    value={variantValue}
                    onChange={(v) => {
                      setVariantValue(v);
                      setPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          ) : undefined
        }
        rowActions={(row) =>
          row.status === 'DRAFT'
            ? [
                { label: 'Edit', onClick: () => onDraftClick?.(row.id) },
                { label: 'Export', onClick: () => exportMovement(row) },
                { label: 'Delete', danger: true, onClick: () => requestDeleteDraft(row) },
              ]
            : [
                ...(canReview(row)
                  ? [
                      { label: 'Approve', onClick: () => approve(row) },
                      { label: 'Reject', danger: true, onClick: () => requestReject(row) },
                    ]
                  : []),
                ...(canReverse(row)
                  ? [
                      {
                        label: 'Reverse Transaction',
                        danger: true,
                        onClick: () => requestReverse(row),
                      },
                    ]
                  : []),
                { label: 'Export', onClick: () => exportMovement(row) },
                ...(canCancel(row)
                  ? [{ label: 'Cancel Movement', danger: true, onClick: () => requestCancel(row) }]
                  : []),
                ...(canDelete(row)
                  ? [{ label: 'Delete', danger: true, onClick: () => requestDelete(row) }]
                  : []),
              ]
        }
        onRowClick={(row) =>
          row.status === 'DRAFT'
            ? onDraftClick?.(row.id)
            : router.push(`/${tenantSlug}/operations/inventory/stock-management/${row.id}`)
        }
        actionButton={actionButton}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />
      {modals}
      {reviewModals}
    </>
  );
}
