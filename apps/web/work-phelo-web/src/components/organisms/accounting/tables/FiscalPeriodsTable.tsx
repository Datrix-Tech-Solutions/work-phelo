'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { Badge } from '@/components/atoms/Badge';
import { GenerateFiscalYearModal } from '@/components/organisms/accounting/modals/GenerateFiscalYearModal';
import { YearSelect } from '@/components/atoms/YearSelect';
import { FiscalPeriod, FiscalPeriodStatus } from '@/types/accounting';
import { useToast } from '@/hooks/useToast';

const PAGE_SIZE = 12;

const STATUS_VARIANT: Record<FiscalPeriodStatus, 'success' | 'warning' | 'neutral'> = {
  OPEN: 'success',
  SOFT_CLOSED: 'warning',
  CLOSED: 'neutral',
};

const STATUS_LABEL: Record<FiscalPeriodStatus, string> = {
  OPEN: 'Open',
  SOFT_CLOSED: 'Soft Closed',
  CLOSED: 'Closed',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Build the twelve monthly periods for a calendar year. Each period runs from
 * the first to the last day of its month. This is a client-only stand-in until
 * the backend exposes a generate endpoint.
 */
function generateMonthlyPeriods(year: number): FiscalPeriod[] {
  return Array.from({ length: 12 }, (_, month) => {
    const mm = String(month + 1).padStart(2, '0');
    const lastDay = new Date(year, month + 1, 0).getDate();
    const label = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long' });
    return {
      id: `${year}-${mm}`,
      name: `${label} ${year}`,
      year,
      startDate: `${year}-${mm}-01`,
      endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
      status: 'OPEN' as const,
    };
  });
}

function buildColumns(
  onSetStatus: (row: FiscalPeriod, status: FiscalPeriodStatus) => void,
  onCloseRequest: (row: FiscalPeriod) => void,
): Column<FiscalPeriod>[] {
  return [
    {
      key: 'name',
      label: 'Period',
      width: 'minmax(150px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'year',
      label: 'Fiscal Year',
      width: '120px',
      render: (row) => <span className="text-gray-700 text-sm">{row.year}</span>,
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
            <>
              <TableButton variant="orange" onClick={() => onSetStatus(row, 'SOFT_CLOSED')}>
                Soft Close
              </TableButton>
              <TableButton variant="red" onClick={() => onCloseRequest(row)}>
                Close
              </TableButton>
            </>
          )}
          {row.status === 'SOFT_CLOSED' && (
            <>
              <TableButton variant="green" onClick={() => onSetStatus(row, 'OPEN')}>
                Reopen
              </TableButton>
              <TableButton variant="red" onClick={() => onCloseRequest(row)}>
                Close
              </TableButton>
            </>
          )}
          {row.status === 'CLOSED' && (
            <TableButton variant="green" onClick={() => onSetStatus(row, 'SOFT_CLOSED')}>
              Reopen
            </TableButton>
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
  // `null` = follow the latest generated year; a number = an explicit pick.
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  // Client-only store until the backend generate/status endpoints exist.
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const toast = useToast();

  function generateYear(year: number) {
    if (periods.some((p) => p.year === year)) {
      toast.error(`Fiscal year ${year} has already been generated`);
      return;
    }
    setPeriods((prev) =>
      [...prev, ...generateMonthlyPeriods(year)].sort((a, b) =>
        a.startDate.localeCompare(b.startDate),
      ),
    );
    toast.success(`Generated 12 periods for ${year}`);
    setGenerateOpen(false);
  }

  function setStatus(row: FiscalPeriod, status: FiscalPeriodStatus) {
    setPeriods((prev) => prev.map((p) => (p.id === row.id ? { ...p, status } : p)));
  }

  function confirmClose(row: FiscalPeriod) {
    setStatus(row, 'CLOSED');
    setCloseTarget(null);
  }

  const columns = useMemo(() => buildColumns(setStatus, setCloseTarget), []);

  const availableYears = useMemo(
    () => [...new Set(periods.map((p) => p.year))].sort((a, b) => b - a),
    [periods],
  );
  // Default the filter to the latest year until the user picks another.
  const activeYear: number | null = yearFilter ?? availableYears[0] ?? null;

  const filtered = useMemo(() => {
    let rows = periods;
    if (activeYear !== null) {
      rows = rows.filter((r) => r.year === activeYear);
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) => r.name.toLowerCase().includes(q) || String(r.year).includes(q),
      );
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
        isLoading={false}
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
        description={`Close "${closeTarget?.name}"? No further entries can be posted to it. You can still reopen it to a soft-closed state.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setCloseTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => closeTarget && confirmClose(closeTarget)}>
              Close
            </Button>
          </div>
        }
      />

      <GenerateFiscalYearModal
        key={String(generateOpen)}
        isOpen={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerate={generateYear}
      />
    </>
  );
}
