import { cn } from '@/lib/utils';
import { ShiftSchedule, BackendShiftType } from '@/types/scheduling';
import { Shift } from '@/components/organisms/hr/scheduling/ShiftPanel';

const SHIFT_COLORS: Record<string, string> = {
  morning: 'bg-green-100 text-green-600',
  afternoon: 'bg-purple-400 text-white',
  night: 'bg-shift-night text-white',
  'on-leave': 'bg-blue-200 text-blue-600',
};

function toFrontendShiftType(t: BackendShiftType): Shift['shiftType'] {
  return t.toLowerCase() as Shift['shiftType'];
}

function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')}${period}`;
}

function formatWorkMode(workMode: ShiftSchedule['workMode']): string {
  return workMode.charAt(0) + workMode.slice(1).toLowerCase();
}

interface Props {
  schedule: ShiftSchedule;
  compact?: boolean;
  onClick: () => void;
}

export function ShiftGridCard({ schedule, compact, onClick }: Props) {
  const shiftType = toFrontendShiftType(schedule.shiftType);
  const timeStr =
    schedule.startTime && schedule.endTime
      ? `${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}`
      : '';
  const typeLabel = schedule.shiftType.charAt(0) + schedule.shiftType.slice(1).toLowerCase();
  const details = `${typeLabel} · ${formatWorkMode(schedule.workMode)}`;
  const colorClass = SHIFT_COLORS[shiftType] ?? 'bg-gray-100 text-gray-600';

  return (
    <button
      onClick={onClick}
      title={compact ? [timeStr, details].filter(Boolean).join(' · ') : undefined}
      className={cn(
        'w-full hover:opacity-80 transition-opacity',
        compact ? 'text-center rounded-lg px-1 py-1.5' : 'text-left rounded-xl px-3 py-2.5',
        colorClass,
      )}
    >
      {compact ? (
        <>
          <p className="text-[10px] font-semibold leading-tight">
            {schedule.startTime && formatTime(schedule.startTime)}
          </p>
          <p className="text-[10px] leading-tight opacity-80">
            {schedule.endTime && formatTime(schedule.endTime)}
          </p>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold">{timeStr}</p>
          <p className="text-xs mt-0.5 opacity-80">{details}</p>
        </>
      )}
    </button>
  );
}
