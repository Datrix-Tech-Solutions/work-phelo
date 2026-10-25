import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

interface TaskTimeStore {
  /** Which tasks are timed, by task id. */
  timedByTaskId: Record<string, boolean>;
  /** Each person's timer on a task: task id → person id → timer. */
  timersByTaskId: Record<string, Record<string, PersonTimer>>;
  setTimed: (taskId: string, timed: boolean) => void;
  start: (
    taskId: string,
    taskName: string,
    person: { id: string; name: string },
    projectId: string,
  ) => void;
  pause: (taskId: string, personId: string) => void;
  /** Adds time a person worked without the timer, e.g. "1h 30m" they forgot to start. */
  addTime: (
    taskId: string,
    taskName: string,
    person: { id: string; name: string },
    projectId: string,
    ms: number,
  ) => void;
  /** Replaces a person's total time on a task. A running timer carries on from the new total. */
  setTime: (taskId: string, personId: string, ms: number) => void;
  /** Pauses everyone's timer on the task, e.g. when it is done. */
  pauseAll: (taskId: string) => void;
}

const paused = (t: PersonTimer, now: number): PersonTimer => {
  if (!t.runningSince) return t;
  const { runningSince, ...rest } = t;
  return { ...rest, accumulatedMs: t.accumulatedMs + (now - new Date(runningSince).getTime()) };
};

// Local-storage only until the project backend is rebuilt.
export const useTaskTimeStore = create<TaskTimeStore>()(
  persist(
    (set) => ({
      timedByTaskId: {},
      timersByTaskId: {},
      setTimed: (taskId, timed) =>
        set((s) => {
          const next = { timedByTaskId: { ...s.timedByTaskId, [taskId]: timed } };
          if (timed || !s.timersByTaskId[taskId]) return next;
          // Switching timing off stops the clocks but keeps the time already logged.
          const now = Date.now();
          return {
            ...next,
            timersByTaskId: {
              ...s.timersByTaskId,
              [taskId]: Object.fromEntries(
                Object.entries(s.timersByTaskId[taskId]).map(([id, t]) => [id, paused(t, now)]),
              ),
            },
          };
        }),
      start: (taskId, taskName, person, projectId) =>
        set((s) => {
          const existing = s.timersByTaskId[taskId]?.[person.id];
          if (existing?.runningSince) return s;
          return {
            timersByTaskId: {
              ...s.timersByTaskId,
              [taskId]: {
                ...s.timersByTaskId[taskId],
                [person.id]: {
                  personId: person.id,
                  personName: person.name,
                  accumulatedMs: existing?.accumulatedMs ?? 0,
                  taskName,
                  projectId,
                  runningSince: new Date().toISOString(),
                },
              },
            },
          };
        }),
      pause: (taskId, personId) =>
        set((s) => {
          const timer = s.timersByTaskId[taskId]?.[personId];
          if (!timer?.runningSince) return s;
          return {
            timersByTaskId: {
              ...s.timersByTaskId,
              [taskId]: { ...s.timersByTaskId[taskId], [personId]: paused(timer, Date.now()) },
            },
          };
        }),
      addTime: (taskId, taskName, person, projectId, ms) =>
        set((s) => {
          const existing = s.timersByTaskId[taskId]?.[person.id];
          return {
            timersByTaskId: {
              ...s.timersByTaskId,
              [taskId]: {
                ...s.timersByTaskId[taskId],
                [person.id]: {
                  ...existing,
                  personId: person.id,
                  personName: person.name,
                  taskName,
                  projectId,
                  accumulatedMs: (existing?.accumulatedMs ?? 0) + ms,
                },
              },
            },
          };
        }),
      setTime: (taskId, personId, ms) =>
        set((s) => {
          const timer = s.timersByTaskId[taskId]?.[personId];
          if (!timer) return s;
          return {
            timersByTaskId: {
              ...s.timersByTaskId,
              [taskId]: {
                ...s.timersByTaskId[taskId],
                [personId]: {
                  ...timer,
                  accumulatedMs: ms,
                  runningSince: timer.runningSince ? new Date().toISOString() : undefined,
                },
              },
            },
          };
        }),
      pauseAll: (taskId) =>
        set((s) => {
          const timers = s.timersByTaskId[taskId];
          if (!timers || !Object.values(timers).some((t) => t.runningSince)) return s;
          const now = Date.now();
          return {
            timersByTaskId: {
              ...s.timersByTaskId,
              [taskId]: Object.fromEntries(
                Object.entries(timers).map(([id, t]) => [id, paused(t, now)]),
              ),
            },
          };
        }),
    }),
    { name: 'task-time-store', version: 1 },
  ),
);
