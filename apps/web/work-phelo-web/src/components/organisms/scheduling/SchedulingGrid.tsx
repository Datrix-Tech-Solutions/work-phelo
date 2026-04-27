'use client';

import { cn } from '@/lib/utils';
import { Employee } from '@/types/hr';
import { ShiftSchedule } from '@/types/scheduling';
import { WEEKDAYS, addDays, toISODate } from '@/components/molecules/scheduling/WeekSelector';
import { SchedulingGridCell } from '@/components/molecules/scheduling/SchedulingGridCell';

interface Props {
  employees: Employee[];
  weekStart: Date;
  weekDates: string[];
  shiftsByKey: Record<string, ShiftSchedule[]>;
  canManage: boolean;
  onAddShift: (employeeId: string, date: string) => void;
  onOpenDetail: (schedule: ShiftSchedule, date: string) => void;
}

export function SchedulingGrid({
  employees,
  weekStart,
  weekDates,
  shiftsByKey,
  canManage,
  onAddShift,
  onOpenDetail,
}: Props) {
  const today = toISODate(new Date());

  return (
    <div
      className="border border-gray-200 rounded-card bg-white shadow-sm overflow-hidden"
      style={{ minWidth: 760 }}
    >
      {/* Header row */}
      <div
        className="grid bg-gray-50 border-b border-gray-200"
        style={{ gridTemplateColumns: '180px repeat(5, 1fr)' }}
      >
        <div className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
          Employee
        </div>
        {WEEKDAYS.map(({ label, isoDay }) => {
          const dayDate = addDays(weekStart, isoDay - 1);
          const isToday = toISODate(dayDate) === today;
          return (
            <div key={label} className="px-4 py-3.5 text-center border-l border-gray-200">
              <span
                className={cn(
                  'text-xs font-semibold tracking-wider',
                  isToday ? 'text-brand' : 'text-gray-500',
                )}
              >
                {label} {dayDate.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Employee rows */}
      {employees.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">No employees found</div>
      ) : (
        employees.map((emp) => (
          <div
            key={emp.id}
            className="grid border-t border-gray-100"
            style={{ gridTemplateColumns: '180px repeat(5, 1fr)' }}
          >
            <div className="px-5 py-4 flex items-start sticky left-0 bg-white z-10 border-r border-gray-100">
              <span className="text-sm text-gray-800 font-medium leading-snug">
                {emp.firstName} {emp.lastName}
              </span>
            </div>

            {weekDates.map((date) => (
              <SchedulingGridCell
                key={date}
                shifts={shiftsByKey[`${emp.id}-${date}`] ?? []}
                canManage={canManage}
                onAddShift={() => onAddShift(emp.id, date)}
                onOpenDetail={(s) => onOpenDetail(s, date)}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
