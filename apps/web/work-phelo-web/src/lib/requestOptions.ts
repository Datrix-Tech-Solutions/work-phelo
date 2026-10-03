import type { TransportRequestStatus } from '@/types/marketing';

export const REQUEST_STATUS_BADGES: Record<
  TransportRequestStatus,
  { label: string; variant: 'success' | 'danger' | 'warning' | 'neutral' }
> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

/** Active requests vs. ones that reached a dead end. */
export const ACTIVE_REQUEST_STATUSES: TransportRequestStatus[] = ['PENDING', 'APPROVED'];
export const HISTORY_REQUEST_STATUSES: TransportRequestStatus[] = ['REJECTED', 'CANCELLED'];

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
