'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { Badge } from '@/components/atoms/Badge';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Button } from '@/components/atoms/Button';
import { StatCard } from '@/components/atoms/StatCard';
import { TypeChip } from '@/components/atoms/TypeChip';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { BudgetPanel } from '@/components/organisms/accounting/panels/BudgetPanel';
import { cardClass } from '@/lib/utils';
import { formatDateRange } from '@/lib/formatters';
import {
  BUDGET_PERIOD_LABELS,
  BUDGET_SCOPE_LABELS,
  BUDGET_STATUS_LABELS,
} from '@/lib/accounting/budgetPeriod';
import { BudgetStatus, GLAccountCategory } from '@/types/accounting';
import { useBudget } from '@/hooks';

const STATUS_VARIANT: Record<BudgetStatus, 'neutral' | 'success' | 'info'> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  CLOSED: 'info',
};

/** Filter value for lines with no cost centre. */
const COMPANY_WIDE = '__company__';

function fmt(amount: number, currency: string) {
  return `${currency ? `${currency} ` : ''}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type AnalysisRow = {
  id: string;
  accountCode: string;
  accountName: string;
  category: GLAccountCategory;
  costCentre: string | null;
  currency: string;
  budgeted: number;
  actual: number | null;
  variance: number | null;
  variancePct: number | null;
  /** true = under expense / over income; false = the reverse; null = no actuals yet. */
  favorable: boolean | null;
};

function AmountCell({ amount, currency }: { amount: number | null; currency: string }) {
  if (amount == null) return <span className="text-gray-400">—</span>;
  return <span className="text-xs font-semibold text-gray-700">{fmt(amount, currency)}</span>;
}

/** Builds StatCard props for an actual-vs-budgeted comparison. */
function budgetVsActual(
  label: string,
  budgeted: number,
  actual: number,
  currency: string,
  favorable: 'higher' | 'lower',
) {
  const diff = actual - budgeted;
  const pct = budgeted !== 0 ? (actual / budgeted) * 100 : null;
  const isGood = favorable === 'higher' ? diff >= 0 : diff <= 0;
  return {
    label,
    value: (
      <span className="text-lg font-bold">
        {fmt(actual, currency)}
        <span className="text-xs font-semibold text-gray-400"> / {fmt(budgeted, currency)}</span>
      </span>
    ),
    delta: `${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff), currency)}`,
    deltaTone: (isGood ? 'positive' : 'negative') as 'positive' | 'negative',
    deltaNote: pct != null ? `${pct.toFixed(0)}% of budget` : undefined,
  };
}

const ANALYSIS_COLUMNS: Column<AnalysisRow>[] = [
  {
    key: 'account',
    label: 'Account',
    width: 'minmax(220px, 1fr)',
    render: (row) => (
      <span className="font-semibold text-gray-700">
        <span className="font-semibold text-gray-400">{row.accountCode}</span> {row.accountName}
      </span>
    ),
  },
  {
    key: 'costCentre',
    label: 'Cost Centre',
    width: '170px',
    render: (row) =>
      row.costCentre ? (
        <span className="text-sm text-gray-700">{row.costCentre}</span>
      ) : (
        <span className="text-sm text-gray-400">Company-wide</span>
      ),
  },
  {
    key: 'category',
    label: 'Type',
    width: '110px',
    render: (row) => (
      <TypeChip
        label={row.category === 'EXPENSE' ? 'Expense' : 'Income'}
        color={row.category === 'EXPENSE' ? 'amber' : 'green'}
      />
    ),
  },
  {
    key: 'budgeted',
    label: 'Budgeted',
    width: '160px',
    className: 'text-right',
    render: (row) => (
      <span className="text-xs font-semibold text-gray-700">{fmt(row.budgeted, row.currency)}</span>
    ),
  },
  {
    key: 'actual',
    label: 'Actual',
    width: '160px',
    className: 'text-right',
    render: (row) => <AmountCell amount={row.actual} currency={row.currency} />,
  },
  {
    key: 'variance',
    label: 'Variance',
    width: '160px',
    className: 'text-right',
    render: (row) => {
      if (row.variance == null) return <span className="font-semibold text-gray-400">—</span>;
      return (
        <span className={`font-medium ${row.favorable ? 'text-green-600' : 'text-red-600'}`}>
          {row.variance >= 0 ? '+' : '−'}
          {fmt(Math.abs(row.variance), row.currency)}
        </span>
      );
    },
  },
  {
    key: 'variancePct',
    label: 'Variance %',
    width: '120px',
    className: 'text-right',
    render: (row) =>
      row.variancePct == null ? (
        <span className="font-semibold text-gray-400">—</span>
      ) : (
        <span className="font-semibold text-gray-500">
          {row.variancePct >= 0 ? '+' : ''}
          {row.variancePct.toFixed(1)}%
        </span>
      ),
  },
];

export default function BudgetDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; budgetId: string }>;
}) {
  const { tenantSlug, budgetId } = use(params);
  const base = `/${tenantSlug}/accounting/budget-forecast`;

  const { data: budget, isLoading } = useBudget(budgetId);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [costCentreFilterChoice, setCostCentreFilter] = useState('');

  const costCentreOptions = useMemo(() => {
    if (!budget) return [];
    const seen = new Map<string, string>();
    for (const l of budget.lines) {
      if (l.costCentreId) seen.set(l.costCentreId, `${l.costCentreCode} – ${l.costCentreName}`);
    }
    const opts = [...seen].map(([value, label]) => ({ value, label }));
    if (budget.lines.some((l) => !l.costCentreId)) {
      opts.push({ value: COMPANY_WIDE, label: 'Company-wide (no cost centre)' });
    }
    return opts;
  }, [budget]);

  // A filter pointing at a cost centre that an edit has since removed falls back to "all".
  const costCentreFilter = costCentreOptions.some((o) => o.value === costCentreFilterChoice)
    ? costCentreFilterChoice
    : '';

  // The summary cards and the table both follow the cost-centre filter.
  const visibleLines = useMemo(() => {
    if (!budget) return [];
    if (!costCentreFilter) return budget.lines;
    return budget.lines.filter((l) =>
      costCentreFilter === COMPANY_WIDE ? !l.costCentreId : l.costCentreId === costCentreFilter,
    );
  }, [budget, costCentreFilter]);

  const summary = useMemo(() => {
    if (!budget) return null;
    const totalFor = (category: GLAccountCategory) =>
      visibleLines
        .filter((l) => l.category === category)
        .reduce(
          (acc, l) => ({
            budgeted: acc.budgeted + l.budgeted,
            actual: acc.actual + (l.actual ?? 0),
          }),
          { budgeted: 0, actual: 0 },
        );
    const income = totalFor('REVENUE');
    const expense = totalFor('EXPENSE');
    return {
      income,
      expense,
      net: {
        budgeted: income.budgeted - expense.budgeted,
        actual: income.actual - expense.actual,
      },
    };
  }, [budget, visibleLines]);

  const rows = useMemo<AnalysisRow[]>(() => {
    if (!budget) return [];
    return visibleLines.map((line) => {
      const variance = line.actual == null ? null : line.actual - line.budgeted;
      const variancePct =
        variance == null || line.budgeted === 0 ? null : (variance / line.budgeted) * 100;
      const favorable =
        variance == null ? null : line.category === 'EXPENSE' ? variance <= 0 : variance >= 0;
      return {
        id: `${line.accountId}:${line.costCentreId ?? ''}`,
        accountCode: line.accountCode,
        accountName: line.accountName,
        category: line.category,
        costCentre: line.costCentreId ? `${line.costCentreCode} – ${line.costCentreName}` : null,
        currency: budget.currency,
        budgeted: line.budgeted,
        actual: line.actual,
        variance,
        variancePct,
        favorable,
      };
    });
  }, [budget, visibleLines]);

  return (
    <div className="flex flex-col gap-6 py-6 pr-6 pl-(--page-pl) min-h-0 overflow-y-auto flex-1">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Budgets
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">{budget?.name ?? 'Budget'}</span>
      </nav>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !budget ? (
        <div
          className={cardClass('flex flex-col items-center justify-center gap-1 py-16 text-center')}
        >
          <p className="text-sm font-medium text-gray-700">Budget not found</p>
          <p className="text-xs text-gray-400">
            It may have been removed, or the link is incorrect.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">{budget.name}</h1>
                <Badge
                  label={BUDGET_STATUS_LABELS[budget.status]}
                  variant={STATUS_VARIANT[budget.status]}
                />
              </div>
              <p className="text-sm text-gray-500">
                {BUDGET_PERIOD_LABELS[budget.period]} ·{' '}
                {formatDateRange(budget.startDate, budget.endDate)} ·{' '}
                {BUDGET_SCOPE_LABELS[budget.scope]}
              </p>
            </div>
            {budget.status !== 'CLOSED' && (
              <Button variant="outline" onClick={() => setIsEditOpen(true)}>
                Edit Budget
              </Button>
            )}
          </div>

          {summary && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                {...budgetVsActual(
                  'Income',
                  summary.income.budgeted,
                  summary.income.actual,
                  budget.currency,
                  'higher',
                )}
              />
              <StatCard
                {...budgetVsActual(
                  'Expense',
                  summary.expense.budgeted,
                  summary.expense.actual,
                  budget.currency,
                  'lower',
                )}
              />
              <StatCard
                {...budgetVsActual(
                  'Net',
                  summary.net.budgeted,
                  summary.net.actual,
                  budget.currency,
                  'higher',
                )}
              />
            </div>
          )}

          <DataTable
            columns={ANALYSIS_COLUMNS}
            extraFilters={
              costCentreOptions.length > 0 ? (
                <SearchSelect
                  size="sm"
                  placeholder="Cost centre"
                  showAllOption
                  allLabel="All cost centres"
                  options={costCentreOptions}
                  value={costCentreFilter}
                  onChange={setCostCentreFilter}
                />
              ) : undefined
            }
            data={rows}
            emptyMessage="No budget lines"
            currentPage={1}
            totalPages={0}
            onPageChange={() => {}}
            noInternalScroll
          />

          <BudgetPanel isOpen={isEditOpen} budget={budget} onClose={() => setIsEditOpen(false)} />
        </>
      )}
    </div>
  );
}
