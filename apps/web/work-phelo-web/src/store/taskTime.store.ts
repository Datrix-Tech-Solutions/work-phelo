import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** One person's time on one task. While `runningSince` is set the timer is running. */
export interface PersonTimer {
  personId: string;
  personName: string;
  taskName: string;
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
  start: (taskId: string, taskName: string, person: { id: string; name: string }) => void;
  pause: (taskId: string, personId: string) => void;
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
      start: (taskId, taskName, person) =>
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
