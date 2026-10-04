'use client';

import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import { formatAppointmentTime } from '@/lib/appointments';
import type { Appointment } from '@/types/marketing';

interface Props {
  appointments: Appointment[];
  isLoading?: boolean;
  onSelect?: (appointment: Appointment) => void;
}

export function AppointmentTimeline({ appointments, isLoading, onSelect }: Props) {
  if (isLoading && appointments.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">Loading...</p>;
  }

  if (appointments.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No upcoming appointments</p>;
  }

  return (
    <div className="relative">
      <div className="absolute left-1.5 top-3 bottom-3 w-0.5 bg-orange-500" />

      <div className="flex flex-col gap-5">
        {appointments.map((appt, i) => (
          <div key={appt.id} className="flex items-center gap-4">
            <span
              className={cn(
                'relative z-10 w-3.5 h-3.5 rounded-full border-2 shrink-0',
                i === 0 ? 'bg-brand border-brand' : 'bg-white border-gray-300',
              )}
            />
            <div
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onClick={() => onSelect?.(appt)}
              onKeyDown={(e) => {
                if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSelect(appt);
                }
              }}
              className={cn(
                'flex-1 flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 min-w-0 transition-shadow',
                onSelect && 'cursor-pointer hover:shadow-md',
              )}
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">{formatDate(appt.date)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatAppointmentTime(appt)}</p>
              </div>
              <span className="w-px h-8 bg-gray-200 shrink-0" />
              <div className="text-right min-w-0">
                <p className="text-sm text-gray-500 truncate">{appt.prospectName}</p>
                <p className="text-sm text-gray-500 mt-0.5 truncate">
                  {appt.marketerName}
                  {appt.managerName && ` · Mgr: ${appt.managerName}`}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
