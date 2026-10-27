import { useEffect, useState } from 'react';
/** One person's time on one task. While `runningSince` is set the timer is running. */
export interface PersonTimer {
  personId: string;
  personName: string;
  taskName: string;
  /** The project the task belongs to, so a project's time can be added up. */
  projectId?: string;
  accumulatedMs: number;
  /** ISO time the timer was last started; unset while paused. */
  runningSince?: string;
}

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

/** A person's billable time on a project. */
export interface PersonProjectTime {
  personId: string;
  personName: string;
  ms: number;
}

/** The time logged on a project's timed tasks, in total and by person. Untimed tasks don't count. */
export function projectBillableTime(
  timersByTaskId: Record<string, Record<string, PersonTimer>>,
  timedByTaskId: Record<string, boolean>,
  projectId: string,
  now: number,
): { totalMs: number; people: PersonProjectTime[]; running: boolean } {
  const byPerson = new Map<string, PersonProjectTime>();
  let running = false;
  for (const [taskId, timers] of Object.entries(timersByTaskId)) {
    if (!timedByTaskId[taskId]) continue;
    for (const t of Object.values(timers)) {
      if (t.projectId !== projectId) continue;
      if (t.runningSince) running = true;
      const entry = byPerson.get(t.personId) ?? {
        personId: t.personId,
        personName: t.personName,
        ms: 0,
      };
      entry.ms += timerElapsedMs(t, now);
      byPerson.set(t.personId, entry);
    }
  }
  const people = [...byPerson.values()].sort((a, b) => b.ms - a.ms);
  return { totalMs: people.reduce((sum, p) => sum + p.ms, 0), people, running };
}

/** What the logged time is worth at an hourly rate, counted to the exact minute. */
export function accruedAmount(totalMs: number, hourlyRate: number): number {
  const minutes = Math.floor(Math.max(0, totalMs) / 60000);
  return Math.round((minutes / 60) * hourlyRate * 100) / 100;
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
