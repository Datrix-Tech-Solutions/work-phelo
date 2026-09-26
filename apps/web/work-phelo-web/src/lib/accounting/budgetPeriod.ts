import { BudgetPeriod, BudgetScope, BudgetStatus } from '@/types/accounting';

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

export const BUDGET_SCOPE_LABELS: Record<BudgetScope, string> = {
  EXPENSE: 'Expense only',
  INCOME: 'Income only',
  BOTH: 'Income & Expense',
};

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
};

const PERIOD_MONTHS: Record<BudgetPeriod, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

/**
 * Inclusive end date for a budget: start + one period, minus a day.
 * A monthly budget starting 2026-01-01 ends 2026-01-31; quarterly ends 2026-03-31.
 */
export function budgetPeriodEnd(period: BudgetPeriod, startDate: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return startDate;
  const end = new Date(start);
  end.setMonth(end.getMonth() + PERIOD_MONTHS[period]);
  end.setDate(end.getDate() - 1);
  return end.toISOString().slice(0, 10);
}
