import type { Appointment, AppointmentStatus } from '@/types/marketing';
import type { BadgeProps } from '@/components/atoms/Badge';

export const APPOINTMENT_STATUS_BADGES: Record<
  AppointmentStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
};

/** Statuses that still mean "this is on the diary". */
export const LIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ['PENDING', 'APPROVED'];

/** Statuses the calendar shows: everything except appointments that will not happen. */
export const CALENDAR_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'PENDING',
  'APPROVED',
  'COMPLETED',
];

/** "09:00 – 10:00", or just "09:00" when no end time was set. */
export function formatAppointmentTime(appt: Pick<Appointment, 'startTime' | 'endTime'>): string {
  return appt.endTime ? `${appt.startTime} – ${appt.endTime}` : appt.startTime;
}
