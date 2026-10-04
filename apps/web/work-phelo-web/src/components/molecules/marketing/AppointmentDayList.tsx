'use client';

import { Clock, User, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import { APPOINTMENT_STATUS_BADGES, formatAppointmentTime } from '@/lib/appointments';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { DataList, Column } from '@/components/organisms/shared/DataList';
import type { Appointment } from '@/types/marketing';

interface Props {
  /** ISO date. When omitted, every appointment is listed with its own date. */
  date?: string;
  /** Used in the heading and empty message when no day is selected, e.g. "Oct 2026". */
  periodLabel?: string;
  /** Replaces the default heading. */
  title?: string;
  emptyMessage?: string;
  appointments: Appointment[];
  isLoading?: boolean;
  onSelect?: (appointment: Appointment) => void;
}

export function AppointmentDayList({
  date,
  periodLabel,
  title,
  emptyMessage,
  appointments,
  isLoading,
  onSelect,
}: Props) {
  const sorted = [...appointments].sort((a, b) =>
    `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
  );

  const columns: Column<Appointment>[] = [
    {
      key: 'prospectName',
      label: 'Prospect',
      render: (appt) => {
        const badge = APPOINTMENT_STATUS_BADGES[appt.status];
        // Pending appointments are not confirmed yet, so they read as faded.
        const faded = appt.status === 'PENDING';
        return (
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(faded && 'opacity-50')}>
              <Avatar name={appt.prospectName} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p
                  className={cn(
                    'text-sm font-semibold text-gray-900 truncate',
                    faded && 'opacity-50',
                  )}
                >
                  {appt.prospectName}
                </p>
                <Badge label={badge.label} variant={badge.variant} />
                {appt.salesStage && <Badge label={appt.salesStage.name} variant="neutral" />}
              </div>
              <p
                className={cn(
                  'text-xs text-gray-400 mt-0.5 flex items-center gap-1',
                  faded && 'opacity-60',
                )}
              >
                <Clock size={12} className="shrink-0" />
                {!date && <span>{formatDate(appt.date)} ·</span>}
                {formatAppointmentTime(appt)}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'people',
      label: 'People',
      width: '11rem',
      className: 'flex flex-col items-end gap-1 text-sm text-gray-600',
      render: (appt) => (
        <div
          className={cn(
            'flex flex-col items-end gap-1 max-w-full',
            appt.status === 'PENDING' && 'opacity-50',
          )}
        >
          <p className="flex items-center gap-1 max-w-full" title="Marketer">
            <User size={14} className="shrink-0" />
            <span className="truncate">{appt.marketerName}</span>
          </p>
          {appt.managerName && (
            <p className="flex items-center gap-1 max-w-full" title="Manager">
              <UserCog size={14} className="shrink-0" />
              <span className="truncate">{appt.managerName}</span>
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <h3 className="text-sm font-bold text-gray-900">
        {date
          ? formatDate(date)
          : (title ?? `All appointments${periodLabel ? ` · ${periodLabel}` : ''}`)}
      </h3>

      <DataList
        columns={columns}
        data={sorted}
        isLoading={isLoading}
        onRowClick={onSelect}
        emptyMessage={
          date ? 'No appointments on this day' : (emptyMessage ?? 'No appointments yet')
        }
      />
    </div>
  );
}
