'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import {
  TransportListCard,
  type TransportListItem,
} from '@/components/molecules/marketing/TransportListCard';
import { useAppointments } from '@/hooks/marketing/useAppointments';
import { formatClock, formatTravelDate } from '@/lib/requestOptions';

/** Today as YYYY-MM-DD in the viewer's timezone. */
const today = () => new Date().toLocaleDateString('en-CA');

interface Props {
  /** Whose appointments to list: those they are booked for or manage. */
  userId: string;
  className?: string;
}

/** The user's pending and approved appointments from today on, soonest first. */
export function MyAppointmentsCard({ userId, className }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data, isLoading, isError } = useAppointments({
    from: today(),
    status: ['PENDING', 'APPROVED'],
  });

  const mine = useMemo(
    () =>
      (data ?? []).filter(
        (appointment) =>
          appointment.marketerUserId === userId || appointment.managerUserId === userId,
      ),
    [data, userId],
  );
  const items = useMemo<TransportListItem[]>(
    () =>
      mine.map((appointment) => ({
        id: appointment.id,
        icon: CalendarClock,
        color: '#1baf7a',
        title: appointment.prospectName,
        detail: appointment.status === 'PENDING' ? 'Awaiting approval' : undefined,
        trailing: `${formatTravelDate(appointment.date)}, ${formatClock(appointment.startTime)}`,
      })),
    [mine],
  );

  return (
    <TransportListCard
      title="Upcoming Appointments"
      subtitle="Soonest first"
      count={mine.length}
      items={items}
      isLoading={isLoading}
      isError={isError}
      emptyText="No upcoming appointments."
      errorText="Appointments could not be loaded."
      action={{ href: `/${tenantSlug}/marketing/appointments`, label: 'View all' }}
      className={className}
    />
  );
}
