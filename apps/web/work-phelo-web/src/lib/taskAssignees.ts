import type { ProjectTask, TaskAssignee } from '@/types/hr';

/**
 * Everyone a task is assigned to. A task made before it could hold several people falls back to its
 * single assignee.
 */
export function taskAssignees(task: ProjectTask): TaskAssignee[] {
  if (task.assignees && task.assignees.length > 0) return task.assignees;
  return task.assignedEmployeeId && task.assignedEmployeeName
    ? [{ id: task.assignedEmployeeId, name: task.assignedEmployeeName }]
    : [];
}
