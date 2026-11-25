'use client';

import { cn, cardClass } from '@/lib/utils';
import { Employee } from '@/types/hr';
import { ShiftSchedule } from '@/types/scheduling';
import { WEEKDAYS, toISODate } from '@/components/molecules/hr/scheduling/WeekSelector';
import { getSchedulingGridLayout } from '@/components/molecules/hr/scheduling/schedulingGridLayout';
import { SchedulingGridCell } from '@/components/molecules/hr/scheduling/SchedulingGridCell';

interface Props {
  employees: Employee[];
  days: Date[];
  /** Narrow day columns, used by the month view. */
  compact?: boolean;
  shiftsByKey: Record<string, ShiftSchedule[]>;
  canManage: boolean;
  onAddShift: (employeeId: string, date: string) => void;
  onOpenDetail: (schedule: ShiftSchedule, date: string) => void;
}

function OnLeaveCell({ isToday, compact }: { isToday: boolean; compact: boolean }) {
  return (
    <div
      className={cn(
        'border-l border-gray-100 min-h-20 flex items-center justify-center opacity-60',
        compact ? 'p-1' : 'p-3',
        isToday ? 'bg-blue-50' : 'bg-gray-50/80',
      )}
    >
      <span className="text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        {compact ? 'Leave' : 'On Leave'}
      </span>
    </div>
  );
}

export function SchedulingGrid({
  employees,
  days,
  compact = false,
  shiftsByKey,
  canManage,
  onAddShift,
  onOpenDetail,
}: Props) {
  const today = toISODate(new Date());

  const { gridTemplateColumns, minWidth } = getSchedulingGridLayout(days.length);

  return (
    // overflow-clip, not overflow-hidden: hidden would make the card a scroll
    // container and stop the employee column from sticking while days scroll.
    <div className={cardClass('overflow-clip')} style={{ minWidth }}>
      {/* Header row */}
      <div className="grid bg-gray-50 border-b border-gray-200" style={{ gridTemplateColumns }}>
        <div className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r border-gray-100">
          Employee
        </div>
        {days.map((day) => {
          const dateStr = toISODate(day);
          const isToday = dateStr === today;
          const isPast = dateStr < today;
          return (
            <div
              key={dateStr}
              className={cn(
                'py-3.5 text-center border-l border-gray-200',
                compact ? 'px-1' : 'px-4',
                isToday && 'bg-blue-300',
                isPast && 'bg-gray-50',
              )}
            >
              <span
                className={cn(
                  'text-xs font-semibold tracking-wider',
                  isToday ? 'text-brand' : isPast ? 'text-gray-400' : 'text-gray-500',
                )}
              >
                {WEEKDAYS[day.getDay()].label} {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Employee rows */}
      {employees.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">No employees found</div>
      ) : (
        employees.map((emp) => {
          const isOnLeave = emp.employmentStatus === 'ON_LEAVE';
          return (
            <div
              key={emp.id}
              className="grid border-t border-gray-100"
              style={{ gridTemplateColumns }}
            >
              <div className="px-5 py-4 flex items-center gap-2 sticky left-0 bg-gray-50 z-10 border-r border-gray-100">
                <span
                  className={cn(
                    'text-sm font-medium leading-snug',
                    isOnLeave ? 'text-gray-400' : 'text-gray-800',
                  )}
                >
                  {emp.firstName} {emp.lastName}
                </span>
                {isOnLeave && (
                  <span className="shrink-0 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                    Leave
                  </span>
                )}
              </div>

              {days.map((day) => {
                const date = toISODate(day);
                return isOnLeave ? (
                  <OnLeaveCell key={date} isToday={date === today} compact={compact} />
                ) : (
                  <SchedulingGridCell
                    key={date}
                    shifts={shiftsByKey[`${emp.id}-${date}`] ?? []}
                    canManage={canManage}
                    compact={compact}
                    isToday={date === today}
                    isPast={date < today}
                    onAddShift={() => onAddShift(emp.id, date)}
                    onOpenDetail={(s) => onOpenDetail(s, date)}
                  />
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
