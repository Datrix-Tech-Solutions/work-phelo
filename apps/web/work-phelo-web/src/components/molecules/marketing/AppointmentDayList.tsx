'use client';

import { Clock, User, UserRoundPlus } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { Avatar } from '@/components/atoms/Avatar';
import { DataList, Column } from '@/components/organisms/shared/DataList';
import {
  Appointment,
  formatAppointmentTime,
} from '@/components/molecules/marketing/AppointmentCard';

interface Props {
  /** ISO date. When omitted, every appointment is listed with its own date. */
  date?: string;
  appointments: Appointment[];
  onSelect?: (appointment: Appointment) => void;
}

export function AppointmentDayList({ date, appointments, onSelect }: Props) {
  const sorted = [...appointments].sort((a, b) =>
    `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`),
  );

  const columns: Column<Appointment>[] = [
    {
      key: 'prospectName',
      label: 'Prospect',
      render: (appt) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={appt.prospectName} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{appt.prospectName}</p>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <Clock size={12} className="shrink-0" />
              {!date && <span>{formatDate(appt.date)} ·</span>}
              {formatAppointmentTime(appt)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'people',
      label: 'People',
      width: '11rem',
      className: 'flex flex-col items-end gap-1 text-sm text-gray-600',
      render: (appt) => (
        <>
          <p className="flex items-center gap-1 max-w-full" title="Marketer">
            <User size={16} className="shrink-0" />
            <span className="font-semibold truncate">{appt.marketer}</span>
          </p>
          {appt.manager && (
            <p className="flex items-center gap-1 text-gray-400 max-w-full" title="Manager">
              <UserRoundPlus size={14} className="shrink-0" />
              <span className="font-semibold truncate">{appt.manager}</span>
            </p>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <h3 className="text-sm font-bold text-gray-900">
        {date ? formatDate(date) : 'All appointments'}
      </h3>

      <DataList
        columns={columns}
        data={sorted}
        onRowClick={onSelect}
        emptyMessage={date ? 'No appointments on this day' : 'No appointments yet'}
      />
    </div>
  );
}
