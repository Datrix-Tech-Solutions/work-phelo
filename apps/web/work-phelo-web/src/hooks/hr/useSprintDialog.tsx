'use client';

import { useMemo, useState } from 'react';
import { SprintModal } from '@/components/organisms/hr/projects/SprintModal';
import {
  useAddSprint,
  useProjectSprints,
  useSaveWithToast,
  useUpdateSprint,
} from '@/hooks/hr/useProjectWork';
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

  const { data: allSprints = [] } = useProjectSprints(projectId);
  const addSprint = useAddSprint(projectId);
  const updateSprint = useUpdateSprint(projectId);
  const save = useSaveWithToast();

  // A task is in one sprint at a time, so the picker offers the ones no other sprint has taken.
  const taskOptions = useMemo(() => {
    const takenElsewhere = new Set(
      allSprints.filter((sp) => sp.id !== editing?.id).flatMap((sp) => sp.taskIds),
    );
    return tasks
      .filter((t) => !takenElsewhere.has(t.id))
      .map((t) => ({ value: t.id, label: t.name, sublabel: STATUS_LABEL[t.status] }));
  }, [allSprints, tasks, editing?.id]);

  const dialog = (
    <SprintModal
      key={editing?.id ?? 'new'}
      isOpen={open}
      onClose={() => setOpen(false)}
      onSubmit={(dto) =>
        save(
          editing ? updateSprint.mutateAsync({ id: editing.id, dto }) : addSprint.mutateAsync(dto),
        )
      }
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
