'use client';

import { useState } from 'react';
import { List, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, cardClass } from '@/lib/utils';
import { Button } from '@/components/atoms/Button';
import { Calendar } from '@/components/atoms/Calendar';
import { AppointmentTimeline } from '@/components/molecules/marketing/AppointmentTimeline';
import { AppointmentDayList } from '@/components/molecules/marketing/AppointmentDayList';
import { Appointment } from '@/components/molecules/marketing/AppointmentCard';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type View = 'timeline' | 'calendar';

const UPCOMING_LIMIT = 5;

interface Props {
  appointments: Appointment[];
  /** Called with the selected calendar day (if any) so the form can prefill its date. */
  onNew: (date?: string) => void;
}

export function AppointmentsPanel({ appointments, onNew }: Props) {
  const [view, setView] = useState<View>('calendar');
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | undefined>();

  const markedDates = appointments.map((a) => a.date);

  const todayIso = new Date().toLocaleDateString('en-CA');
  const upcoming = appointments
    .filter((a) => a.date >= todayIso)
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
    .slice(0, UPCOMING_LIMIT);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }

  return (
    <div className={cardClass('p-4 flex flex-col gap-4 flex-1 min-h-0')}>
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h2 className="text-lg font-bold text-gray-900">
          {view === 'timeline' ? 'Upcoming Appointments' : 'Appointments'}
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
          </div>
          <Button size="sm" onClick={() => onNew(view === 'calendar' ? selectedDate : undefined)}>
            New Appointment
          </Button>
        </div>
      </div>

      {view === 'timeline' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AppointmentTimeline appointments={upcoming} />
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
            />
          </div>

          <div className="min-h-0 md:overflow-y-auto">
            <AppointmentDayList
              date={selectedDate}
              appointments={
                selectedDate ? appointments.filter((a) => a.date === selectedDate) : appointments
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
