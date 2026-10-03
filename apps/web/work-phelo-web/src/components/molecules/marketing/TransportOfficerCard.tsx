'use client';

import { DataCard, DataCardAction, DataCardDetail } from '@/components/organisms/shared/DataCard';
import { Avatar } from '@/components/atoms/Avatar';
import { OFFICER_STATUS_STYLES } from '@/lib/fleetOptions';
import { formatClock, formatTravelDate } from '@/lib/requestOptions';
import { cn } from '@/lib/utils';
import type { TransportOfficer } from '@/types/marketing';

interface Props {
  officer: TransportOfficer;
  /** Opens the list of this officer's booked trips. */
  onViewTrips?: () => void;
  /** Omit to hide the action (e.g. when the user lacks the edit permission). */
  onToggleActive?: () => void;
}

const value = (text: string | null | undefined, className = 'text-gray-700') => (
  <span className={cn('text-xs font-semibold truncate max-w-[65%] text-right', className)}>
    {text ?? '—'}
  </span>
);

export function TransportOfficerCard({ officer, onViewTrips, onToggleActive }: Props) {
  const badge = OFFICER_STATUS_STYLES[officer.status];

  const actions: DataCardAction[] = [];
  // Someone who left HR can't drive again, so only offer reactivating current employees.
  if (onToggleActive && (officer.isActive || officer.employeeActive)) {
    actions.push(
      officer.isActive
        ? {
            label: 'Deactivate',
            onClick: onToggleActive,
            className: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
          }
        : {
            label: 'Reactivate',
            onClick: onToggleActive,
            className: 'bg-green-50 text-green-600 hover:bg-green-100',
          },
    );
  }

  const nextTrip = officer.trips[0];
  const details: DataCardDetail[] = [
    { label: 'Department', value: value(officer.department) },
    { label: 'Email', value: value(officer.email) },
    ...(nextTrip
      ? [
          {
            label: nextTrip.overdue
              ? 'Overdue'
              : nextTrip.state === 'ON_ROUTE'
                ? 'On route'
                : 'Next trip',
            value: value(
              `${nextTrip.destination} · ${formatTravelDate(nextTrip.travelDate)} ${formatClock(nextTrip.departureTime)}–${formatClock(nextTrip.returnTime)}`,
              nextTrip.overdue
                ? 'text-amber-600'
                : nextTrip.state === 'ON_ROUTE'
                  ? 'text-blue-600'
                  : 'text-violet-600',
            ),
          },
          ...(officer.tripCount > 1
            ? [{ label: 'Booked trips', value: value(String(officer.tripCount)) }]
            : []),
        ]
      : []),
  ];

  return (
    <DataCard
      compact
      onClick={onViewTrips}
      className={cn(!officer.isActive && 'opacity-80')}
      icon={<Avatar name={officer.name} size="md" />}
      title={officer.name}
      subtitle={officer.jobTitle ?? undefined}
      badge={
        <span
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-semibold shrink-0',
            badge.bg,
            badge.text,
          )}
        >
          {badge.label}
        </span>
      }
      details={details}
      actions={actions}
    />
  );
}
