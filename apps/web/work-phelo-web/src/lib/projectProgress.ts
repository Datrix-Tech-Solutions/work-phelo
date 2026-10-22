import { ProjectObjective, ProjectTask } from '@/types/hr';

export interface Progress {
  total: number;
  done: number;
  percent: number;
}

function count(tasks: ProjectTask[]): Progress {
  const done = tasks.filter((t) => t.status === 'DONE').length;
  return {
    total: tasks.length,
    done,
    percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  };
}

interface Args {
  tasks: ProjectTask[];
  objectives: ProjectObjective[];
  objectiveByTaskId: Record<string, string>;
}

/** How far along each objective is, the tasks with no objective, and the project as a whole. Subtasks are
 *  steps within a task, so only tasks are counted. */
export function projectProgress({ tasks, objectives, objectiveByTaskId }: Args) {
  const objectiveIds = new Set(objectives.map((o) => o.id));
  const perObjective = new Map<string, Progress>(
    objectives.map((o) => [o.id, count(tasks.filter((t) => objectiveByTaskId[t.id] === o.id))]),
  );
  const other = count(tasks.filter((t) => !objectiveIds.has(objectiveByTaskId[t.id])));
  return { perObjective, other, overall: count(tasks) };
}
