'use client';

import { InventoryBreadcrumb } from '@/components/molecules/inventory/InventoryBreadcrumb';
import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { TypeChip } from '@/components/atoms/TypeChip';
import { DataList, Column } from '@/components/organisms/shared/DataList';
import { formatDate } from '@/lib/formatters';
import { formatInventoryValue } from '@/lib/inventoryCurrency';
import {
  ADJUSTMENT_REASONS,
  MOVEMENT_STATUS_BADGE,
  MOVEMENT_TYPE_COLOR,
  MOVEMENT_TYPE_LABEL,
  STOCK_OUT_PURPOSES,
  optionLabel,
} from '@/lib/inventoryMovement';
import { pageContent, pageHeader } from '@/lib/layout';
import {
  getMovementQuantity,
  type StockMovement,
  getMovementValue,
  useStockMovements,
  type StockMovementLine,
} from '@/hooks/inventory/useStockMovements';
import {
  canCancel,
  canDelete,
  canReverse,
  useMovementActions,
} from '@/hooks/inventory/useMovementActions';
import { Button } from '@/components/atoms/Button';
import { useMovementReview } from '@/hooks/inventory/useMovementReview';
import { useUserNames } from '@/hooks/inventory/useUserNames';
import { useInventoryCategories } from '@/hooks/inventory/useInventoryCategories';
import { useAdjustmentReasons } from '@/hooks/inventory/useAdjustmentReasons';
import { useInventoryItems } from '@/hooks/inventory/useInventoryItems';
import { useInventoryUnits } from '@/hooks/inventory/useInventoryUnits';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';

type LineRow = StockMovementLine & {
  id: string;
  /** Stock on hand for the item before / after this movement, across all warehouses. */
  before: number;
  after: number;
  /** Signed change to the item's total: a transfer moves stock but nets to zero. */
  change: number;
};

/** How a line changes the item's total stock. */
function lineChange(m: StockMovement, line: StockMovementLine): number {
  // A price adjustment, stock put back, or a movement not approved yet: stock is unchanged.
  if (m.kind || m.status === 'CANCELLED' || m.status === 'PENDING' || m.status === 'REJECTED')
    return 0;
  if (m.type === 'STOCK_IN') return line.quantity;
  if (m.type === 'STOCK_OUT') return -line.quantity;
  if (m.type === 'ADJUSTMENT') return line.quantity; // already signed
  return 0;
}

const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

