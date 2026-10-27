import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useProjectTasks } from '@/hooks/hr/useProjects';
import { projectBillableTime, useNow } from '@/lib/taskTime';
import type { PersonTimer } from '@/lib/taskTime';
import type { ProjectTask } from '@/types/hr';

const KEY = 'projects';

/** One person's settled time on one task. A running timer's stretch isn't in `seconds`; it is counted live. */
export interface TimeRow {
  taskId: string;
  employeeId: string;
  employeeName: string;
  seconds: number;
  runningSince: string | null;
}

/** Everyone's time on the project's timed tasks, as the server holds it. */
function useTimeRows(projectId: string) {
  return useQuery({
    queryKey: [KEY, projectId, 'time'],
    queryFn: async () => {
      const res = await api.get<TimeRow[]>(`/hr/projects/${projectId}/time`);
      return res.data;
    },
    enabled: !!projectId,
    // Other people's timers run without this page knowing, so look again now and then while any is running.
    refetchInterval: (query) => (query.state.data?.some((r) => r.runningSince) ? 60_000 : false),
  });
}

/** Task id → person id → timer, for the project's tasks. */
export function timersFromRows(
  rows: TimeRow[],
  tasks: ProjectTask[],
  projectId: string,
): Record<string, Record<string, PersonTimer>> {
  const taskName = new Map(tasks.map((t) => [t.id, t.name]));
  const byTask: Record<string, Record<string, PersonTimer>> = {};
  for (const r of rows) {
    (byTask[r.taskId] ??= {})[r.employeeId] = {
      personId: r.employeeId,
      personName: r.employeeName,
      taskName: taskName.get(r.taskId) ?? '',
      projectId,
      accumulatedMs: r.seconds * 1000,
      runningSince: r.runningSince ?? undefined,
    };
  }
  return byTask;
}

/** The project's timers, by task and person, and which tasks are timed. */
export function useProjectTimers(projectId: string) {
  const { data: rows } = useTimeRows(projectId);
  const { data: tasks } = useProjectTasks(projectId);
  return useMemo(() => {
    const timersByTaskId = timersFromRows(rows ?? [], tasks ?? [], projectId);
    const timedByTaskId = Object.fromEntries((tasks ?? []).map((t) => [t.id, !!t.isTimed]));
    const anyRunning = (rows ?? []).some((r) => r.runningSince);
    return { timersByTaskId, timedByTaskId, anyRunning };
  }, [rows, tasks, projectId]);
}

/** The time logged on a project's timed tasks, ticking while anyone's timer on it runs. */
export function useProjectTime(projectId: string) {
  const { timersByTaskId, timedByTaskId, anyRunning } = useProjectTimers(projectId);
  const now = useNow(anyRunning);
  return useMemo(
    () => projectBillableTime(timersByTaskId, timedByTaskId, projectId, now),
    [timersByTaskId, timedByTaskId, projectId, now],
  );
}

/** The person's own running timers on any project, so starting another can offer to pause them. */
export function useMyRunningTimers() {
  return useQuery({
    queryKey: [KEY, 'my-running-timers'],
    queryFn: async () => {
      const res = await api.get<{ taskId: string; taskName: string; projectId: string }[]>(
        '/hr/projects/my-running-timers',
      );
      return res.data;
    },
  });
}

const toAmount = (ms: number) => {
  const minutes = Math.round(ms / 60000);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
};

/** Start, pause and change the person's own time on a task. Each returns the project's new time. */
export function useTaskTimeActions(projectId: string) {
  const queryClient = useQueryClient();
  const store = (rows: TimeRow[]) => {
    queryClient.setQueryData([KEY, projectId, 'time'], rows);
    queryClient.invalidateQueries({ queryKey: [KEY, 'my-running-timers'] });
  };
  const post = async (path: string, body?: object) =>
    (await api.post<TimeRow[]>(`/hr/projects/${projectId}/tasks/${path}`, body)).data;

  const start = useMutation({
    mutationFn: ({ taskId, pauseOthers }: { taskId: string; pauseOthers: boolean }) =>
      post(`${taskId}/time/start`, { pauseOthers }),
    onSuccess: (rows) => {
      store(rows);
      // Pausing others can touch timers in other projects.
      queryClient.invalidateQueries({
        queryKey: [KEY],
        predicate: (q) => q.queryKey[2] === 'time',
      });
    },
  });
  const pause = useMutation({
    mutationFn: (taskId: string) => post(`${taskId}/time/pause`),
    onSuccess: store,
  });
  const add = useMutation({
    mutationFn: ({ taskId, ms }: { taskId: string; ms: number }) =>
      post(`${taskId}/time/entries`, toAmount(ms)),
    onSuccess: store,
  });
  const setMine = useMutation({
    mutationFn: async ({ taskId, ms }: { taskId: string; ms: number }) =>
      (
        await api.put<TimeRow[]>(
          `/hr/projects/${projectId}/tasks/${taskId}/time/mine`,
          toAmount(ms),
        )
      ).data,
    onSuccess: store,
  });
  return { start, pause, add, setMine };
}
