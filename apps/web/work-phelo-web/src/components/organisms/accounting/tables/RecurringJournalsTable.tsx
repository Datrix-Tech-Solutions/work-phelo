'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import {
  RECURRENCE_FREQUENCY_OPTIONS,
  RECURRING_ON_GENERATION_OPTIONS,
  RecurringJournalRecord,
  RecurringJournalStatus,
} from '@/types/accounting';
import {
  useRecurringJournalAction,
  useRecurringJournals,
  useRunRecurringJournalNow,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatJournalNumber } from '@/lib/formatters';

const PAGE_SIZE = 10;

const STATUS_VARIANT: Record<RecurringJournalStatus, 'success' | 'warning' | 'neutral' | 'danger'> =
  {
    ACTIVE: 'success',
    PAUSED: 'warning',
    COMPLETED: 'neutral',
    CANCELLED: 'danger',
  };

const STATUS_LABEL: Record<RecurringJournalStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const FREQUENCY_LABEL = Object.fromEntries(
  RECURRENCE_FREQUENCY_OPTIONS.map((o) => [o.value, o.label]),
);
const ON_GENERATION_LABEL = Object.fromEntries(
  RECURRING_ON_GENERATION_OPTIONS.map((o) => [o.value, o.label]),
);

/** Recurring dates are calendar dates, so they are shown in UTC to avoid a day's shift. */
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function lineTotal(record: RecurringJournalRecord) {
  return record.lines.reduce((sum, line) => sum + Number(line.debit), 0);
}

export function RecurringJournalsTable() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<RecurringJournalRecord | null>(null);

  const { data = [], isLoading } = useRecurringJournals();
  const action = useRecurringJournalAction();
  const runNow = useRunRecurringJournalNow();

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
    );
  }, [search, data]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const run = async (row: RecurringJournalRecord, kind: 'pause' | 'resume' | 'cancel') => {
    try {
      await action.mutateAsync({ id: row.id, action: kind });
      toast.success(
        kind === 'pause'
          ? `"${row.name}" paused`
          : kind === 'resume'
            ? `"${row.name}" resumed`
            : `"${row.name}" cancelled`,
      );
    } catch (err) {
      toast.error(extractError(err, `Failed to ${kind} recurring entry`));
    }
  };

  const generateNow = async (row: RecurringJournalRecord) => {
    try {
      const { journal } = await runNow.mutateAsync(row.id);
      toast.success(`Generated ${formatJournalNumber(journal.journalNumber)}`);
    } catch (err) {
      toast.error(extractError(err, 'Failed to generate the entry'));
    }
  };

  const columns = useMemo<Column<RecurringJournalRecord>[]>(
    () => [
      {
        key: 'name',
        label: 'Name',
        width: 'minmax(160px, 1.3fr)',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900">{row.name}</span>
            <span className="text-xs text-gray-500 truncate" title={row.description}>
              {row.description}
            </span>
          </div>
        ),
      },
      {
        key: 'frequency',
        label: 'Frequency',
        width: '110px',
        render: (row) => (
          <span className="text-sm text-gray-700">{FREQUENCY_LABEL[row.frequency]}</span>
        ),
      },
      {
        key: 'amount',
        label: 'Amount',
        width: '140px',
        className: 'text-right',
        render: (row) => (
          <span className="block text-right text-sm font-medium text-gray-900">
            {row.transactionCurrency}{' '}
            {lineTotal(row).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        key: 'nextRunDate',
        label: 'Next Run',
        width: '110px',
        render: (row) => (
          <span className="text-sm text-gray-700">
            {row.status === 'ACTIVE' || row.status === 'PAUSED' ? fmtDate(row.nextRunDate) : '—'}
          </span>
        ),
      },
      {
        key: 'endDate',
        label: 'Ends',
        width: '110px',
        render: (row) => (
          <span className="text-sm text-gray-700">
            {row.endDate ? fmtDate(row.endDate) : 'Never'}
          </span>
        ),
      },
      {
        key: 'onGeneration',
        label: 'On Generation',
        width: '130px',
        render: (row) => (
          <span className="text-sm text-gray-700">{ON_GENERATION_LABEL[row.onGeneration]}</span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: 'minmax(120px, 1fr)',
        render: (row) => (
          <div className="flex flex-col gap-0.5">
            <Badge label={STATUS_LABEL[row.status]} variant={STATUS_VARIANT[row.status]} />
            {row.lastError && (
              <span className="text-xs text-red-600 truncate" title={row.lastError}>
                {row.lastError}
              </span>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  const rowActions = (row: RecurringJournalRecord): RowAction[] => {
    const actions: RowAction[] = [];
    if (row.status === 'ACTIVE') {
      actions.push(
        { label: 'Run now', onClick: () => generateNow(row) },
        { label: 'Pause', onClick: () => run(row, 'pause') },
      );
    }
    if (row.status === 'PAUSED') {
      actions.push({ label: 'Resume', onClick: () => run(row, 'resume'), variant: 'success' });
    }
    if (row.status === 'ACTIVE' || row.status === 'PAUSED') {
      actions.push({ label: 'Cancel', onClick: () => setCancelTarget(row), danger: true });
    }
    return actions;
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search recurring entries…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{
          label: 'New Recurring Entry',
          onClick: () => router.push(`/${tenantSlug}/accounting/journalentry/new?type=recurring`),
        }}
        rowActions={rowActions}
        singleActionAsButton={false}
        emptyMessage="No recurring entries yet"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Recurring Entry"
        description={`"${cancelTarget?.name}" will stop generating entries for good. Entries it already created are not affected.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              isLoading={action.isPending}
              loadingText="Cancelling…"
              onClick={async () => {
                if (!cancelTarget) return;
                await run(cancelTarget, 'cancel');
                setCancelTarget(null);
              }}
            >
              Cancel Entry
            </Button>
          </div>
        }
      />
    </>
  );
}
