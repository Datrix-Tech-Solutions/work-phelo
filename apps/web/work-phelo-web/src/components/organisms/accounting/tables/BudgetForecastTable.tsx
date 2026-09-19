'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { Button } from '@/components/atoms/Button';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { BudgetPanel } from '@/components/organisms/accounting/panels/BudgetPanel';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { TypeChip, TypeChipColor } from '@/components/atoms/TypeChip';
import { Budget, BudgetPeriod, BudgetStatus } from '@/types/accounting';
import { BUDGET_PERIOD_LABELS, BUDGET_STATUS_LABELS } from '@/lib/accounting/budgetPeriod';
import { formatDate } from '@/lib/formatters';
import { extractError } from '@/lib/extractError';
import { useActivateBudget, useBudgets, useCloseBudget, useDeleteBudget } from '@/hooks';
import { useToast } from '@/hooks/useToast';

const PAGE_SIZE = 10;

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
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const { data: budgets = [], isLoading } = useBudgets();
  const activate = useActivateBudget();
  const close = useCloseBudget();
  const remove = useDeleteBudget();
  const toast = useToast();

  /** Runs a mutation with success / failure toasts; resolves to whether it succeeded. */
  const run = (action: () => Promise<unknown>, success: string, failure: string) =>
    action().then(
      () => {
        toast.success(success);
        return true;
      },
      (error) => {
        toast.error(extractError(error, failure));
        return false;
      },
    );

  const confirmDelete = () => {
    if (!deleteTarget) return;
    run(
      () => remove.mutateAsync(deleteTarget.id),
      'Budget deleted',
      'Failed to delete budget',
    ).then((ok) => ok && setDeleteTarget(null));
  };

  const filtered = useMemo(() => {
    let rows = budgets;
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    return rows;
  }, [budgets, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading}
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
            label: row.status === 'CLOSED' ? 'View' : 'Edit',
            onClick: () => router.push(`/${tenantSlug}/accounting/budget-forecast/${row.id}`),
          },
          ...(row.status === 'DRAFT'
            ? [
                {
                  label: 'Activate',
                  onClick: () =>
                    run(
                      () => activate.mutateAsync(row.id),
                      'Budget activated',
                      'Failed to activate budget',
                    ),
                },
              ]
            : []),
          ...(row.status === 'ACTIVE'
            ? [
                {
                  label: 'Close',
                  onClick: () =>
                    run(() => close.mutateAsync(row.id), 'Budget closed', 'Failed to close budget'),
                },
              ]
            : []),
          ...(row.status === 'DRAFT'
            ? [{ label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) }]
            : []),
        ]}
        emptyMessage="No budgets found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <BudgetPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Budget"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={remove.isPending} onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
