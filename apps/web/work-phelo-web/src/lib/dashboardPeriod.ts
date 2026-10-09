import { periodWindow, type Period } from '@/components/atoms/PeriodToggle';

const DAY_MS = 86_400_000;

const toIso = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const daysBetween = (from: Date, to: Date) =>
  Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      DAY_MS,
  );

export interface DashboardRanges {
  fromDate: string;
  toDate: string;
  prevFromDate: string;
  prevToDate: string;
}

/**
 * Report date ranges for the dashboard's period filter, plus the range it is compared with.
 * The previous range covers the same number of elapsed days as the current one (1–9 March
 * against 1–9 February), so a half-finished period is not measured against a whole one. It
 * never runs past the day before the current period starts.
 */
export function dashboardRanges(period: Period, year: number): DashboardRanges {
  const { start, end, prevStart } = periodWindow(period, { year });
  const dayBeforeStart = addDays(start, -1);
  const prevEnd = addDays(prevStart, daysBetween(start, end));

  return {
    fromDate: toIso(start),
    toDate: toIso(end),
    prevFromDate: toIso(prevStart),
    prevToDate: toIso(prevEnd > dayBeforeStart ? dayBeforeStart : prevEnd),
  };
}

/** Percentage change from `previous` to `current`, or undefined when there is no base to compare to. */
export function percentChange(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined;
  return ((current - previous) / Math.abs(previous)) * 100;
}
