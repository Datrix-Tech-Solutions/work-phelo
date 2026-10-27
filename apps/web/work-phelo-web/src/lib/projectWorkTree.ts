import { taskAssignees } from '@/lib/taskAssignees';
import { ProjectObjective, ProjectTask, TaskAssignee } from '@/types/hr';

/** One row of the backlog: a task, with the name of its objective. */
export interface WorkRow {
  id: string;
  name: string;
  task: ProjectTask;
  objectiveName?: string;
  /** Everyone the task is assigned to. */
  assignees: TaskAssignee[];
}

interface BuildArgs {
  tasks: ProjectTask[];
  objectives: ProjectObjective[];
  objectiveByTaskId: Record<string, string>;
  search: string;
  /** A task status; empty means no filter. */
  status: string;
}

/** The backlog's rows: every task on its own. Subtasks and objectives aren't rows; subtasks show with their task's details. */
export function buildBacklogRows({
  tasks,
  objectives,
  objectiveByTaskId,
  search,
  status,
}: BuildArgs): WorkRow[] {
  const q = search.toLowerCase();
  const objectiveName = (id?: string) => objectives.find((o) => o.id === id)?.name;

  return tasks
    .map(
      (t): WorkRow => ({
        id: t.id,
        name: t.name,
        task: t,
        objectiveName: objectiveName(objectiveByTaskId[t.id]),
        assignees: taskAssignees(t),
      }),
    )
    .filter((row) => {
      if (status && row.task.status !== status) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        (row.objectiveName?.toLowerCase().includes(q) ?? false) ||
        row.assignees.some((a) => a.name.toLowerCase().includes(q))
      );
    });
}
