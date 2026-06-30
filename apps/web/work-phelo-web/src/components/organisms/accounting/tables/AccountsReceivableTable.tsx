'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { AccountsReceivableInvoice, InvoiceStatus } from '@/types/accounting';

const PAGE_SIZE = 10;

// TODO: replace with useAccountsReceivableInvoices() hook once API is ready
const MOCK_DATA: AccountsReceivableInvoice[] = [];

type BadgeVariant = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const STATUS_VARIANTS: Record<InvoiceStatus, BadgeVariant> = {
  Draft: 'neutral',
  'Pending Approval': 'warning',
  Approved: 'info',
  Paid: 'success',
  Overdue: 'danger',
  Void: 'neutral',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const COLUMNS: Column<AccountsReceivableInvoice>[] = [
  {
    key: 'invoiceNumber',
    label: 'Invoice No.',
    width: '140px',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
        {row.invoiceNumber}
      </span>
    ),
  },
  {
    key: 'customer',
    label: 'Customer',
    width: '1fr',
    render: (row) => <span className="text-sm text-gray-800 font-medium">{row.customer}</span>,
  },
  {
    key: 'invoiceDate',
    label: 'Invoice Date',
    width: '130px',
    render: (row) => <span className="text-sm text-gray-700">{fmtDate(row.invoiceDate)}</span>,
  },
  {
    key: 'dueDate',
    label: 'Due Date',
    width: '130px',
    render: (row) => <span className="text-sm text-gray-700">{fmtDate(row.dueDate)}</span>,
  },
  {
    key: 'amount',
    label: 'Amount',
    width: '170px',
    render: (row) => (
      <span className="block text-right text-sm font-medium text-gray-900">
        {fmtAmount(row.amount, row.currency)}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '120px',
    render: (row) => <Badge label={row.status} variant={STATUS_VARIANTS[row.status]} />,
  },
];

export function AccountsReceivableTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search) return MOCK_DATA;
    const q = search.toLowerCase();
    return MOCK_DATA.filter(
      (r) =>
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    );
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DataTable
      columns={COLUMNS}
      data={paged}
      isLoading={false}
      searchPlaceholder="Search invoices…"
      searchValue={search}
      onSearch={(q) => {
        setSearch(q);
        setPage(1);
      }}
      actionButton={{
        label: 'New Invoice',
        onClick: () => router.push(`/${tenantSlug}/accounting/accountsreceivable/new`),
      }}
      rowActions={() => [
        { label: 'View', onClick: () => {} },
        { label: 'Record Payment', onClick: () => {} },
        { label: 'Void', onClick: () => {}, danger: true },
      ]}
      emptyMessage="No invoices found"
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
    />
  );
}
