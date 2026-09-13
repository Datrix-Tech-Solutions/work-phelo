'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { StatCard } from '@/components/atoms/StatCard';
import { TypeChip } from '@/components/atoms/TypeChip';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { BudgetPanel } from '@/components/organisms/accounting/panels/BudgetPanel';
import { cardClass } from '@/lib/utils';
import { formatDateRange } from '@/lib/formatters';
import {
  BUDGET_PERIOD_LABELS,
  BUDGET_SCOPE_LABELS,
  BUDGET_STATUS_LABELS,
} from '@/lib/accounting/budgetPeriod';
import { BudgetDetail, BudgetStatus, GLAccountCategory } from '@/types/accounting';

const STATUS_VARIANT: Record<BudgetStatus, 'neutral' | 'success' | 'info'> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  CLOSED: 'info',
};

// TODO: replace with useBudget(budgetId) once the budgets API is ready.
const MOCK_DETAIL: BudgetDetail | null = {
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
  lines: [
    {
      accountId: 'acc-4000',
      accountCode: '4000',
      accountName: 'Premium Income',
      category: 'REVENUE',
      budgeted: 500000,
      actual: 421500,
    },
    {
      accountId: 'acc-4100',
      accountCode: '4100',
      accountName: 'Commission Income',
      category: 'REVENUE',
      budgeted: 80000,
      actual: 90800,
    },
    {
      accountId: 'acc-6000',
      accountCode: '6000',
      accountName: 'Salaries & Wages',
      category: 'EXPENSE',
      budgeted: 220000,
      actual: 205400,
    },
    {
      accountId: 'acc-6100',
      accountCode: '6100',
      accountName: 'Office Rent',
      category: 'EXPENSE',
      budgeted: 60000,
      actual: 60000,
    },
    {
      accountId: 'acc-6200',
      accountCode: '6200',
      accountName: 'Marketing & Advertising',
      category: 'EXPENSE',
      budgeted: 45000,
      actual: 52300,
    },
    {
      accountId: 'acc-6300',
      accountCode: '6300',
      accountName: 'Utilities',
      category: 'EXPENSE',
      budgeted: 15000,
      actual: null,
    },
  ],
};

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
        <span className="font-semibold text-gray-400">{row.accountCode}</span>  {row.accountName}
      </span>
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
    render: (row) => <span className="text-xs font-semibold text-gray-700">{fmt(row.budgeted, row.currency)}</span>,
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
        <span
          className={`font-medium ${row.favorable ? 'text-green-600' : 'text-red-600'}`}
        >
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
  const { tenantSlug } = use(params);
  const base = `/${tenantSlug}/accounting/budget-forecast`;

  const budget = MOCK_DETAIL;
  const [isEditOpen, setIsEditOpen] = useState(false);

  const summary = useMemo(() => {
    if (!budget) return null;
    const totalFor = (category: GLAccountCategory) =>
      budget.lines
        .filter((l) => l.category === category)
        .reduce(
          (acc, l) => ({ budgeted: acc.budgeted + l.budgeted, actual: acc.actual + (l.actual ?? 0) }),
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
  }, [budget]);

  const rows = useMemo<AnalysisRow[]>(() => {
    if (!budget) return [];
    return budget.lines.map((line) => {
      const variance = line.actual == null ? null : line.actual - line.budgeted;
      const variancePct =
        variance == null || line.budgeted === 0 ? null : (variance / line.budgeted) * 100;
      const favorable =
        variance == null ? null : line.category === 'EXPENSE' ? variance <= 0 : variance >= 0;
      return {
        id: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        category: line.category,
        currency: budget.currency,
        budgeted: line.budgeted,
        actual: line.actual,
        variance,
        variancePct,
        favorable,
      };
    });
  }, [budget]);

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Budgets
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">{budget?.name ?? 'Budget'}</span>
      </nav>

      {!budget ? (
        <div
          className={cardClass('flex flex-col items-center justify-center gap-1 py-16 text-center')}
        >
          <p className="text-sm font-medium text-gray-700">Budget analysis coming soon</p>
          <p className="text-xs text-gray-400">
            This page will show budgeted vs. actual by account once the budgets API is wired in.
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
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              Edit Budget
            </Button>
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
              data={rows}
              emptyMessage="No budget lines"
              currentPage={1}
              totalPages={0}
              onPageChange={() => {}}
              noInternalScroll
            />

          <BudgetPanel
            isOpen={isEditOpen}
            budget={budget}
            onClose={() => setIsEditOpen(false)}
          />
        </>
      )}
    </div>
  );
}
