'use client';

import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { useGLAccountLedger } from '@/hooks';
import type { GLAccountLedgerEntry } from '@/types/accounting';
import { useState } from 'react';

function amount(value: string, currency: string) {
  return `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const columns: Column<GLAccountLedgerEntry>[] = [
  {
    key: 'date',
    label: 'Date',
    width: '130px',
    render: (row) => new Date(row.journalEntry.transactionDate).toLocaleDateString('en-GB'),
  },
  {
    key: 'journal',
    label: 'Journal',
    width: '150px',
    render: (row) => row.journalEntry.journalNumber,
  },
  {
    key: 'description',
    label: 'Description',
    width: 'minmax(190px, 1fr)',
    render: (row) => row.description ?? row.journalEntry.description,
  },
  {
    key: 'debit',
    label: 'Debit',
    width: '150px',
    render: (row) => (
      <span className="block text-right text-red-600">
        {Number(row.baseDebit) ? amount(row.baseDebit, row.journalEntry.baseCurrency) : '—'}
      </span>
    ),
  },
  {
    key: 'credit',
    label: 'Credit',
    width: '150px',
    render: (row) => (
      <span className="block text-right text-green-600">
        {Number(row.baseCredit) ? amount(row.baseCredit, row.journalEntry.baseCurrency) : '—'}
      </span>
    ),
  },
  {
    key: 'balance',
    label: 'Running Balance',
    width: '165px',
    render: (row) => (
      <span className="block text-right font-medium">
        {amount(row.runningBalance, row.journalEntry.baseCurrency)}
      </span>
    ),
  },
];

export function GLAccountLedger({ accountId }: { accountId: string }) {
  const { data, isLoading } = useGLAccountLedger(accountId);
  const [page, setPage] = useState(1);
  const entries = data?.entries ?? [];
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const paged = entries.slice((page - 1) * pageSize, page * pageSize);
  return (
    <section className="border-t border-gray-200 pt-5">
      <h4 className="mb-4 text-sm font-semibold text-gray-900">Posted ledger activity</h4>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        emptyMessage="No posted ledger activity for this account"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />
    </section>
  );
}
