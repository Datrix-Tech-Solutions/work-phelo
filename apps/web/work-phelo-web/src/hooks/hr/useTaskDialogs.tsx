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
  useMyProfile,
  usePermission,
} from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { useProjectWorkStore } from '@/store/projectWork.store';
import { useTaskTimeStore } from '@/store/taskTime.store';
import { useProjectLocalStore } from '@/store/projectLocal.store';
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
  const allObjectives = useProjectWorkStore((s) => s.objectives);
  const objectiveByTaskId = useProjectWorkStore((s) => s.objectiveByTaskId);
  const setTaskObjective = useProjectWorkStore((s) => s.setTaskObjective);
  const taskMeta = useProjectWorkStore((s) => s.taskMeta);
  const setTaskMeta = useProjectWorkStore((s) => s.setTaskMeta);
  const assigneesByTaskId = useProjectWorkStore((s) => s.assigneesByTaskId);
  const setTaskAssignees = useProjectWorkStore((s) => s.setTaskAssignees);
  const timedByTaskId = useTaskTimeStore((s) => s.timedByTaskId);
  const setTimed = useTaskTimeStore((s) => s.setTimed);
  const config = useProjectLocalStore((s) => s.byProjectId[projectId]?.config);
  const { workTypeOptions, priorityOptions, defaultWorkType, defaultPriority } = useMemo(
    () => projectTaskOptions(config),
    [config],
  );

  const objectives = useMemo(
    () => allObjectives.filter((o) => o.projectId === projectId),
    [allObjectives, projectId],
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
      const task = await createTask.mutateAsync({
        projectId,
        data: {
          name: values.name,
          dueDate: values.dueDate || undefined,
          // The backend holds one assignee, so it gets the first; the full list is kept locally.
          assignedEmployeeId: values.assignees[0]?.id,
        },
      });
      setTaskAssignees(task.id, values.assignees);
      if (values.timed) setTimed(task.id, true);
      if (values.objectiveId) setTaskObjective(task.id, values.objectiveId);
      if (values.workType || values.priority)
        setTaskMeta(task.id, { workType: values.workType ?? '', priority: values.priority ?? '' });
      setCreateOpen(false);
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
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
        },
      });
      setTaskAssignees(taskId, values.assignees);
      setTimed(taskId, !!values.timed);
      if (values.status === 'DONE') useTaskTimeStore.getState().pauseAll(taskId);
      setTaskObjective(taskId, values.objectiveId ?? null);
      if (values.workType || values.priority)
        setTaskMeta(taskId, { workType: values.workType ?? '', priority: values.priority ?? '' });
      setEditTaskId(null);
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
        workType={detailsTask ? taskMeta[detailsTask.id]?.workType : undefined}
        priority={detailsTask ? taskMeta[detailsTask.id]?.priority : undefined}
        priorities={config?.priorities}
        assignees={detailsTask ? taskAssignees(detailsTask, assigneesByTaskId) : []}
        objectiveId={detailsTask ? objectiveByTaskId[detailsTask.id] : undefined}
        objectiveOptions={objectiveChipOptions(objectives)}
        onObjectiveChange={
          canModify && detailsTask
            ? (id) => setTaskObjective(detailsTask.id, id || null)
            : undefined
        }
        objectiveName={
          detailsTask
            ? objectives.find((o) => o.id === objectiveByTaskId[detailsTask.id])?.name
            : undefined
        }
      />

      <EditTaskModal
        task={editTask}
        isOpen={!!editTask}
        onClose={() => setEditTaskId(null)}
        onSave={handleSave}
        isSaving={updateTask.isPending}
        objectiveOptions={objectiveOptions}
        currentObjectiveId={editTask ? objectiveByTaskId[editTask.id] : undefined}
        workTypeOptions={workTypeOptions}
        priorityOptions={priorityOptions}
        currentWorkType={editTask ? taskMeta[editTask.id]?.workType : undefined}
        currentPriority={editTask ? taskMeta[editTask.id]?.priority : undefined}
        currentTimed={editTask ? !!timedByTaskId[editTask.id] : false}
        currentAssignees={editTask ? taskAssignees(editTask, assigneesByTaskId) : []}
      />
    </>
  );

  return {
    canModify,
    openCreate: () => setCreateOpen(true),
    openDetails: (taskId: string) => setDetailsTaskId(taskId),
    dialogs,
  };
}
