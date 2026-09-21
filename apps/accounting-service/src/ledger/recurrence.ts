import { RecurrenceFrequency } from '../../prisma/generated/client';

const MONTHS_PER_FREQUENCY = {
  MONTHLY: 1,
  QUARTERLY: 3,
  ANNUALLY: 12,
} as const;

function parse(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return { year, month: month - 1, day };
}

const toIso = (date: Date) => date.toISOString().slice(0, 10);

/** Today as a calendar date (YYYY-MM-DD, UTC). */
export function isoDay(date: Date = new Date()): string {
  return toIso(date);
}

/** A calendar date (YYYY-MM-DD) as the UTC-midnight Date that a `@db.Date` column round-trips. */
export function dateOnly(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

/**
 * Adds one recurrence interval to a calendar date. Month-based intervals clamp to the last day
 * of shorter months (31 Jan + 1 month = 28/29 Feb), and stay anchored to `anchor` so a
 * template that started on the 31st runs on the 28th in February but the 31st again in March.
 */
export function addRecurrenceInterval(
  iso: string,
  frequency: RecurrenceFrequency,
  anchor: string = iso,
): string {
  const { year, month, day } = parse(iso);
  if (frequency === 'DAILY' || frequency === 'WEEKLY') {
    return toIso(
      new Date(Date.UTC(year, month, day + (frequency === 'DAILY' ? 1 : 7))),
    );
  }
  const anchorDay = parse(anchor).day;
  const target = month + MONTHS_PER_FREQUENCY[frequency];
  const lastDay = new Date(Date.UTC(year, target + 1, 0)).getUTCDate();
  return toIso(new Date(Date.UTC(year, target, Math.min(anchorDay, lastDay))));
}

/**
 * The next date a template will run: its start date while that is still upcoming, otherwise
 * the first occurrence on or after today (no backfilling of dates that already passed).
 */
export function calculateNextRunDate(
  startDate: string,
  frequency: RecurrenceFrequency,
  today: string = isoDay(),
): string {
  const anchor = startDate.slice(0, 10);
  let next = anchor;
  while (next < today) next = addRecurrenceInterval(next, frequency, anchor);
  return next;
}
