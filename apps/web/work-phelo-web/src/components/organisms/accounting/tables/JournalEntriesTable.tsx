'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { JournalEntry, JournalEntryStatus } from '@/types/accounting';

const PAGE_SIZE = 10;

// TODO: replace with useJournalEntries() hook once API is ready
const MOCK_DATA: JournalEntry[] = [];

type BadgeVariant = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const STATUS_VARIANTS: Record<JournalEntryStatus, BadgeVariant> = {
  Draft: 'warning',
  Posted: 'success',
  Reversed: 'info',
  Void: 'danger',
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

const COLUMNS: Column<JournalEntry>[] = [
  {
    key: 'refNo',
    label: 'Ref No.',
    width: '130px',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
        {row.refNo}
      </span>
    ),
  },
  {
    key: 'date',
    label: 'Date',
    width: '130px',
    render: (row) => <span className="text-gray-700 text-sm">{fmtDate(row.date)}</span>,
  },
  {
    key: 'createdBy',
    label: 'Created By',
    width: 'minmax(150px, 1fr)',
    render: (row) => <span className="text-gray-700 text-sm">{row.createdBy}</span>,
  },
  {
    key: 'description',
    label: 'Description',
    width: 'minmax(150px, 1fr)',
    render: (row) => <span className="text-gray-700 text-sm">{row.createdBy}</span>,
  },
  {
    key: 'currency',
    label: 'Currency',
    width: '100px',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
        {row.currency}
      </span>
    ),
  },
  {
    key: 'debitTotal',
    label: 'Debit Total',
    width: '150px',
    render: (row) => (
      <span className="block text-right text-sm font-medium text-gray-900">
        {fmtAmount(row.debitTotal, row.currency)}
      </span>
    ),
  },
  {
    key: 'creditTotal',
    label: 'Credit Total',
    width: '150px',
    render: (row) => (
      <span className="block text-right text-sm font-medium text-gray-900">
        {fmtAmount(row.creditTotal, row.currency)}
      </span>
    ),
  },

  {
    key: 'status',
    label: 'Status',
    width: '110px',
    render: (row) => <Badge label={row.status} variant={STATUS_VARIANTS[row.status]} />,
  },
];

export function JournalEntriesTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search) return MOCK_DATA;
    const q = search.toLowerCase();
    return MOCK_DATA.filter(
      (r) =>
        r.refNo.toLowerCase().includes(q) ||
        r.createdBy.toLowerCase().includes(q) ||
        r.currency.toLowerCase().includes(q),
    );
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DataTable
      columns={COLUMNS}
      data={paged}
      isLoading={false}
      searchPlaceholder="Search journal entries…"
      searchValue={search}
      onSearch={(q) => {
        setSearch(q);
        setPage(1);
      }}
      actionButton={{
        label: 'New Entry',
        onClick: () => router.push(`/${tenantSlug}/accounting/journalentry/new`),
      }}
      rowActions={() => [
        { label: 'View', onClick: () => {} },
        { label: 'Reverse', onClick: () => {} },
        { label: 'Void', onClick: () => {}, danger: true },
      ]}
      emptyMessage="No journal entries found"
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
    />
  );
}
