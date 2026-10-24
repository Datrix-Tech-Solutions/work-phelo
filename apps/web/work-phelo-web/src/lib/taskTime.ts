import { useEffect, useState } from 'react';
import type { PersonTimer } from '@/store/taskTime.store';

/** Milliseconds a timer has logged so far, counting the stretch it is running now. */
export function timerElapsedMs(timer: PersonTimer, now: number): number {
  return (
    timer.accumulatedMs + (timer.runningSince ? now - new Date(timer.runningSince).getTime() : 0)
  );
}

/** Everyone's time on a task added together. */
export function totalElapsedMs(timers: PersonTimer[], now: number): number {
  return timers.reduce((sum, t) => sum + timerElapsedMs(t, now), 0);
}

/** 1:05:32 — hours, then minutes and seconds. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/** 1h 05m — hours and minutes only, for cards and tables. */
export function formatHoursMinutes(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** The current time, refreshed every second while `active`; otherwise it holds still. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    // Catch up straight away, then keep ticking.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);
  return now;
}
