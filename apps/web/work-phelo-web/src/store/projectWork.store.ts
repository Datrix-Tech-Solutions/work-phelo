import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProjectObjective, ProjectSprint, ProjectSubtask, TaskAssignee } from '@/types/hr';

export type SprintInput = Pick<ProjectSprint, 'name' | 'startDate' | 'endDate' | 'taskIds'>;

interface ProjectWorkStore {
  objectives: ProjectObjective[];
  /** The objective each task belongs to, by task id. A task with no entry sits directly under the project. */
  objectiveByTaskId: Record<string, string>;
  subtasks: ProjectSubtask[];
  sprints: ProjectSprint[];
  /** Everyone a task is assigned to, by task id (the backend holds only one assignee). */
  assigneesByTaskId: Record<string, TaskAssignee[]>;
  /** A task's work type and priority, by task id, as names from the project's own setup. */
  taskMeta: Record<string, { workType: string; priority: string }>;
  addObjective: (projectId: string, dto: { name: string; description?: string }) => string;
  updateObjective: (id: string, dto: { name: string; description?: string }) => void;
  /** Removes the objective; its tasks stay, directly under the project. */
  removeObjective: (id: string) => void;
  setTaskObjective: (taskId: string, objectiveId: string | null) => void;
  setTaskAssignees: (taskId: string, assignees: TaskAssignee[]) => void;
  setTaskMeta: (taskId: string, meta: { workType: string; priority: string }) => void;
  addSubtask: (projectId: string, dto: { name: string; taskId: string }) => void;
  updateSubtask: (id: string, patch: Partial<Pick<ProjectSubtask, 'name' | 'done'>>) => void;
  removeSubtask: (id: string) => void;
  addSprint: (projectId: string, dto: SprintInput) => void;
  updateSprint: (id: string, dto: SprintInput) => void;
  removeSprint: (id: string) => void;
  /** Marks the sprint completed. Only `keepTaskIds` stay in it; the rest go back to the backlog. */
  completeSprint: (id: string, keepTaskIds: string[], completedAt: string) => void;
}

// Local-storage only until the project backend is rebuilt.
export const useProjectWorkStore = create<ProjectWorkStore>()(
  persist(
    (set) => ({
      objectives: [],
      objectiveByTaskId: {},
      subtasks: [],
      sprints: [],
      taskMeta: {},
      assigneesByTaskId: {},
      addObjective: (projectId, dto) => {
        const id = crypto.randomUUID();
        set((s) => ({
          objectives: [
            ...s.objectives,
            { ...dto, id, projectId, createdAt: new Date().toISOString() },
          ],
        }));
        return id;
      },
      updateObjective: (id, dto) =>
        set((s) => ({ objectives: s.objectives.map((o) => (o.id === id ? { ...o, ...dto } : o)) })),
      removeObjective: (id) =>
        set((s) => ({
          objectives: s.objectives.filter((o) => o.id !== id),
          objectiveByTaskId: Object.fromEntries(
            Object.entries(s.objectiveByTaskId).filter(([, objectiveId]) => objectiveId !== id),
          ),
        })),
      setTaskObjective: (taskId, objectiveId) =>
        set((s) => {
          const rest = Object.fromEntries(
            Object.entries(s.objectiveByTaskId).filter(([key]) => key !== taskId),
          );
          return { objectiveByTaskId: objectiveId ? { ...rest, [taskId]: objectiveId } : rest };
        }),
      setTaskAssignees: (taskId, assignees) =>
        set((s) => ({ assigneesByTaskId: { ...s.assigneesByTaskId, [taskId]: assignees } })),
      setTaskMeta: (taskId, meta) => set((s) => ({ taskMeta: { ...s.taskMeta, [taskId]: meta } })),
      addSubtask: (projectId, dto) =>
        set((s) => ({
          subtasks: [
            ...s.subtasks,
            {
              ...dto,
              id: crypto.randomUUID(),
              projectId,
              done: false,
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      updateSubtask: (id, patch) =>
        set((s) => ({
          subtasks: s.subtasks.map((st) => (st.id === id ? { ...st, ...patch } : st)),
        })),
      removeSubtask: (id) => set((s) => ({ subtasks: s.subtasks.filter((st) => st.id !== id) })),
      addSprint: (projectId, dto) =>
        set((s) => ({
          sprints: [
            ...s.sprints,
            { ...dto, id: crypto.randomUUID(), projectId, createdAt: new Date().toISOString() },
          ],
        })),
      updateSprint: (id, dto) =>
        set((s) => ({ sprints: s.sprints.map((sp) => (sp.id === id ? { ...sp, ...dto } : sp)) })),
      removeSprint: (id) => set((s) => ({ sprints: s.sprints.filter((sp) => sp.id !== id) })),
      completeSprint: (id, keepTaskIds, completedAt) =>
        set((s) => ({
          sprints: s.sprints.map((sp) =>
            sp.id === id
              ? { ...sp, completedAt, taskIds: sp.taskIds.filter((t) => keepTaskIds.includes(t)) }
              : sp,
          ),
        })),
    }),
    {
      name: 'project-objectives-store',
      version: 1,
      // v0 subtasks hung under a task, an objective or the project via `parent`. Only the ones
      // under a task are kept: a subtask must belong to a task.
      migrate: (persisted) => {
        const state = persisted as {
          subtasks?: Array<
            { parent?: { type: string; id: string } | null } & Record<string, unknown>
          >;
        } & Record<string, unknown>;
        return {
          ...state,
          subtasks: (state.subtasks ?? []).flatMap((st) => {
            if (typeof st.taskId === 'string') return [st];
            if (st.parent?.type !== 'TASK') return [];
            const { parent, ...rest } = st;
            return [{ ...rest, taskId: parent.id }];
          }),
        };
      },
    },
  ),
);
