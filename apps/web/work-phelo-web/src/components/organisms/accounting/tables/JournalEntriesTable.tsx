'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import {
  JOURNAL_ENTRY_TYPE_LABELS,
  JournalEntryRecord,
  JournalRecordStatus,
} from '@/types/accounting';
import { formatSourceEventDescription } from '@/config/reinsurance-event-catalog';
import { formatJournalNumber } from '@/lib/formatters';
import { displayStatus } from '@/lib/accounting/journalStatus';
// import {
//   JOURNAL_SOURCE_LABELS,
//   JOURNAL_SOURCE_VARIANT,
//   describeJournalSource,
// } from '@/lib/accounting/journalSource';
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

function clientNames(journal: JournalEntryRecord) {
  const names = new Set(
    journal.lines
      .map((line) => line.subledgerAccount?.name)
      .filter((name): name is string => Boolean(name)),
  );
  return Array.from(names);
}

export function JournalEntriesTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detailTarget, setDetailTarget] = useState<JournalEntryRecord | null>(null);
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  const { data = [], isLoading } = useJournals();

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (r) =>
        r.journalNumber.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.transactionCurrency.toLowerCase().includes(q) ||
        // (r.source ? describeJournalSource(r.source).toLowerCase().includes(q) : false) ||
        clientNames(r).some((name) => name.toLowerCase().includes(q)),
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
      // {
      //   key: 'source',
      //   label: 'Source',
      //   width: '150px',
      //   render: (row) =>
      //     row.source ? (
      //       <div className="flex flex-col gap-0.5">
      //         <Badge
      //           label={JOURNAL_SOURCE_LABELS[row.source.category]}
      //           variant={JOURNAL_SOURCE_VARIANT[row.source.category]}
      //         />
      //         <span
      //           className="text-xs text-gray-500 truncate"
      //           title={describeJournalSource(row.source)}
      //         >
      //           {describeJournalSource(row.source)}
      //         </span>
      //       </div>
      //     ) : (
      //       <span className="text-gray-400 text-sm">—</span>
      //     ),
      // },
      {
        key: 'transactionDate',
        label: 'Date',
        width: '80px',
        render: (row) => (
          <span className="font-semibold text-gray-700 text-sm">
            {fmtDate(row.transactionDate)}
          </span>
        ),
      },
      {
        key: 'description',
        label: 'Description',
        width: 'minmax(100px, 1fr)',
        render: (row) => (
          <span className="font-semibold text-gray-700 text-sm" title={row.description}>
            {formatSourceEventDescription(row.description)}
          </span>
        ),
      },
      {
        key: 'client',
        label: 'Client',
        width: 'minmax(100px, 1fr)',
        render: (row) => {
          const names = clientNames(row);
          if (names.length > 0) {
            return (
              <span className="font-semibold text-gray-700 text-sm" title={names.join(', ')}>
                {names.join(', ')}
              </span>
            );
          }
          // No subledger party (a manual entry) — the entry type is at least as distinguishing
          // as a client name would be, and never blank.
          return (
            <span className="font-semibold text-gray-400 text-sm">
              {JOURNAL_ENTRY_TYPE_LABELS[row.entryType]}
            </span>
          );
        },
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
        width: '80px',
        render: (row) => (
          <Badge label={displayStatus(row)} variant={STATUS_VARIANT[displayStatus(row)]} />
        ),
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
