'use client';

import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { TypeChip } from '@/components/atoms/TypeChip';
import { TypeChipSelect, TypeChipOption } from '@/components/atoms/TypeChipSelect';
import { TaskSubtasks } from '@/components/organisms/hr/projects/TaskSubtasks';
import { PRIORITY_TYPE_CHIP_COLORS } from '@/lib/priorityColors';
import { cn } from '@/lib/utils';
import type { PriorityLevel, ProjectTask, TaskAssignee, TaskStatus } from '@/types/hr';

const STATUS_META: Record<TaskStatus, { dot: string; label: string }> = {
  TODO: { dot: 'bg-gray-400', label: 'To Do' },
  IN_PROGRESS: { dot: 'bg-blue-500', label: 'In Progress' },
  DONE: { dot: 'bg-green-500', label: 'Done' },
  ON_HOLD: { dot: 'bg-red-500', label: 'On Hold' },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="text-sm text-gray-900 truncate">{children}</div>
    </div>
  );
}

interface Props {
  task: ProjectTask | null;
  onClose: () => void;
  projectId: string;
  /** Whether the person can tick, add and remove subtasks. */
  canManageSubtasks: boolean;
  /** Shows an Edit button; leave out where the task can't be edited from here. */
  onEdit?: () => void;
  workType?: string;
  priority?: string;
  priorities?: PriorityLevel[];
  objectiveName?: string;
  /** With these, the objective is a chip you can click to change; without them it is plain text. */
  objectiveId?: string;
  objectiveOptions?: TypeChipOption[];
  onObjectiveChange?: (objectiveId: string) => void;
  assignees?: TaskAssignee[];
}

/** A task at a glance, in a narrow side panel: its details in a compact grid, then its subtasks. */
export function TaskDetailsPanel({
  task,
  onClose,
  projectId,
  canManageSubtasks,
  onEdit,
  workType,
  priority,
  priorities = [],
  objectiveName,
  objectiveId,
  objectiveOptions = [],
  onObjectiveChange,
  assignees = [],
}: Props) {
  const level = priorities.find((p) => p.name === priority);
  const chipLabel = [workType, priority].filter(Boolean).join(' · ');
  const meta = task ? STATUS_META[task.status] : null;

  return (
    <SidePanel
      isOpen={!!task}
      onClose={onClose}
      title={task?.name ?? ''}
      width="sm:w-[480px]"
      footer={
        onEdit ? (
          <div className="flex justify-end">
            <Button onClick={onEdit}>Edit Task</Button>
          </div>
        ) : undefined
      }
    >
      {task && meta && (
        <div className="flex flex-col gap-5">
          {chipLabel && (
            <TypeChip
              label={chipLabel}
              color={level ? PRIORITY_TYPE_CHIP_COLORS[level.color] : 'gray'}
            />
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Status">
              <span className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dot)} />
                {meta.label}
              </span>
            </Field>
            <Field label="Due Date">{task.dueDate ? formatDate(task.dueDate) : '—'}</Field>
            <Field label="Assigned To">
              <span className="whitespace-normal break-words">
                {assignees.length > 0 ? assignees.map((a) => a.name).join(', ') : '—'}
              </span>
            </Field>
            <Field label="Objective">
              {onObjectiveChange && objectiveOptions.length > 1 ? (
                <TypeChipSelect
                  value={objectiveId ?? ''}
                  options={objectiveOptions}
                  emptyLabel="—"
                  onChange={onObjectiveChange}
                />
              ) : (
                (objectiveName ?? '—')
              )}
            </Field>
          </div>

          <div className="h-px bg-gray-100" />

          <TaskSubtasks projectId={projectId} taskId={task.id} canModify={canManageSubtasks} />
        </div>
      )}
    </SidePanel>
  );
}
