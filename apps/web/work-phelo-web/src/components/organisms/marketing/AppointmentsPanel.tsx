'use client';

import { useState } from 'react';
import {
  List,
  Calendar as CalendarIcon,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn, cardClass } from '@/lib/utils';
import { Button } from '@/components/atoms/Button';
import { Calendar } from '@/components/atoms/Calendar';
import { AppointmentTimeline } from '@/components/molecules/marketing/AppointmentTimeline';
import { AppointmentDayList } from '@/components/molecules/marketing/AppointmentDayList';
import { useAppointments } from '@/hooks/marketing/useAppointments';
import { CALENDAR_APPOINTMENT_STATUSES, LIVE_APPOINTMENT_STATUSES } from '@/lib/appointments';
import type { Appointment, AppointmentStatus } from '@/types/marketing';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type View = 'timeline' | 'calendar' | 'requests';

const UPCOMING_LIMIT = 5;
const PENDING_STATUSES: AppointmentStatus[] = ['PENDING'];

interface Props {
  /** Called with the selected calendar day (if any) so the form can prefill its date. */
  onNew: (date?: string) => void;
  onSelectAppointment?: (appointment: Appointment) => void;
}

export function AppointmentsPanel({ onNew, onSelectAppointment }: Props) {
  const [view, setView] = useState<View>('calendar');
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | undefined>();

  const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
  const monthEnd = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(
    new Date(viewYear, viewMonth + 1, 0).getDate(),
  ).padStart(2, '0')}`;

  // The calendar loads the month on screen; the timeline loads the next few from today.
  const { data: monthAppointments = [], isLoading: monthLoading } = useAppointments({
    from: monthStart,
    to: monthEnd,
    status: CALENDAR_APPOINTMENT_STATUSES,
  });
  const { data: upcoming = [], isLoading: upcomingLoading } = useAppointments({
    from: today.toLocaleDateString('en-CA'),
    status: LIVE_APPOINTMENT_STATUSES,
    limit: UPCOMING_LIMIT,
  });

  // Everything still waiting for approval: an approver sees all of it, anyone else their own.
  const { data: pendingRequests = [], isLoading: pendingLoading } = useAppointments({
    status: PENDING_STATUSES,
  });

  // A day with only pending appointments gets a fainter dot than a confirmed one.
  const confirmedDates = new Set(
    monthAppointments.filter((a) => a.status !== 'PENDING').map((a) => a.date),
  );
  const markedDates = [...confirmedDates];
  const tentativeDates = monthAppointments
    .filter((a) => a.status === 'PENDING' && !confirmedDates.has(a.date))
    .map((a) => a.date);

  function prevMonth() {
    setSelectedDate(undefined);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    setSelectedDate(undefined);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }

  return (
    <div className={cardClass('p-4 flex flex-col gap-4 flex-1 min-h-0')}>
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h2 className="text-lg font-bold text-gray-900">
          {view === 'timeline'
            ? 'Upcoming Appointments'
            : view === 'requests'
              ? 'Awaiting Approval'
              : 'Appointments'}
        </h2>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
            <button
              type="button"
              onClick={() => setView('timeline')}
              aria-label="Timeline view"
              aria-pressed={view === 'timeline'}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                view === 'timeline'
                  ? 'bg-white shadow-sm text-(--module-btn-bg,var(--color-brand))'
                  : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('calendar')}
              aria-label="Calendar view"
              aria-pressed={view === 'calendar'}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                view === 'calendar'
                  ? 'bg-white shadow-sm text-(--module-btn-bg,var(--color-brand))'
                  : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('requests')}
              aria-label={`Awaiting approval (${pendingRequests.length})`}
              aria-pressed={view === 'requests'}
              className={cn(
                'relative p-1.5 rounded-md transition-colors',
                view === 'requests'
                  ? 'bg-white shadow-sm text-(--module-btn-bg,var(--color-brand))'
                  : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <ClipboardCheck className="w-4 h-4" />
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] font-semibold leading-4 text-center">
                  {pendingRequests.length > 99 ? '99+' : pendingRequests.length}
                </span>
              )}
            </button>
          </div>
          <Button size="sm" onClick={() => onNew(view === 'calendar' ? selectedDate : undefined)}>
            New Appointment
          </Button>
        </div>
      </div>

      {view === 'requests' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AppointmentDayList
            title="Waiting for approval"
            emptyMessage="Nothing is waiting for approval"
            appointments={pendingRequests}
            isLoading={pendingLoading}
            onSelect={onSelectAppointment}
          />
        </div>
      ) : view === 'timeline' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AppointmentTimeline
            appointments={upcoming}
            isLoading={upcomingLoading}
            onSelect={onSelectAppointment}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(280px,380px)_1fr] gap-6 content-start md:content-stretch flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
          <div className="md:self-start">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-sm font-bold text-gray-900">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <Calendar
              viewYear={viewYear}
              viewMonth={viewMonth}
              value={selectedDate}
              onSelectDay={(iso) => setSelectedDate((prev) => (prev === iso ? undefined : iso))}
              markedDates={markedDates}
              tentativeDates={tentativeDates}
            />
          </div>

          <div className="min-h-0 md:overflow-y-auto">
            <AppointmentDayList
              date={selectedDate}
              periodLabel={`${MONTHS[viewMonth]} ${viewYear}`}
              isLoading={monthLoading}
              onSelect={onSelectAppointment}
              appointments={
                selectedDate
                  ? monthAppointments.filter((a) => a.date === selectedDate)
                  : monthAppointments
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
