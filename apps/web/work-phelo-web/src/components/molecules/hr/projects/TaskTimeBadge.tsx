'use client';

import type { ReactNode } from 'react';
import { Clock } from 'lucide-react';
import { useTaskTimeStore } from '@/store/taskTime.store';
import { formatHoursMinutes, totalElapsedMs, useNow } from '@/lib/taskTime';
import { cn } from '@/lib/utils';

/** The time spent on a timed task by everyone, ticking while anyone's timer runs. Nothing for an untimed task. */
export function TaskTimeBadge({ taskId, empty = null }: { taskId: string; empty?: ReactNode }) {
  const timed = useTaskTimeStore((s) => s.timedByTaskId[taskId]);
  const timersById = useTaskTimeStore((s) => s.timersByTaskId[taskId]);
  const timers = timersById ? Object.values(timersById) : [];
  const running = timers.some((t) => t.runningSince);
  const now = useNow(running);

  if (!timed) return <>{empty}</>;
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500" title="Time spent">
      <Clock className={cn('w-3.5 h-3.5', running ? 'text-green-600' : 'text-gray-400')} />
      <span className="tabular-nums font-semibold text-gray-900">
        {formatHoursMinutes(totalElapsedMs(timers, now))}
      </span>
      {running && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
    </div>
  );
}
