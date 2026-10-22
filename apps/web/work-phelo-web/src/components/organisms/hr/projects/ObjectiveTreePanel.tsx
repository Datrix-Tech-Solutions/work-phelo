'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { WorkTypeIconBadge } from '@/lib/workTypeIcons';
import { cn } from '@/lib/utils';
import type {
  ProjectObjective,
  ProjectSubtask,
  ProjectTask,
  ProjectWorkType,
  TaskStatus,
} from '@/types/hr';

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  DONE: 'Done',
};

interface Props {
  objective: ProjectObjective | null;
  onClose: () => void;
  tasks: ProjectTask[];
  subtasks: ProjectSubtask[];
  objectiveByTaskId: Record<string, string>;
  taskMeta: Record<string, { workType: string; priority: string }>;
  workTypes: ProjectWorkType[];
  progress: { done: number; total: number; percent: number };
}

/** An objective's work as a plain list: its tasks, and under each task its subtasks, indented a level. */
export function ObjectiveTreePanel({
  objective,
  onClose,
  tasks,
  subtasks,
  objectiveByTaskId,
  taskMeta,
  workTypes,
  progress,
}: Props) {
  const own = objective ? tasks.filter((t) => objectiveByTaskId[t.id] === objective.id) : [];

  return (
    <SidePanel
      isOpen={!!objective}
      onClose={onClose}
      title={objective?.name ?? ''}
      description={objective?.description}
      width="sm:w-[480px]"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-600">
            {progress.done} of {progress.total} {progress.total === 1 ? 'task' : 'tasks'} done
          </p>
          <ProgressBar value={progress.percent} />
        </div>

        {own.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks under this objective yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {own.map((task) => {
              const done = task.status === 'DONE';
              const icon =
                workTypes.find((w) => w.name === taskMeta[task.id]?.workType)?.icon ?? 'TASK';
              const steps = subtasks.filter((st) => st.taskId === task.id);
              return (
                <li key={task.id}>
                  <div className="flex items-center gap-2 py-1">
                    <WorkTypeIconBadge icon={icon} />
                    <span
                      className={cn('text-sm text-gray-900', done && 'line-through text-gray-400')}
                    >
                      {task.name}
                    </span>
                    <span className="ml-auto text-xs text-gray-400 shrink-0">
                      {STATUS_LABEL[task.status]}
                    </span>
                  </div>
                  {steps.length > 0 && (
                    <ul className="ml-2.5 mt-0.5 pl-4 border-l border-gray-200 flex flex-col gap-1.5">
                      {steps.map((st) => (
                        <li key={st.id} className="flex items-center gap-2 py-1">
                          <WorkTypeIconBadge icon="SUBTASK" />
                          <span
                            className={cn(
                              'text-sm text-gray-900',
                              st.done && 'line-through text-gray-400',
                            )}
                          >
                            {st.name}
                          </span>
                          <span className="ml-auto text-xs text-gray-400 shrink-0">
                            {st.done ? 'Done' : 'To Do'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SidePanel>
  );
}
