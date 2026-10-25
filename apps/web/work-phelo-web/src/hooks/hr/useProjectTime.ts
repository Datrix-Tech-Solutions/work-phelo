import { useMemo } from 'react';
import { useTaskTimeStore } from '@/store/taskTime.store';
import { projectBillableTime, useNow } from '@/lib/taskTime';

/** The time logged on a project's timed tasks, ticking while anyone's timer on it runs. */
export function useProjectTime(projectId: string) {
  const timersByTaskId = useTaskTimeStore((s) => s.timersByTaskId);
  const timedByTaskId = useTaskTimeStore((s) => s.timedByTaskId);
  const running = useMemo(
    () => projectBillableTime(timersByTaskId, timedByTaskId, projectId, 0).running,
    [timersByTaskId, timedByTaskId, projectId],
  );
  const now = useNow(running);
  return useMemo(
    () => projectBillableTime(timersByTaskId, timedByTaskId, projectId, now),
    [timersByTaskId, timedByTaskId, projectId, now],
  );
}
