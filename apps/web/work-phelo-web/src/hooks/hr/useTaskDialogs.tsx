'use client';

import { useMemo, useState } from 'react';
import { CreateTaskModal } from '@/components/organisms/hr/projects/CreateTaskModal';
import { EditTaskModal } from '@/components/organisms/hr/projects/EditTaskModal';
import { TaskDetailsPanel } from '@/components/organisms/hr/projects/TaskDetailsPanel';
import type { TaskAssignee, TaskStatus } from '@/types/hr';
import {
  useProjectTasks,
  useCreateProjectTask,
  useUpdateProjectTask,
  useProject,
  useProjectSetup,
  useMyProfile,
  usePermission,
} from '@/hooks';
import {
  useProjectObjectives,
  useProjectSprints,
  useUpdateSprint,
} from '@/hooks/hr/useProjectWork';
import { Permission } from '@/lib/permissionMap';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { projectTaskOptions } from '@/lib/projectTaskOptions';
import { taskAssignees } from '@/lib/taskAssignees';
import { objectiveChipOptions } from '@/lib/objectiveChipOptions';

/**
 * The create, details and edit dialogs for a project's tasks, shared by every screen that lists tasks.
 * Render `dialogs` once and call `openCreate` / `openDetails` from the list.
 */
export function useTaskDialogs(projectId: string) {
  const toast = useToastStore((s) => s.addToast);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);

  const canManageProjects = usePermission(Permission.CREATE_PROJECT_TASK);
  const { data: myProfile } = useMyProfile();
  const { data: project } = useProject(projectId);
  const isProjectManager = !!(
    project?.managerId &&
    myProfile?.id &&
    project.managerId === myProfile.id
  );
  const canModify = canManageProjects || isProjectManager;

  const { data: tasks = [] } = useProjectTasks(projectId);
  const { data: objectives = [] } = useProjectObjectives(projectId);
  const { data: sprints = [] } = useProjectSprints(projectId);
  const updateSprint = useUpdateSprint(projectId);
  const setup = useProjectSetup(projectId);
  const config = setup?.config;
  const pricing = setup?.pricing;
  const { workTypeOptions, priorityOptions, defaultWorkType, defaultPriority } = useMemo(
    () => projectTaskOptions(config),
    [config],
  );

  const objectiveOptions = useMemo(
    () => objectives.map((o) => ({ value: o.id, label: o.name })),
    [objectives],
  );

  const createTask = useCreateProjectTask();
  const updateTask = useUpdateProjectTask();

  const detailsTask = tasks.find((t) => t.id === detailsTaskId) ?? null;
  const editTask = tasks.find((t) => t.id === editTaskId) ?? null;

  const handleCreate = async (values: {
    name: string;
    dueDate: string;
    status: 'TODO';
    assignees: TaskAssignee[];
    objectiveId?: string;
    workType?: string;
    priority?: string;
    timed?: boolean;
  }) => {
    try {
      await createTask.mutateAsync({
        projectId,
        data: {
          name: values.name,
          dueDate: values.dueDate || undefined,
          assignedEmployeeId: values.assignees[0]?.id,
          assigneeIds: values.assignees.map((a) => a.id),
          objectiveId: values.objectiveId || undefined,
          workType: values.workType || undefined,
          priorityName: values.priority || undefined,
          isTimed: values.timed || undefined,
        },
      });
      setCreateOpen(false);
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  /** Creates a task straight from a list's inline row, with the project's default type and priority. */
  const quickCreate = async (values: {
    name: string;
    dueDate?: string;
    assignees: TaskAssignee[];
    objectiveId?: string;
    timed?: boolean;
    sprintId?: string;
  }) => {
    try {
      const task = await createTask.mutateAsync({
        projectId,
        data: {
          name: values.name,
          dueDate: values.dueDate || undefined,
          assignedEmployeeId: values.assignees[0]?.id,
          assigneeIds: values.assignees.map((a) => a.id),
          objectiveId: values.objectiveId || undefined,
          workType: defaultWorkType || undefined,
          priorityName: defaultPriority || undefined,
          isTimed: values.timed || undefined,
        },
      });
      const sprint = sprints.find((sp) => sp.id === values.sprintId);
      if (sprint) {
        await updateSprint.mutateAsync({
          id: sprint.id,
          dto: {
            name: sprint.name,
            startDate: sprint.startDate,
            endDate: sprint.endDate,
            taskIds: [...sprint.taskIds, task.id],
          },
        });
      }
      return true;
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
      return false;
    }
  };

  const handleSave = async (
    taskId: string,
    values: {
      name: string;
      dueDate: string;
      status: TaskStatus;
      assignees: TaskAssignee[];
      objectiveId?: string;
      workType?: string;
      priority?: string;
      timed?: boolean;
    },
  ) => {
    try {
      await updateTask.mutateAsync({
        projectId,
        taskId,
        data: {
          name: values.name,
          dueDate: values.dueDate || undefined,
          status: values.status,
          assignedEmployeeId: values.assignees[0]?.id,
          assigneeIds: values.assignees.map((a) => a.id),
          objectiveId: values.objectiveId || null,
          workType: values.workType || undefined,
          priorityName: values.priority || undefined,
          isTimed: !!values.timed,
        },
      });
      setEditTaskId(null);
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const changeObjective = async (taskId: string, objectiveId: string) => {
    try {
      await updateTask.mutateAsync({
        projectId,
        taskId,
        data: { objectiveId: objectiveId || null },
      });
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const dialogs = (
    <>
      {canModify && (
        <CreateTaskModal
          projectId={projectId}
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreate}
          isCreating={createTask.isPending}
          objectiveOptions={objectiveOptions}
          workTypeOptions={workTypeOptions}
          priorityOptions={priorityOptions}
          defaultWorkType={defaultWorkType}
          defaultPriority={defaultPriority}
          defaultTimed={pricing?.type === 'TIMED'}
        />
      )}

      <TaskDetailsPanel
        task={detailsTask}
        onClose={() => setDetailsTaskId(null)}
        projectId={projectId}
        canManageSubtasks={canModify}
        // A finished task can't be edited, only looked at.
        onEdit={
          canModify && detailsTask && detailsTask.status !== 'DONE'
            ? () => {
                setEditTaskId(detailsTask.id);
                setDetailsTaskId(null);
              }
            : undefined
        }
        workType={detailsTask?.workType ?? undefined}
        priority={detailsTask?.priorityName ?? undefined}
        priorities={config?.priorities}
        assignees={detailsTask ? taskAssignees(detailsTask) : []}
        objectiveId={detailsTask?.objectiveId ?? undefined}
        objectiveOptions={objectiveChipOptions(objectives)}
        onObjectiveChange={
          canModify && detailsTask ? (id) => changeObjective(detailsTask.id, id) : undefined
        }
        objectiveName={
          detailsTask ? objectives.find((o) => o.id === detailsTask.objectiveId)?.name : undefined
        }
      />

      <EditTaskModal
        task={editTask}
        isOpen={!!editTask}
        onClose={() => setEditTaskId(null)}
        onSave={handleSave}
        isSaving={updateTask.isPending}
        objectiveOptions={objectiveOptions}
        currentObjectiveId={editTask?.objectiveId ?? undefined}
        workTypeOptions={workTypeOptions}
        priorityOptions={priorityOptions}
        currentWorkType={editTask?.workType ?? undefined}
        currentPriority={editTask?.priorityName ?? undefined}
        currentTimed={!!editTask?.isTimed}
        currentAssignees={editTask ? taskAssignees(editTask) : []}
      />
    </>
  );

  return {
    canModify,
    openCreate: () => setCreateOpen(true),
    quickCreate,
    isQuickCreating: createTask.isPending || updateSprint.isPending,
    defaultTimed: pricing?.type === 'TIMED',
    openDetails: (taskId: string) => setDetailsTaskId(taskId),
    dialogs,
  };
}
