'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmployees } from '@/hooks/hr/useEmployees';
import { ShiftPanel, Shift } from './ShiftPanel';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';

/* ── Week helpers ────────────────────────────────────────── */

/** Return the Monday of the week containing `date` */
function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun,1=Mon…6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatWeekRange(monday: Date): string {
  const friday = addDays(monday, 4);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${friday.toLocaleDateString('en-US', opts)}`;
}

const WEEKDAYS = [
  { label: 'MON', isoDay: 1 },
  { label: 'TUE', isoDay: 2 },
  { label: 'WED', isoDay: 3 },
  { label: 'THU', isoDay: 4 },
  { label: 'FRI', isoDay: 5 },
];

/* ── Tiny ID generator ───────────────────────────────────── */
let _id = 0;
const nextId = () => `shift-${++_id}`;

/* ── Component ───────────────────────────────────────────── */

interface Props {
  tenantSlug: string;
}

export function SchedulingContent({ tenantSlug }: Props) {
  void tenantSlug;
  const canManageSchedules = usePermission(Permission.MANAGE_SCHEDULES);

  /* ── Week state ── */
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));

  /* ── Shifts state ── */
  const [shifts, setShifts] = useState<Shift[]>([]);

  /* ── Panel state ── */
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  /* ── Employees ── */
  const { data: empData } = useEmployees();
  const employees = empData?.data ?? [];
  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
    sublabel: e.jobTitle,
  }));

  /* ── Shifts indexed by date ── */
  const shiftsByDate = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    shifts.forEach((s) => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [shifts]);

  /* ── Handlers ── */
  const openAdd = (isoDay: number) => {
    if (!canManageSchedules) return;
    const date = toISODate(addDays(weekStart, isoDay - 1));
    setSelectedDay(isoDay);
    setSelectedDate(date);
    setEditingShift(null);
    setPanelOpen(true);
  };

  const openEdit = (shift: Shift) => {
    if (!canManageSchedules) return;
    setEditingShift(shift);
    setPanelOpen(true);
  };

  const handleSave = (data: Omit<Shift, 'id'>) => {
    if (!canManageSchedules) return;
    if (editingShift) {
      setShifts((prev) => prev.map((s) => (s.id === editingShift.id ? { ...s, ...data } : s)));
    } else {
      setShifts((prev) => [...prev, { id: nextId(), ...data }]);
    }
  };

  /* ── Render ── */
  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-start justify-between shrink-0 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Smart Scheduling</h1>
          <p className="text-sm text-gray-400 mt-0.5">Plan shifts and manage workforce hours</p>
        </div>

        {/* Week selector */}
        <div className="flex items-center gap-2 border border-gray-200 rounded-card bg-white px-4 py-2.5 shadow-sm">
          <button
            onClick={prevWeek}
            className="text-gray-400 hover:text-gray-700 transition-colors p-0.5"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-800 min-w-45 text-center">
            {formatWeekRange(weekStart)}
          </span>
          <button
            onClick={nextWeek}
            className="text-gray-400 hover:text-gray-700 transition-colors p-0.5"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <div className="flex-1 overflow-auto">
        <div className="border border-gray-200 rounded-card bg-white shadow-sm overflow-hidden min-w-150">
          {/* Day headers */}
          <div className="grid grid-cols-5 border-b border-gray-200">
            {WEEKDAYS.map(({ label, isoDay }) => {
              const dayDate = addDays(weekStart, isoDay - 1);
              const dateNum = dayDate.getDate();
              const isToday = toISODate(dayDate) === toISODate(new Date());

              return (
                <div
                  key={label}
                  className={cn(
                    'flex flex-col items-center py-4 gap-1',
                    isoDay < 5 && 'border-r border-gray-200',
                  )}
                >
                  <span className="text-xs font-semibold text-gray-400 tracking-widest">
                    {label}
                  </span>
                  <span
                    className={cn('text-2xl font-bold', isToday ? 'text-brand' : 'text-gray-800')}
                  >
                    {dateNum}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Shift cells */}
          <div className="grid grid-cols-5 min-h-120">
            {WEEKDAYS.map(({ label, isoDay }) => {
              const date = toISODate(addDays(weekStart, isoDay - 1));
              const dayShifts = shiftsByDate[date] ?? [];

              return (
                <div
                  key={label}
                  className={cn(
                    'flex flex-col gap-2 p-3',
                    isoDay < 5 && 'border-r border-gray-200',
                  )}
                >
                  {/* Existing shifts */}
                  {dayShifts.map((shift) => (
                    <button
                      key={shift.id}
                      onClick={() => openEdit(shift)}
                      className="w-full text-left rounded-lg bg-brand/10 border border-brand/20 px-3 py-2.5 hover:bg-brand/20 transition-colors group"
                    >
                      <p className="text-xs font-semibold text-brand truncate group-hover:text-brand-hover">
                        {shift.employeeName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {shift.startTime} – {shift.endTime}
                      </p>
                    </button>
                  ))}

                  {canManageSchedules && (
                    <button
                      onClick={() => openAdd(isoDay)}
                      className="w-full border border-dashed border-gray-300 rounded-lg py-2.5 text-xs text-gray-400 hover:border-brand hover:text-brand hover:bg-brand/5 transition-all"
                    >
                      + Add Shift
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Side panel ── */}
      <ShiftPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        employeeOptions={employeeOptions}
        day={selectedDay}
        date={selectedDate}
        shift={editingShift}
        onSave={handleSave}
      />
    </>
  );
}
