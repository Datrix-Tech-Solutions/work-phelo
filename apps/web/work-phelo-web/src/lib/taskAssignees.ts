import type { ProjectTask, TaskAssignee } from '@/types/hr';

/**
 * Everyone a task is assigned to. The backend holds one assignee per task, so the full list is kept
 * locally; a task with no local list falls back to the backend's single assignee.
 */
export function taskAssignees(
  task: ProjectTask,
  byTaskId: Record<string, TaskAssignee[]>,
): TaskAssignee[] {
  const local = byTaskId[task.id];
  if (local) return local;
  return task.assignedEmployeeId && task.assignedEmployeeName
    ? [{ id: task.assignedEmployeeId, name: task.assignedEmployeeName }]
    : [];
}
