'use client';

import { Icons } from '@/components/atoms/icons';
import { DatePicker } from '@/components/atoms/DatePicker';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { useGLAccountLedger } from '@/hooks';
import type { GLAccountLedgerEntry } from '@/types/accounting';
import { useState } from 'react';
import { formatSourceEventDescription } from '@/config/reinsurance-event-catalog';
import { formatJournalNumber } from '@/lib/formatters';

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
    label: 'Journal ID',
    width: '200px',
    render: (row) => formatJournalNumber(row.journalEntry.journalNumber),
  },
  {
    key: 'description',
    label: 'Description',
    width: 'minmax(150px, 1fr)',
    render: (row) => {
      const raw = row.description ?? row.journalEntry.description;
      return <span title={raw ?? undefined}>{formatSourceEventDescription(raw)}</span>;
    },
  },
  {
    key: 'debit',
    label: 'Debit',
    width: '150px',
    className: 'text-right',
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
    className: 'text-right',
    render: (row) => (
      <span className="block text-right text-green-600">
        {Number(row.baseCredit) ? amount(row.baseCredit, row.journalEntry.baseCurrency) : '—'}
      </span>
    ),
  },
  {
    key: 'balance',
    label: 'Running Balance',
    width: '150px',
    className: 'text-right',
    render: (row) => (
      <span className="block text-right font-medium">
        {amount(row.runningBalance, row.journalEntry.baseCurrency)}
      </span>
    ),
  },
];

export function GLAccountLedger({
  accountId,
  fromDate: controlledFrom,
  toDate: controlledTo,
  onFromDateChange,
  onToDateChange,
  onReconcile,
}: {
  accountId: string;
  /** Pass all four to control the range from outside (e.g. so stat cards can share it). */
  fromDate?: string;
  toDate?: string;
  onFromDateChange?: (value: string) => void;
  onToDateChange?: (value: string) => void;
  /** Shows a Reconcile button in the toolbar. */
  onReconcile?: () => void;
}) {
  const [page, setPage] = useState(1);
  const [ownFrom, setOwnFrom] = useState('');
  const [ownTo, setOwnTo] = useState('');
  const fromDate = controlledFrom ?? ownFrom;
  const toDate = controlledTo ?? ownTo;
  const changeFrom = onFromDateChange ?? setOwnFrom;
  const changeTo = onToDateChange ?? setOwnTo;
  // A new range can leave fewer pages than the one being viewed, so go back to the first.
  const setFromDate = (value: string) => {
    changeFrom(value);
    setPage(1);
  };
  const setToDate = (value: string) => {
    changeTo(value);
    setPage(1);
  };
  const { data, isLoading } = useGLAccountLedger(accountId);
  const entries = (data?.entries ?? []).filter((entry) => {
    const day = entry.journalEntry.transactionDate.slice(0, 10);
    return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
  });
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const paged = entries.slice((page - 1) * pageSize, page * pageSize);
  const extraFilters = (
    <>
      <div className="w-40">
        <DatePicker
          placeholder="From"
          value={fromDate}
          onChange={setFromDate}
          maxDate={toDate || undefined}
        />
      </div>
      <div className="w-40">
        <DatePicker
          placeholder="To"
          value={toDate}
          onChange={setToDate}
          minDate={fromDate || undefined}
        />
      </div>
      {(fromDate || toDate) && (
        <button
          type="button"
          onClick={() => {
            setFromDate('');
            setToDate('');
          }}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          Clear
        </button>
      )}
    </>
  );
  return (
    <DataTable
      extraFilters={extraFilters}
      actionButton={
        onReconcile
          ? {
              label: 'Reconcile',
              onClick: onReconcile,
              icon: (
                <Icons.GitCompareArrows className="w-4 h-4 shrink-0 -translate-x-4 group-hover:translate-x-0 transition-transform duration-300 ease-out" />
              ),
            }
          : undefined
      }
      columns={columns}
      data={paged}
      isLoading={isLoading}
      emptyMessage="No posted ledger activity for this account"
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      noInternalScroll
    />
  );
}
