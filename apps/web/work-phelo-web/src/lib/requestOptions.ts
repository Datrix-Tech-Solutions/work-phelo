import type { TransportRequestStatus } from '@/types/marketing';

export const REQUEST_STATUS_BADGES: Record<
  TransportRequestStatus,
  { label: string; variant: 'success' | 'info' | 'danger' | 'warning' | 'neutral' }
> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  ON_ROUTE: { label: 'On route', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

/** Requests still in play (waiting, approved or out on a trip) vs. ones that are over. */
export const ACTIVE_REQUEST_STATUSES: TransportRequestStatus[] = [
  'PENDING',
  'APPROVED',
  'ON_ROUTE',
];
export const HISTORY_REQUEST_STATUSES: TransportRequestStatus[] = [
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];

/** "YYYY-MM-DD" → "20 Oct 2026", read as a calendar date so timezones can't shift it. */
export function formatTravelDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** "08:30" → "08:30 AM" */
export function formatClock(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${String(hours % 12 || 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** How a trip's real return compares with the planned one, e.g. "40 min late". */
export function describeReturn(minutesLate: number | null): string | null {
  if (minutesLate === null) return null;
  if (minutesLate === 0) return 'On time';
  const abs = Math.abs(minutesLate);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const amount = [hours ? `${hours} hr` : '', minutes ? `${minutes} min` : '']
    .filter(Boolean)
    .join(' ');
  return minutesLate > 0 ? `${amount} late` : `${amount} early`;
}

/** Whole minutes from one HH:mm to another on the same day (negative if `to` is earlier). */
export function minutesBetween(from: string, to: string): number {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  return toMinutes(to) - toMinutes(from);
}
