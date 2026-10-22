'use client';

import { useMemo, useState } from 'react';
import { SprintModal } from '@/components/organisms/hr/projects/SprintModal';
import { useProjectWorkStore } from '@/store/projectWork.store';
import type { ProjectSprint, ProjectTask, TaskStatus } from '@/types/hr';

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  DONE: 'Done',
};

/**
 * The create / edit sprint pop-up, shared by the Sprints tab and the Backlog. Render `dialog` once and
 * call `openSprint()` to create or `openSprint(sprint)` to edit.
 */
export function useSprintDialog(projectId: string, tasks: ProjectTask[]) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectSprint | undefined>();

  const allSprints = useProjectWorkStore((s) => s.sprints);
  const addSprint = useProjectWorkStore((s) => s.addSprint);
  const updateSprint = useProjectWorkStore((s) => s.updateSprint);

  // A task is in one sprint at a time, so the picker offers the ones no other sprint has taken.
  const taskOptions = useMemo(() => {
    const takenElsewhere = new Set(
      allSprints
        .filter((sp) => sp.projectId === projectId && sp.id !== editing?.id)
        .flatMap((sp) => sp.taskIds),
    );
    return tasks
      .filter((t) => !takenElsewhere.has(t.id))
      .map((t) => ({ value: t.id, label: t.name, sublabel: STATUS_LABEL[t.status] }));
  }, [allSprints, tasks, projectId, editing?.id]);

  const dialog = (
    <SprintModal
      key={editing?.id ?? 'new'}
      isOpen={open}
      onClose={() => setOpen(false)}
      onSubmit={(dto) => (editing ? updateSprint(editing.id, dto) : addSprint(projectId, dto))}
      taskOptions={taskOptions}
      sprint={editing}
    />
  );

  return {
    openSprint: (sprint?: ProjectSprint) => {
      setEditing(sprint);
      setOpen(true);
    },
    dialog,
  };
}
