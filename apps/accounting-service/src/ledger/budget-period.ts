import { BudgetPeriod } from '../../prisma/generated/client';

const PERIOD_MONTHS: Record<BudgetPeriod, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` → that calendar day at UTC midnight, or null if it isn't a real date. */
export function parseBudgetDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value ? date : null;
}

/**
 * Inclusive last day of a budget: one period after `start`, minus a day. A monthly budget
 * starting 2026-01-01 ends 2026-01-31, a quarterly one 2026-03-31. A start day that does not
 * exist in the target month (e.g. the 31st) is clamped to that month's last day.
 */
export function budgetEndDate(period: BudgetPeriod, start: Date): Date {
  const month = start.getUTCMonth() + PERIOD_MONTHS[period];
  const year = start.getUTCFullYear();
  const lastDayOfTargetMonth = new Date(
    Date.UTC(year, month + 1, 0),
  ).getUTCDate();
  const nextPeriodStart = new Date(
    Date.UTC(year, month, Math.min(start.getUTCDate(), lastDayOfTargetMonth)),
  );
  return new Date(nextPeriodStart.getTime() - DAY_MS);
}

/** Exclusive upper bound for "on or before `endDate`" comparisons against timestamps. */
export function dayAfter(date: Date): Date {
  return new Date(date.getTime() + DAY_MS);
}

/** `YYYY-MM-DD` for a date-only value. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
