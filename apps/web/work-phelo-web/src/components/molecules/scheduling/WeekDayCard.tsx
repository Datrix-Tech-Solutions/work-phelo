'use client';

import { ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DayShiftType = 'morning' | 'afternoon' | 'night' | 'on-leave';

export interface DayShift {
  type: DayShiftType;
  startTime?: string;
  endTime?: string;
  leaveType?: string;
}

interface WeekDayCardProps {
  day: string;
  date: number;
  isToday?: boolean;
  shift?: DayShift;
  isSelected?: boolean;
  onClick?: () => void;
  onSwapShift?: () => void;
}

function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')}${period}`;
}

const SHIFT_STYLES: Record<DayShiftType, { bg: string; text: string }> = {
  morning: { bg: 'bg-green-100', text: 'text-green-600' },
  afternoon: { bg: 'bg-purple-100', text: 'text-purple-600' },
  night: { bg: 'bg-[#0d1b3e]', text: 'text-white' },
  'on-leave': { bg: 'bg-blue-200', text: 'text-blue-600' },
};

export function WeekDayCard({
  day,
  date,
  isToday,
  shift,
  isSelected,
  onClick,
  onSwapShift,
}: WeekDayCardProps) {
  const isLeave = shift?.type === 'on-leave';
  const styles = shift ? SHIFT_STYLES[shift.type] : null;
  const typeLabel = shift
    ? shift.type === 'on-leave'
      ? 'ON LEAVE'
      : shift.type.toUpperCase()
    : null;
  const timeStr =
    shift && !isLeave && shift.startTime && shift.endTime
      ? `${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`
      : '';

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col rounded-2xl overflow-hidden border-2 w-full text-left transition-all duration-150',
        isSelected ? 'border-[#0d1b3e]' : 'border-gray-200',
      )}
    >
      {/* Header */}
      <div className="bg-gray-100 px-4 py-3 text-center w-full shrink-0">
        <p
          className={cn(
            'text-xs font-semibold tracking-widest uppercase',
            isToday ? 'text-brand' : 'text-gray-500',
          )}
        >
          {day}
        </p>
        <p
          className={cn(
            'text-3xl font-bold leading-none mt-1',
            isToday ? 'text-brand' : 'text-gray-800',
          )}
        >
          {date}
        </p>
      </div>

      {/* Body */}
      <div className={cn('flex flex-col flex-1 p-4 min-h-36', styles?.bg ?? 'bg-white')}>
        {shift ? (
          <>
            <div className="flex-1">
              <p className={cn('text-xs font-bold uppercase tracking-wide', styles?.text)}>
                {typeLabel}
              </p>
              {timeStr && <p className={cn('text-xs mt-1', styles?.text)}>{timeStr}</p>}
              {isLeave && shift.leaveType && (
                <p className={cn('text-sm mt-1', styles?.text)}>{shift.leaveType}</p>
              )}
            </div>

            {!isLeave && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSwapShift?.();
                }}
                className="mt-3 flex items-center justify-center gap-2 w-full bg-white rounded-xl py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Swap Shift
              </button>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-300 font-medium">OFF</p>
          </div>
        )}
      </div>
    </button>
  );
}