export default function StockMovementDetailsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const base = `/${tenantSlug}/operations/inventory/stock-management`;

  const { movements, isLoading } = useStockMovements();
  const { items } = useInventoryItems();
  const { units } = useInventoryUnits();
  const { categories } = useInventoryCategories();
  const { warehouses } = useInventoryWarehouses();

  const router = useRouter();
  const { reasons } = useAdjustmentReasons();
  const { exportMovement, requestReverse, requestDelete, requestCancel, modals } =
    useMovementActions({
      onDeleted: () => router.push(base),
    });

  const movement = movements.find((m) => m.id === id);
  const userName = useUserNames();
  const review = useMovementReview();

  const warehouseName = (wid: string | null) =>
    wid ? (warehouses.find((w) => w.id === wid)?.name ?? '—') : null;
  const itemOf = (itemId: string) => items.find((i) => i.id === itemId);
  const unitOf = (itemId: string) => {
    const unitId = itemOf(itemId)?.unitId;
    const unit = units.find((u) => u.id === unitId);
    return unit ? unit.symbol || unit.name : '—';
  };

  if (!isLoading && !movement) {
    return (
      <div className={`${pageHeader} flex flex-col gap-3 text-sm text-gray-500`}>
        <span>Stock movement not found.</span>
        <Link href={base} className="text-brand hover:underline w-fit">
          Back to stock management
        </Link>
      </div>
    );
  }

  if (!movement) {
    return (
      <div className={`${pageHeader} flex flex-col gap-6`}>
        <div className="h-5 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-24 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  const status = MOVEMENT_STATUS_BADGE[movement.status];
  const partyLabel = movement.type === 'STOCK_IN' ? 'Supplier' : 'Customer';

  // Stock before/after is a running total per item, built from the full history (oldest first;
  // the service returns newest first).
  const lineRows: LineRow[] = (() => {
    const running = new Map<string, number>();
    const byMovement = new Map<string, LineRow[]>();
    for (const m of [...movements].reverse()) {
      const rows = m.lines.map((l, i) => {
        const before = running.get(l.itemId) ?? 0;
        const change = lineChange(m, l);
        running.set(l.itemId, before + change);
        return { ...l, id: `${m.id}-${i}`, before, after: before + change, change };
      });
      byMovement.set(m.id, rows);
    }
    return byMovement.get(id) ?? [];
  })();

  const columns: Column<LineRow>[] = [
    {
      key: 'item',
      label: 'Item Name',
      width: '1fr',
      render: (row) => {
        const item = itemOf(row.itemId);
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={item?.name ?? '—'} avatarUrl={item?.imageUrl} size="sm" />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="font-medium text-gray-900 truncate">{item?.name ?? '—'}</span>
              <span className="text-xs text-gray-500 truncate">
                {categories.find((c) => c.id === item?.categoryId)?.name ?? '—'}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'variant',
      label: 'Variant',
      width: '120px',
      render: (row) => (
        <span className={row.variant ? 'font-medium text-gray-900' : 'text-gray-400'}>
          {row.variant || '—'}
        </span>
      ),
    },
    {
      key: 'unit',
      label: 'Unit',
      width: '80px',
      render: (row) => <span className="text-gray-600">{unitOf(row.itemId)}</span>,
    },
    {
      key: 'before',
      label: 'Before QTY',
      width: '110px',
      className: 'text-right',
      render: (row) => <span className="text-gray-900">{formatNumber(row.before)}</span>,
    },
    {
      key: 'movement',
      label: 'Movement',
      width: '110px',
      className: 'text-right',
      render: (row) => {
        // A transfer shows the quantity moved, unsigned: it leaves the item's total unchanged.
        const transfer = movement.type === 'TRANSFER';
        const shown = transfer ? row.quantity : row.change;
        return (
          <span
            className={cn(
              'font-medium',
              transfer ? 'text-gray-600' : row.change < 0 ? 'text-red-600' : 'text-green-600',
            )}
          >
            {!transfer && shown > 0 ? '+' : ''}
            {formatNumber(shown)}
          </span>
        );
      },
    },
    {
      key: 'after',
      label: 'After QTY',
      width: '110px',
      className: 'text-right',
      render: (row) => <span className="font-medium text-gray-900">{formatNumber(row.after)}</span>,
    },
    {
      key: 'unitCost',
      label: 'Unit Cost',
      width: '140px',
      className: 'text-right',
      render: (row) => (
        <span className="text-gray-900">
          {row.unitCost === null ? '—' : formatInventoryValue(row.unitCost)}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total Value',
      width: '150px',
      className: 'text-right',
      render: (row) => (
        <span className="font-semibold text-gray-900">
          {formatInventoryValue(row.quantity * (row.unitCost ?? 0))}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className={`${pageHeader} shrink-0 flex flex-col gap-3`}>
        <InventoryBreadcrumb
          root={{ label: 'Stock Management', href: base }}
          current={movement.reference}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{movement.reference}</h1>
          <div className="flex items-center gap-3">
            {review.canReview(movement) && (
              <>
                <Button
                  size="xs"
                  onClick={() => review.approve(movement)}
                  isLoading={review.isApproving}
                  loadingText="Approving..."
                >
                  Approve
                </Button>
                <Button size="xs" variant="outline" onClick={() => review.requestReject(movement)}>
                  Reject
                </Button>
              </>
            )}
            {canReverse(movement) && (
              <Button size="xs" variant="danger" onClick={() => requestReverse(movement)}>
                Reverse Transaction
              </Button>
            )}
            <Button size="xs" variant="outline" onClick={() => exportMovement(movement)}>
              Export
            </Button>
            {canCancel(movement) && (
              <Button size="xs" variant="outline" onClick={() => requestCancel(movement)}>
                Cancel Movement
              </Button>
            )}
            {canDelete(movement) && (
              <Button size="xs" variant="danger" onClick={() => requestDelete(movement)}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className={`${pageContent} flex flex-col gap-6`}>
        <CollapsibleOverview
          title="Overview"
          headerExtra={<Badge variant={status.variant} label={status.label} />}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
            <DetailField label="Reference" value={movement.reference} />
            <DetailField label="Date" value={formatDate(movement.date)} />
            <DetailField
              label="Type"
              value={
                <TypeChip
                  label={MOVEMENT_TYPE_LABEL[movement.type]}
                  color={MOVEMENT_TYPE_COLOR[movement.type]}
                />
              }
            />
            <DetailField label="Items" value={movement.lines.length} />
            <DetailField
              label="From"
              value={warehouseName(movement.fromWarehouseId) ?? movement.source ?? '—'}
            />
            <DetailField label="To" value={warehouseName(movement.toWarehouseId) ?? '—'} />
            {movement.type !== 'TRANSFER' &&
              movement.type !== 'ADJUSTMENT' &&
              movement.fromWarehouseId !== null &&
              movement.source && <DetailField label={partyLabel} value={movement.source} />}
            {movement.type === 'STOCK_OUT' && (
              <DetailField
                label="Purpose"
                value={optionLabel(STOCK_OUT_PURPOSES, movement.purpose) ?? '—'}
              />
            )}
            {movement.type === 'ADJUSTMENT' && (
              <DetailField
                label="Reason"
                value={
                  reasons.find((r) => r.code === movement.reason)?.name ??
                  optionLabel(ADJUSTMENT_REASONS, movement.reason) ??
                  movement.reason ??
                  '—'
                }
              />
            )}
            <DetailField
              label="Total Quantity"
              value={formatNumber(getMovementQuantity(movement))}
            />
            <DetailField
              label="Total Value"
              value={formatInventoryValue(getMovementValue(movement))}
            />
            <DetailField
              label="Created By"
              value={movement.status === 'DRAFT' ? '—' : userName(movement.createdBy)}
            />
            {movement.status === 'REJECTED' ? (
              <>
                <DetailField label="Rejected By" value={userName(movement.rejectedBy)} />
                <DetailField label="Reason" value={movement.rejectionReason || '—'} />
              </>
            ) : (
              <DetailField
                label="Approved By"
                value={
                  movement.status === 'PENDING' || movement.status === 'DRAFT'
                    ? 'Awaiting approval'
                    : userName(movement.approvedBy)
                }
              />
            )}
            <DetailField label="Notes" value={movement.notes || '—'} />
          </div>
        </CollapsibleOverview>

        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-gray-900">Items</h2>
          {/* DataList has no header row, so one is drawn here on the same column widths. */}
          <div className="p-1 -mb-1">
            <div className="flex items-center gap-x-4 px-4 text-xs font-bold uppercase tracking-wide text-gray-500">
              {columns.map((col) => {
                const flexible = (col.width ?? '1fr').endsWith('fr');
                return (
                  <div
                    key={col.key}
                    className={cn(flexible ? 'flex-1 min-w-0' : 'shrink-0', col.className)}
                    style={flexible ? undefined : { width: col.width }}
                  >
                    {col.label}
                  </div>
                );
              })}
            </div>
          </div>
          <DataList columns={columns} data={lineRows} emptyMessage="No items on this movement" />

          <div className="flex items-center justify-end gap-6 px-5 pt-1">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Total Value
            </span>
            <span className="text-base font-semibold text-gray-900">
              {formatInventoryValue(getMovementValue(movement))}
            </span>
          </div>
        </div>
      </div>
      {modals}
      {review.modals}
    </>
  );
}
