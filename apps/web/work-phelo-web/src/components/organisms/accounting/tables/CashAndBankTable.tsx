'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { CashBankAccount } from '@/types/accounting';

const PAGE_SIZE = 10;

// TODO: replace with useCashAndBankAccounts() hook once API is ready
const MOCK_DATA: CashBankAccount[] = [];

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

const COLUMNS: Column<CashBankAccount>[] = [
  {
    key: 'accountCode',
    label: 'Account Code',
    width: '140px',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
        {row.accountCode}
      </span>
    ),
  },
  {
    key: 'accountName',
    label: 'Account Name',
    width: 'minmax(150px, 1fr)',
    render: (row) => <span className="text-sm font-medium text-gray-900">{row.accountName}</span>,
  },
  {
    key: 'bankName',
    label: 'Bank Name',
    width: 'minmax(150px, 1fr)',
    render: (row) => <span className="text-sm text-gray-700">{row.bankName}</span>,
  },
  {
    key: 'currency',
    label: 'Currency',
    width: '100px',
    render: (row) => <span className="text-sm text-gray-700">{row.currency}</span>,
  },
  {
    key: 'bookBalance',
    label: 'Book Balance',
    width: '160px',
    render: (row) => (
      <span className="block text-right text-sm font-medium text-gray-900">
        {fmtAmount(row.bookBalance, row.currency)}
      </span>
    ),
  },
  {
    key: 'lastReconciled',
    label: 'Last Reconciled',
    width: '140px',
    render: (row) => (
      <span className="text-sm text-gray-700">
        {row.lastReconciled ? fmtDate(row.lastReconciled) : '—'}
      </span>
    ),
  },
];

export function CashAndBankTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search) return MOCK_DATA;
    const q = search.toLowerCase();
    return MOCK_DATA.filter(
      (r) =>
        r.accountCode.toLowerCase().includes(q) ||
        r.accountName.toLowerCase().includes(q) ||
        r.bankName.toLowerCase().includes(q),
    );
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DataTable
      columns={COLUMNS}
      data={paged}
      isLoading={false}
      searchPlaceholder="Search accounts…"
      searchValue={search}
      onSearch={(q) => {
        setSearch(q);
        setPage(1);
      }}
      rowActions={() => [{ label: 'Reconcile', onClick: () => {} }]}
      emptyMessage="No accounts found"
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
    />
  );
}
