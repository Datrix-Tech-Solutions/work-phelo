import type { TypeChipColor } from '@/components/atoms/TypeChip';
import type { TaskStatus } from '@/types/hr';

/** How a task status reads, and the TypeChip colour it gets, wherever tasks are listed. */
export const TASK_STATUS_META: Record<TaskStatus, { label: string; chip: TypeChipColor }> = {
  TODO: { label: 'To Do', chip: 'gray' },
  IN_PROGRESS: { label: 'In Progress', chip: 'blue' },
  DONE: { label: 'Done', chip: 'green' },
  ON_HOLD: { label: 'On Hold', chip: 'red' },
};

export const TASK_STATUS_FILTER_OPTIONS = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DONE', label: 'Done' },
];
