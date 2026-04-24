'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, SearchIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEmployees } from '@/hooks/hr/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';
import { ShiftPanel, Shift } from './ShiftPanel';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';

/* ── Week helpers ────────────────────────────────────────── */

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
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

function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')}${period}`;
}

const WEEKDAYS = [
  { label: 'MON', isoDay: 1 },
  { label: 'TUE', isoDay: 2 },
  { label: 'WED', isoDay: 3 },
  { label: 'THU', isoDay: 4 },
  { label: 'FRI', isoDay: 5 },
];

const SHIFT_COLORS: Record<string, string> = {
  morning: 'bg-green-100 text-green-600',
  afternoon: 'bg-purple-400 text-white',
  night: 'bg-[#0d1b3e] text-white',
  'on-leave': 'bg-blue-200 text-blue-600',
};

/* ── Tiny ID generator ── */
let _id = 0;
const nextId = () => `shift-${++_id}`;

/* ── Expand a date range into individual ISO dates ── */
function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (current <= end) {
    dates.push(toISODate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/* ── Shift card ── */

function ShiftCard({ shift, onClick }: { shift: Shift; onClick: () => void }) {
  const isLeave = shift.shiftType === 'on-leave';
  const timeStr =
    !isLeave && shift.startTime && shift.endTime
      ? `${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`
      : '';
  const typeLabel =
    shift.shiftType.charAt(0).toUpperCase() + shift.shiftType.slice(1).replace('-', ' ');

  if (shift.isDraft) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left rounded-xl bg-yellow-50 border-2 border-dashed border-orange-400 px-3 py-2.5 relative hover:bg-yellow-100 transition-colors"
      >
        <span className="absolute top-1.5 right-1.5 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm tracking-wide">
          DRAFT
        </span>
        {timeStr && <p className="text-xs font-semibold text-orange-500 pr-10">{timeStr}</p>}
        <p className="text-xs text-orange-500 mt-0.5">{typeLabel}</p>
      </button>
    );
  }

  const colorClass = SHIFT_COLORS[shift.shiftType] ?? 'bg-gray-100 text-gray-600';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl px-3 py-2.5 hover:opacity-90 transition-opacity',
        colorClass,
      )}
    >
      {isLeave ? (
        <>
          <p className="text-xs font-semibold">On Leave</p>
          {shift.leaveType && <p className="text-xs mt-0.5 opacity-80">{shift.leaveType}</p>}
        </>
      ) : (
        <>
          <p className="text-xs font-semibold">{timeStr}</p>
          <p className="text-xs mt-0.5 opacity-80">{typeLabel}</p>
        </>
      )}
    </button>
  );
}

/* ── Component ── */

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
  const [panelEmployeeId, setPanelEmployeeId] = useState('');
  const [panelDate, setPanelDate] = useState('');
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  /* ── Search & department filter ── */
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  /* ── Data ── */
  const { data: empData } = useEmployees({
    search: search || undefined,
    departmentId: departmentId || undefined,
    limit: 100,
  });
  const employees = useMemo(() => empData?.data ?? [], [empData]);
  const { data: departments = [] } = useDepartments();

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
    sublabel: e.jobTitle,
  }));

  /* ── Shifts indexed by "employeeId-date" ── */
  const shiftsByKey = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    shifts.forEach((s) => {
      const key = `${s.employeeId}-${s.date}`;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [shifts]);

  /* ── Handlers ── */
  const openAdd = (empId: string, date: string) => {
    if (!canManageSchedules) return;
    setPanelEmployeeId(empId);
    setPanelDate(date);
    setEditingShift(null);
    setPanelOpen(true);
  };

  const openEdit = (shift: Shift) => {
    if (!canManageSchedules) return;
    setEditingShift(shift);
    setPanelOpen(true);
  };

  const handleSave = (data: Omit<Shift, 'id'>, endDate: string) => {
    if (!canManageSchedules) return;
    if (editingShift) {
      setShifts((prev) => prev.map((s) => (s.id === editingShift.id ? { ...s, ...data } : s)));
    } else {
      const dates = getDatesInRange(data.date, endDate);
      setShifts((prev) => [...prev, ...dates.map((date) => ({ ...data, date, id: nextId() }))]);
    }
  };

  /* ── Render ── */
  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between shrink-0 mb-6 gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Search */}
          <div className="relative flex-1 min-w-0 max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>

          {/* Department filter */}
          <div className="relative shrink-0">
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="appearance-none pl-4 pr-8 py-2 border border-gray-200 rounded-input text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white font-medium"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Week selector */}
        <div className="flex items-center gap-2 border border-gray-200 rounded-card bg-white px-4 py-2.5 shadow-sm shrink-0">
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

      {/* ── Grid ── */}
      <div className="flex-1 overflow-auto">
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
              const dateNum = dayDate.getDate();
              const isToday = toISODate(dayDate) === toISODate(new Date());
              return (
                <div key={label} className="px-4 py-3.5 text-center border-l border-gray-200">
                  <span
                    className={cn(
                      'text-xs font-semibold tracking-wider',
                      isToday ? 'text-brand' : 'text-gray-500',
                    )}
                  >
                    {label} {dateNum}
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
                {/* Employee name */}
                <div className="px-5 py-4 flex items-start sticky left-0 bg-white z-10 border-r border-gray-100">
                  <span className="text-sm text-gray-800 font-medium leading-snug">
                    {emp.firstName} {emp.lastName}
                  </span>
                </div>

                {/* Day cells */}
                {WEEKDAYS.map(({ label, isoDay }) => {
                  const date = toISODate(addDays(weekStart, isoDay - 1));
                  const key = `${emp.id}-${date}`;
                  const dayShifts = shiftsByKey[key] ?? [];
                  const isEmpty = dayShifts.length === 0;

                  return (
                    <div
                      key={label}
                      className="group/cell relative border-l border-gray-100 p-3 min-h-20 flex flex-col gap-2"
                    >
                      {dayShifts.map((shift) => (
                        <ShiftCard key={shift.id} shift={shift} onClick={() => openEdit(shift)} />
                      ))}

                      {canManageSchedules && isEmpty && (
                        <button
                          onClick={() => openAdd(emp.id, date)}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity"
                          aria-label="Add shift"
                        >
                          <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shadow-md">
                            <Plus className="w-4 h-4 text-white" />
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Side panel ── */}
      <ShiftPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        employeeOptions={employeeOptions}
        employeeId={panelEmployeeId}
        date={panelDate}
        shift={editingShift}
        onSave={handleSave}
      />
    </>
  );
}
