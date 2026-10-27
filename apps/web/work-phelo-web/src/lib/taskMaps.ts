import type { ProjectTask } from '@/types/hr';

/** A task's work type and priority level, as names from the project's own set-up. */
export type TaskMeta = { workType: string; priority: string };

/** The objective each task is under, by task id. A task with no entry sits directly under the project. */
export function objectiveByTaskId(tasks: ProjectTask[]): Record<string, string> {
  return Object.fromEntries(
    tasks.flatMap((t) => (t.objectiveId ? [[t.id, t.objectiveId] as const] : [])),
  );
}

/** Each task's work type and priority, by task id. */
export function taskMetaById(tasks: ProjectTask[]): Record<string, TaskMeta> {
  return Object.fromEntries(
    tasks.map((t) => [t.id, { workType: t.workType ?? '', priority: t.priorityName ?? '' }]),
  );
}
