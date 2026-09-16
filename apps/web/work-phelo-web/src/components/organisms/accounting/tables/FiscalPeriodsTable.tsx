'use client';

import { useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { Badge } from '@/components/atoms/Badge';
import { GenerateFiscalYearModal } from '@/components/organisms/accounting/modals/GenerateFiscalYearModal';
import { YearSelect } from '@/components/atoms/YearSelect';
import { FiscalPeriod, FiscalPeriodStatus } from '@/types/accounting';
import {
  useCloseFiscalPeriod,
  useFiscalPeriods,
  useGenerateFiscalYear,
  useLockFiscalPeriod,
  useOpenFiscalPeriod,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

const PAGE_SIZE = 12;

const STATUS_VARIANT: Record<FiscalPeriodStatus, 'success' | 'warning' | 'neutral'> = {
  OPEN: 'success',
  CLOSED: 'warning',
  LOCKED: 'neutral',
};

const STATUS_LABEL: Record<FiscalPeriodStatus, string> = {
  OPEN: 'Open',
  CLOSED: 'Closed',
  LOCKED: 'Locked',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildColumns(
  onReopen: (row: FiscalPeriod) => void,
  onCloseRequest: (row: FiscalPeriod) => void,
  onLockRequest: (row: FiscalPeriod) => void,
): Column<FiscalPeriod>[] {
  return [
    {
      key: 'name',
      label: 'Period',
      width: 'minmax(150px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'startDate',
      label: 'Start Date',
      width: '160px',
      render: (row) => <span className="text-gray-700 text-sm">{fmtDate(row.startDate)}</span>,
    },
    {
      key: 'endDate',
      label: 'End Date',
      width: '160px',
      render: (row) => <span className="text-gray-700 text-sm">{fmtDate(row.endDate)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '140px',
      render: (row) => (
        <Badge label={STATUS_LABEL[row.status]} variant={STATUS_VARIANT[row.status]} />
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '190px',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {row.status === 'OPEN' && (
            <TableButton variant="red" onClick={() => onCloseRequest(row)}>
              Close
            </TableButton>
          )}
          {row.status === 'CLOSED' && (
            <>
              <TableButton variant="green" onClick={() => onReopen(row)}>
                Reopen
              </TableButton>
              <TableButton variant="gray" onClick={() => onLockRequest(row)}>
                Lock
              </TableButton>
            </>
          )}
        </div>
      ),
    },
  ];
}

export function FiscalPeriodsTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<FiscalPeriod | null>(null);
  const [lockTarget, setLockTarget] = useState<FiscalPeriod | null>(null);
  // `null` = follow the latest year present; a number = an explicit pick.
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  const toast = useToast();
  const { data: periods = [], isLoading } = useFiscalPeriods();
  const generateYearMutation = useGenerateFiscalYear();
  const openMutation = useOpenFiscalPeriod();
  const closeMutation = useCloseFiscalPeriod();
  const lockMutation = useLockFiscalPeriod();

  async function generateYear(year: number) {
    try {
      await generateYearMutation.mutateAsync(year);
      toast.success(`Generated 12 periods for ${year}`);
      setGenerateOpen(false);
    } catch (err) {
      toast.error(extractError(err, 'Failed to generate fiscal year'));
    }
  }

  async function reopen(row: FiscalPeriod) {
    try {
      await openMutation.mutateAsync(row.id);
    } catch (err) {
      toast.error(extractError(err, 'Failed to reopen period'));
    }
  }

  async function confirmClose(row: FiscalPeriod) {
    try {
      await closeMutation.mutateAsync(row.id);
      setCloseTarget(null);
    } catch (err) {
      toast.error(extractError(err, 'Failed to close period'));
    }
  }

  async function confirmLock(row: FiscalPeriod) {
    try {
      await lockMutation.mutateAsync(row.id);
      setLockTarget(null);
    } catch (err) {
      toast.error(extractError(err, 'Failed to lock period'));
    }
  }

  const columns = useMemo(() => buildColumns(reopen, setCloseTarget, setLockTarget), []);

  const availableYears = useMemo(() => {
    const years = periods.map((p) => new Date(p.startDate).getFullYear());
    return [...new Set(years)].sort((a, b) => b - a);
  }, [periods]);
  // Default the filter to the latest year present until the user picks another.
  const activeYear: number | null = yearFilter ?? availableYears[0] ?? null;

  const filtered = useMemo(() => {
    let rows = periods;
    if (activeYear !== null) {
      rows = rows.filter((r) => new Date(r.startDate).getFullYear() === activeYear);
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    return rows;
  }, [search, periods, activeYear]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search periods…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={
          activeYear !== null ? (
            <YearSelect
              value={activeYear}
              onChange={(y) => {
                setYearFilter(y);
                setPage(1);
              }}
              minYear={availableYears[availableYears.length - 1]}
              maxYear={availableYears[0]}
            />
          ) : undefined
        }
        actionButton={{
          label: 'Generate Fiscal Year',
          onClick: () => setGenerateOpen(true),
        }}
        emptyMessage="No fiscal periods yet — generate a year to get started"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <Modal
        isOpen={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        title="Close Period"
        description={`Close "${closeTarget?.name}"? No further entries can be posted to it. It can still be reopened later.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setCloseTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={closeMutation.isPending}
              loadingText="Closing…"
              onClick={() => closeTarget && confirmClose(closeTarget)}
            >
              Close
            </Button>
          </div>
        }
      />

      <Modal
        isOpen={!!lockTarget}
        onClose={() => setLockTarget(null)}
        title="Lock Period"
        description={`Lock "${lockTarget?.name}"? Locked periods are permanently immutable and can never be reopened.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setLockTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={lockMutation.isPending}
              loadingText="Locking…"
              onClick={() => lockTarget && confirmLock(lockTarget)}
            >
              Lock
            </Button>
          </div>
        }
      />

      <GenerateFiscalYearModal
        key={String(generateOpen)}
        isOpen={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerate={generateYear}
        isGenerating={generateYearMutation.isPending}
      />
    </>
  );
}
