import type { RecurrenceFrequency } from '@/types/accounting';

const MONTHS_PER_FREQUENCY = { MONTHLY: 1, QUARTERLY: 3, ANNUALLY: 12 } as const;

function parse(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Adds one recurrence interval to an ISO (YYYY-MM-DD) date. Month-based intervals clamp to the
 *  last day of shorter months (31 Jan + 1 month = 28/29 Feb). */
export function addRecurrenceInterval(iso: string, frequency: RecurrenceFrequency): string {
  const { y, m, d } = parse(iso);
  if (frequency === 'DAILY' || frequency === 'WEEKLY') {
    return toIso(new Date(Date.UTC(y, m, d + (frequency === 'DAILY' ? 1 : 7))));
  }
  const target = m + MONTHS_PER_FREQUENCY[frequency];
  const lastDay = new Date(Date.UTC(y, target + 1, 0)).getUTCDate();
  return toIso(new Date(Date.UTC(y, target, Math.min(d, lastDay))));
}

/** The next date a recurring entry will generate: the start date while it is still upcoming,
 *  otherwise the first occurrence after today. */
export function calculateNextRunDate(
  startDate: string,
  frequency: RecurrenceFrequency,
  today: string = toIso(new Date()),
): string {
  let next = startDate;
  while (next < today) next = addRecurrenceInterval(next, frequency);
  return next;
}
