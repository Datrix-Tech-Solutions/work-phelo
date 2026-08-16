'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { JournalEntryRecord, JournalRecordStatus } from '@/types/accounting';
import { formatSourceEventDescription } from '@/config/reinsurance-event-catalog';
import { formatJournalNumber } from '@/lib/formatters';
import { useJournals } from '@/hooks';
import { JournalDetailPanel } from '@/components/organisms/accounting/panels/JournalDetailPanel';

const PAGE_SIZE = 10;

const STATUS_VARIANT: Record<JournalRecordStatus, 'success' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  POSTED: 'success',
  REVERSED: 'danger',
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

function lineTotals(journal: JournalEntryRecord) {
  return journal.lines.reduce(
    (totals, line) => ({
      debit: totals.debit + Number(line.transactionDebit),
      credit: totals.credit + Number(line.transactionCredit),
    }),
    { debit: 0, credit: 0 },
  );
}

export function JournalEntriesTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detailTarget, setDetailTarget] = useState<JournalEntryRecord | null>(null);

  const { data = [], isLoading } = useJournals();

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (r) =>
        r.journalNumber.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.transactionCurrency.toLowerCase().includes(q),
    );
  }, [search, data]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns = useMemo<Column<JournalEntryRecord>[]>(
    () => [
      {
        key: 'journalNumber',
        label: 'Journal ID',
        width: '200px',
        render: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
            {formatJournalNumber(row.journalNumber)}
          </span>
        ),
      },
      {
        key: 'transactionDate',
        label: 'Date',
        width: '100px',
        render: (row) => (
          <span className="text-gray-700 text-sm">{fmtDate(row.transactionDate)}</span>
        ),
      },
      {
        key: 'description',
        label: 'Description',
        width: 'minmax(150px, 1fr)',
        render: (row) => (
          <span className="text-gray-700 text-sm" title={row.description}>
            {formatSourceEventDescription(row.description)}
          </span>
        ),
      },
      {
        key: 'transactionCurrency',
        label: 'Currency',
        width: '50px',
        render: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-600 tracking-wide">
            {row.transactionCurrency}
          </span>
        ),
      },
      {
        key: 'debitTotal',
        label: 'Debit Total',
        width: '150px',
        className: 'text-right',
        render: (row) => (
          <span className="block text-right text-sm font-medium text-gray-900">
            {fmtAmount(lineTotals(row).debit, row.transactionCurrency)}
          </span>
        ),
      },
      {
        key: 'creditTotal',
        label: 'Credit Total',
        width: '150px',
        className: 'text-right',
        render: (row) => (
          <span className="block text-right text-sm font-medium text-gray-900">
            {fmtAmount(lineTotals(row).credit, row.transactionCurrency)}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '100px',
        render: (row) => <Badge label={row.status} variant={STATUS_VARIANT[row.status]} />,
      },
    ],
    [],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
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
        onRowClick={(row) => setDetailTarget(row)}
        emptyMessage="No journal entries found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <JournalDetailPanel journal={detailTarget} onClose={() => setDetailTarget(null)} />
    </>
  );
}
