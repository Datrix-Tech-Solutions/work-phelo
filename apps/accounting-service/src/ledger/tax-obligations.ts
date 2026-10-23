import { TaxPayFrequency } from '../../prisma/generated/client';

/*
 * When a tax is due. Plain dates in, plain dates out, so the same rules can run in a job that sends
 * the reminder by email later.
 *
 * A tax is paid for a period (a month, quarter or year) in the month after the period ends. Quarters
 * and years follow the fiscal year, so they start in the tenant's fiscal year start month.
 */

export interface TaxPeriod {
  /** First day of the period (local midnight). */
  start: Date;
  /** Last day of the period (local midnight). */
  end: Date;
}

export interface TaxSchedule {
  dueDay: number | null;
  dueOnLastDay: boolean;
  daysBefore: number;
}

const MONTHS_IN_PERIOD: Record<TaxPayFrequency, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const DAY_MS = 86_400_000;

/** Whole calendar days from `from` to `to`: positive when `to` is later. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS,
  );
}

/** The period that has most recently finished before `today`. */
export function latestCompletedPeriod(
  frequency: TaxPayFrequency,
  today: Date,
  fiscalYearStartMonth: number,
): TaxPeriod {
  const length = MONTHS_IN_PERIOD[frequency];
  // How many months into the fiscal year this month is (0 for its first month).
  const intoFiscalYear =
    (today.getMonth() + 1 - fiscalYearStartMonth + 12) % 12;
  const monthsIntoPeriod = intoFiscalYear % length;
  const currentStart = new Date(
    today.getFullYear(),
    today.getMonth() - monthsIntoPeriod,
    1,
  );
  return {
    start: new Date(
      currentStart.getFullYear(),
      currentStart.getMonth() - length,
      1,
    ),
    // Day 0 of the month is the last day of the one before.
    end: new Date(currentStart.getFullYear(), currentStart.getMonth(), 0),
  };
}

/** The day the tax for a period is due: in the month after it ends. */
export function dueDateFor(periodEnd: Date, schedule: TaxSchedule): Date {
  const year = periodEnd.getFullYear();
  const month = periodEnd.getMonth() + 1;
  if (schedule.dueOnLastDay || !schedule.dueDay) {
    return new Date(year, month + 1, 0);
  }
  return new Date(year, month, schedule.dueDay);
}

/** The first day the reminder shows. */
export function remindFrom(due: Date, schedule: TaxSchedule): Date {
  return new Date(
    due.getFullYear(),
    due.getMonth(),
    due.getDate() - schedule.daysBefore,
  );
}
