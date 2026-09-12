'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { BudgetPanel } from '@/components/organisms/accounting/panels/BudgetPanel';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { TypeChip, TypeChipColor } from '@/components/atoms/TypeChip';
import { Budget, BudgetPeriod, BudgetStatus } from '@/types/accounting';
import { BUDGET_PERIOD_LABELS, BUDGET_STATUS_LABELS } from '@/lib/accounting/budgetPeriod';
import { formatDate } from '@/lib/formatters';

const PAGE_SIZE = 10;

// TODO: replace with useBudgets() hook once the budgets API is ready.
const MOCK_DATA: Budget[] = [
  {
    id: 'demo-budget-1',
    name: 'Q1 2026 Operating Budget',
    period: 'QUARTERLY',
    scope: 'BOTH',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    currency: 'GHS',
    incomeBudgeted: 580000,
    expenseBudgeted: 340000,
    netAmount: 240000,
    status: 'ACTIVE',
    createdAt: '2025-12-18T09:12:00.000Z',
    updatedAt: '2026-01-04T14:30:00.000Z',
  },
];

const STATUS_VARIANT: Record<BudgetStatus, 'neutral' | 'success' | 'info'> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  CLOSED: 'info',
};

const PERIOD_CHIP_COLOR: Record<BudgetPeriod, TypeChipColor> = {
  MONTHLY: 'blue',
  QUARTERLY: 'purple',
  YEARLY: 'teal',
};

const STATUS_OPTIONS = (Object.keys(BUDGET_STATUS_LABELS) as BudgetStatus[]).map((s) => ({
  value: s,
  label: BUDGET_STATUS_LABELS[s],
}));

function fmtAmount(amount: number, currency: string) {
  return `${currency ? `${currency} ` : ''}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const COLUMNS: Column<Budget>[] = [
  {
    key: 'name',
    label: 'Budget Name',
    width: 'minmax(160px, 1fr)',
    render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
  },
  {
    key: 'period',
    label: 'Period',
    width: '110px',
    render: (row) => (
      <TypeChip label={BUDGET_PERIOD_LABELS[row.period]} color={PERIOD_CHIP_COLOR[row.period]} />
    ),
  },
  {
    key: 'startDate',
    label: 'Start',
    width: '120px',
    render: (row) => <span className="text-sm text-gray-700">{formatDate(row.startDate)}</span>,
  },
  {
    key: 'endDate',
    label: 'End',
    width: '120px',
    render: (row) => <span className="text-sm text-gray-700">{formatDate(row.endDate)}</span>,
  },
  {
    key: 'incomeBudgeted',
    label: 'Income Budgeted',
    width: '150px',
    render: (row) => (
      <span className="block text-right text-sm text-gray-700">
        {fmtAmount(row.incomeBudgeted, row.currency)}
      </span>
    ),
  },
  {
    key: 'expenseBudgeted',
    label: 'Expense Budgeted',
    width: '150px',
    render: (row) => (
      <span className="block text-right text-sm text-gray-700">
        {fmtAmount(row.expenseBudgeted, row.currency)}
      </span>
    ),
  },
  {
    key: 'netAmount',
    label: 'Net Amount',
    width: '150px',
    render: (row) => (
      <span
        className={`block text-right text-sm font-medium ${
          row.netAmount >= 0 ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {row.netAmount >= 0 ? '' : '−'}
        {fmtAmount(Math.abs(row.netAmount), row.currency)}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '110px',
    render: (row) => (
      <Badge label={BUDGET_STATUS_LABELS[row.status]} variant={STATUS_VARIANT[row.status]} />
    ),
  },
];

export function BudgetForecastTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const filtered = useMemo(() => {
    let rows = MOCK_DATA;
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    return rows;
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={false}
        searchPlaceholder="Search budgets…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={
          <SearchSelect
            size="sm"
            placeholder="Status"
            showAllOption
            allLabel="All statuses"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          />
        }
        actionButton={{
          label: 'Add Budget',
          onClick: () => setIsPanelOpen(true),
        }}
        onRowClick={(row) => router.push(`/${tenantSlug}/accounting/budget-forecast/${row.id}`)}
        rowActions={(row) => [
          {
            label: 'Edit',
            onClick: () => router.push(`/${tenantSlug}/accounting/budget-forecast/${row.id}`),
          },
          { label: 'Delete', onClick: () => {}, danger: true },
        ]}
        emptyMessage="No budgets found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <BudgetPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
    </>
  );
}
