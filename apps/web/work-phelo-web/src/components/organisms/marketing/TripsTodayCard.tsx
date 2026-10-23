'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { CalendarClock, Route } from 'lucide-react';
import type { Period } from '@/components/atoms/PeriodToggle';
import {
  TransportListCard,
  type TransportListItem,
} from '@/components/molecules/marketing/TransportListCard';
import { useTransportDashboard } from '@/hooks/marketing/useTransportDashboard';
import { formatWindow } from '@/lib/requestOptions';

interface Props {
  period: Period;
  year: number;
  className?: string;
}

/** Today's approved trips, earliest first. A live list, so it ignores the period filter. */
export function TripsTodayCard({ period, year, className }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { data, isLoading, isError } = useTransportDashboard(period, year);

  const items = useMemo<TransportListItem[]>(
    () =>
      (data?.tripsToday ?? []).map((trip) => ({
        id: trip.requestId,
        icon: trip.state === 'ON_ROUTE' ? Route : CalendarClock,
        color: trip.overdue ? '#e34948' : trip.state === 'ON_ROUTE' ? '#2a78d6' : '#7c3aed',
        title: `${trip.requesterName} · ${trip.destination}`,
        detail: [
          trip.vehicleName,
          trip.selfDriven ? 'Self-driven' : trip.driverName,
          formatWindow(trip.departureTime, trip.returnTime),
        ]
          .filter(Boolean)
          .join(' · '),
        trailing: trip.overdue ? 'Overdue' : trip.state === 'ON_ROUTE' ? 'On route' : 'Booked',
        trailingTone: trip.overdue ? ('red' as const) : undefined,
      })),
    [data],
  );

  return (
    <TransportListCard
      title="Trips Today"
      subtitle="Approved trips still to finish"
      count={data?.kpis.tripsToday}
      items={items}
      isLoading={isLoading}
      isError={isError}
      emptyText="No trips today."
      errorText="Today's trips could not be loaded."
      action={{ href: `/${tenantSlug}/marketing/requests/all-requests`, label: 'View all' }}
      className={className}
    />
  );
}
