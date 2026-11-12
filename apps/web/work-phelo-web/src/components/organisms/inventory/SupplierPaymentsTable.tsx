'use client';

import { useCrumbs } from '@/hooks/inventory/useCrumbs';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { formatDate } from '@/lib/formatters';
import { formatInventoryValue } from '@/lib/inventoryCurrency';
import { useUserNames } from '@/hooks/inventory/useUserNames';
import {
  PAYMENT_METHOD_LABEL,
  type PurchaseOrder,
  type PurchaseOrderPayment,
} from '@/hooks/inventory/usePurchaseOrders';

const PAGE_SIZE = 10;

interface SupplierPayment {
  id: string;
  date: string;
  recordedAt: string;
  recordedBy: string;
  method: PurchaseOrderPayment['method'];
  reference: string | null;
  notes: string | null;
  /** The orders this payment was for, and how much went to each. */
  allocations: { orderId: string; orderReference: string; amount: number }[];
  total: number;
}

interface SupplierPaymentsTableProps {
  /** The supplier's orders; each carries its share of every payment made on it. */
  orders: PurchaseOrder[];
  isLoading?: boolean;
  /** Name of the page this table sits on, so the page it opens can link back to it. */
  sourceLabel?: string;
}

/** The payments made to a supplier, each with the purchase orders it was paid for. */
export function SupplierPaymentsTable({
  orders,
  isLoading,
  sourceLabel,
}: SupplierPaymentsTableProps) {
  const { link } = useCrumbs();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const userName = useUserNames();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // One payment can be shared over several orders: gather its shares back into one row.
  const payments = useMemo(() => {
    const byId = new Map<string, SupplierPayment>();
    for (const order of orders) {
      for (const share of order.payments) {
        const existing = byId.get(share.paymentId);
        const allocation = {
          orderId: order.id,
          orderReference: order.reference,
          amount: share.amount,
        };
        if (existing) {
          existing.allocations.push(allocation);
          existing.total += share.amount;
        } else {
          byId.set(share.paymentId, {
            id: share.paymentId,
            date: share.date,
            recordedAt: share.recordedAt,
            recordedBy: share.recordedBy,
            method: share.method,
            reference: share.reference,
            notes: share.notes,
            allocations: [allocation],
            total: share.amount,
          });
        }
      }
    }
    return [...byId.values()].sort(
      (a, b) => b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt),
    );
  }, [orders]);

  const term = search.trim().toLowerCase();
  const filtered = payments.filter(
    (p) =>
      !term ||
      (p.reference ?? '').toLowerCase().includes(term) ||
      PAYMENT_METHOD_LABEL[p.method].toLowerCase().includes(term) ||
      p.allocations.some((a) => a.orderReference.toLowerCase().includes(term)),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<SupplierPayment>[] = [
    {
      key: 'date',
      label: 'Date',
      width: '110px',
      render: (p) => (
        <span className="text-sm font-semibold text-gray-500">{formatDate(p.date)}</span>
      ),
    },
    {
      key: 'orders',
      label: 'Paid For',
      width: 'minmax(180px, 2fr)',
      className: 'overflow-hidden min-w-0 pr-4',
      render: (p) => (
        <div className="flex min-w-0 flex-col leading-tight">
          {p.allocations.map((a) => (
            <span key={a.orderId} className="truncate text-sm">
              <Link
                href={(() => {
                  const href = `/${tenantSlug}/operations/inventory/purchase-orders/${a.orderId}`;
                  return sourceLabel ? link(href, sourceLabel) : href;
                })()}
                className="font-mono font-medium text-brand hover:underline"
              >
                {a.orderReference}
              </Link>
              {p.allocations.length > 1 && (
                <span className="ml-2 text-xs font-semibold text-gray-500">
                  {formatInventoryValue(a.amount)}
                </span>
              )}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'method',
      label: 'Method',
      width: 'minmax(110px, 1fr)',
      render: (p) => (
        <span className="text-sm font-semibold text-gray-900">
          {PAYMENT_METHOD_LABEL[p.method]}
        </span>
      ),
    },
    {
      key: 'reference',
      label: 'Reference',
      width: 'minmax(110px, 1fr)',
      render: (p) => <span className="text-sm text-gray-600">{p.reference || '—'}</span>,
    },
    {
      key: 'notes',
      label: 'Notes',
      width: 'minmax(120px, 1fr)',
      render: (p) => <span className="truncate text-sm text-gray-600">{p.notes || '—'}</span>,
    },
    {
      key: 'recordedBy',
      label: 'Recorded By',
      width: 'minmax(110px, 1fr)',
      render: (p) => (
        <span className="truncate text-sm font-semibold text-gray-500">
          {userName(p.recordedBy)}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '130px',
      className: 'text-right pr-4',
      render: (p) => (
        <span className="text-sm font-semibold text-gray-900">{formatInventoryValue(p.total)}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage="No payments made to this supplier"
      searchPlaceholder="Search by order, method or reference..."
      searchValue={search}
      onSearch={(q) => {
        setSearch(q);
        setPage(1);
      }}
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      noInternalScroll
    />
  );
}
