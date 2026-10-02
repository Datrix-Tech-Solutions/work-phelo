'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { DataTable, type Column, type SortState } from '@/components/organisms/shared/DataTable';
import { SourceTypeManagePanel } from '@/components/organisms/accounting/panels/SourceTypeManagePanel';
import { SourceLedgerEntryDetailPanel } from '@/components/organisms/accounting/panels/SourceLedgerEntryDetailPanel';
import {
  useLinkSourceType,
  useSourceLedger,
  useSourceLedgerSummary,
  useSourceTypes,
  useUnlinkSourceType,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import { SOURCE_MODULE_LABELS } from '@/lib/accounting/sourceModules';
import {
  SOURCE_LEDGER_STATUS_LABEL,
  SOURCE_LEDGER_STATUS_VARIANT,
  fmtSourceLedgerAmount,
  agingDays,
} from '@/lib/accounting/sourceLedgerDisplay';
import type { SourceLedgerEntry, SourceLedgerStatusFilter } from '@/types/accounting';

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'PAID', label: 'Paid' },
  { value: 'UNPAID', label: 'Unpaid' },
];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function agingColor(days: number) {
  if (days > 30) return 'text-red-600';
  if (days > 14) return 'text-amber-600';
  return 'text-gray-400';
}

export default function SourceTypeDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; sourceTypeId: string }>;
}) {
  const { tenantSlug, sourceTypeId } = use(params);
  const toast = useToast();

  const { data: sourceTypes = [] } = useSourceTypes();
  const sourceType = sourceTypes.find((s) => s.id === sourceTypeId) ?? null;

  const { mutate: link } = useLinkSourceType();
  const { mutate: unlink } = useUnlinkSourceType();
  const [manageOpen, setManageOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<SourceLedgerEntry | null>(null);

  const [statusFilter, setStatusFilter] = useState<SourceLedgerStatusFilter>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortState, setSortState] = useState<SortState>({ key: 'eventDate', direction: 'desc' });

  const { data: summary } = useSourceLedgerSummary(sourceTypeId);
  const { data: entries = [], isLoading } = useSourceLedger({
    sourceTypeId,
    status: statusFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy: sortState.key === 'paymentDate' ? 'paymentDate' : 'eventDate',
    sortDir: sortState.direction,
  });

  const handleSort = (key: string) => {
    setSortState((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    );
  };

  const toggleLink = () => {
    if (!sourceType) return;
    const action = sourceType.isActive ? unlink : link;
    action(sourceType.id, {
      onError: (error) =>
        toast.error(extractError(error, `Unable to ${sourceType.isActive ? 'unlink' : 'link'}`)),
    });
  };

  const summaryCurrency = entries[0]?.currency ?? '';

  const columns: Column<SourceLedgerEntry>[] = [
    {
      key: 'description',
      label: 'Description',
      width: 'minmax(200px, 1.5fr)',
      render: (row) => (
        <div className="flex flex-col min-w-0">
          <span className="font-medium text-gray-900 truncate">{row.description}</span>
          <span className="text-xs text-gray-500 truncate">
            {row.glAccount.code} — {row.glAccount.name}
          </span>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '130px',
      className: 'text-right',
      render: (row) => fmtSourceLedgerAmount(row.amount, row.currency),
    },
    {
      key: 'outstandingAmount',
      label: 'Outstanding',
      width: '130px',
      className: 'text-right',
      render: (row) => fmtSourceLedgerAmount(row.outstandingAmount, row.currency),
    },
    {
      key: 'status',
      label: 'Status',
      width: '170px',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <Badge
            label={SOURCE_LEDGER_STATUS_LABEL[row.paymentState]}
            variant={SOURCE_LEDGER_STATUS_VARIANT[row.paymentState]}
          />
          {row.paymentState !== 'PAID' && (
            <span className={cn('text-xs', agingColor(agingDays(row.createdAt)))}>
              {agingDays(row.createdAt)} days outstanding
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'eventDate',
      label: 'Event Date',
      width: '130px',
      sortable: true,
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: 'paymentDate',
      label: 'Last Payment',
      width: '130px',
      sortable: true,
      render: (row) => (row.lastPaymentAt ? new Date(row.lastPaymentAt).toLocaleDateString() : '—'),
    },
    {
      key: 'journal',
      label: 'Journal #',
      width: '140px',
      render: (row) => (
        <span className="text-gray-500 font-mono text-xs">{row.journalEntry.journalNumber}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/accounting/settings/source-types`}
            className="hover:text-gray-700 transition-colors"
          >
            Source Types
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{sourceType?.name ?? '—'}</span>
        </nav>
      </div>

      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto flex flex-col gap-6`}>
        {!sourceType ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Source type not found.
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-sm font-bold text-gray-700 tracking-wider">
                    {SOURCE_MODULE_LABELS[sourceType.module]}
                  </span>
                  <Badge
                    label={sourceType.isActive ? 'Linked' : 'Unlinked'}
                    variant={sourceType.isActive ? 'success' : 'neutral'}
                  />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">{sourceType.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <TableButton variant="blue" onClick={() => setManageOpen(true)}>
                  Manage
                </TableButton>
                <TableButton variant={sourceType.isActive ? 'red' : 'green'} onClick={toggleLink}>
                  {sourceType.isActive ? 'Unlink' : 'Link'}
                </TableButton>
              </div>
            </div>

            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Entries" value={String(summary.entryCount)} />
                <StatCard label="Paid" value={`${summary.paidCount} / ${summary.entryCount}`} />
                <StatCard
                  label="Total Amount"
                  value={fmtSourceLedgerAmount(summary.totalAmount, summaryCurrency)}
                />
                <StatCard
                  label="Outstanding"
                  value={fmtSourceLedgerAmount(summary.totalOutstanding, summaryCurrency)}
                />
              </div>
            )}

            <DataTable
              columns={columns}
              data={entries}
              isLoading={isLoading}
              emptyMessage="No entries yet — entries show up here once this source posts a journal entry."
              noInternalScroll
              filterOptions={STATUS_FILTER_OPTIONS}
              onFilter={(value) => setStatusFilter(value as SourceLedgerStatusFilter)}
              extraFilters={
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700"
                  />
                </div>
              }
              sortState={sortState}
              onSort={handleSort}
              onRowClick={(row) => setDetailTarget(row)}
              currentPage={1}
              totalPages={1}
              onPageChange={() => {}}
            />
          </>
        )}
      </div>

      <SourceTypeManagePanel
        sourceType={manageOpen ? sourceType : null}
        onClose={() => setManageOpen(false)}
      />
      <SourceLedgerEntryDetailPanel entry={detailTarget} onClose={() => setDetailTarget(null)} />
    </div>
  );
}
