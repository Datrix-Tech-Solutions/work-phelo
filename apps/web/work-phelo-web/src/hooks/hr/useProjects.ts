import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { projectSetup } from '@/lib/projectSetup';
import {
  ProjectDetail,
  ProjectTask,
  ProjectMember,
  ProjectActivity,
  MyTask,
  CreateProjectDto,
  UpdateProjectDto,
  CreateProjectTaskDto,
  UpdateProjectTaskDto,
  AddProjectMemberDto,
  TaskStatus,
} from '@/types/hr';

const KEY = 'projects';

/** Refetches what a change to a project's tasks can touch, not every query under 'projects': its task
 *  list, activity, its own record (status and progress), the list cards and the person's own tasks. */
function invalidateTaskChange(
  queryClient: QueryClient,
  projectId: string,
  also: ('sprints' | 'time' | 'subtasks')[] = [],
) {
  const keys = [
    [KEY, projectId, 'tasks'],
    [KEY, projectId, 'activities'],
    [KEY, 'my-tasks'],
    ...also.map((k) => [KEY, projectId, k]),
  ];
  keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  queryClient.invalidateQueries({ queryKey: [KEY, projectId], exact: true });
  queryClient.invalidateQueries({ queryKey: [KEY], exact: true });
  if (also.includes('time')) {
    queryClient.invalidateQueries({ queryKey: [KEY, 'my-running-timers'] });
  }
}

export function useProjects() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => {
      const res = await api.get<ProjectDetail[]>('/hr/projects');
      return res.data;
    },
  });
}

export function useMyProjects() {
  return useQuery({
    queryKey: [KEY, 'my-projects'],
    queryFn: async () => {
      const res = await api.get<ProjectDetail[]>('/hr/projects/my-projects');
      return res.data;
    },
  });
}

export function useEmployeeProjects(employeeId: string) {
  return useQuery({
    queryKey: [KEY, 'employee', employeeId],
    queryFn: async () => {
      const res = await api.get<ProjectDetail[]>(`/hr/projects/employee/${employeeId}`);
      return res.data;
    },
    enabled: !!employeeId,
  });
}

export function useMyTasks() {
  return useQuery({
    queryKey: [KEY, 'my-tasks'],
    queryFn: async () => {
      const res = await api.get<MyTask[]>('/hr/projects/my-tasks');
      return res.data;
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: [KEY, id],
    queryFn: async () => {
      const res = await api.get<ProjectDetail>(`/hr/projects/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

/** What a project was set up with: its workflow, work types, tabs, priorities, billing and client. */
export function useProjectSetup(projectId: string) {
  const { data: project } = useProject(projectId);
  return useMemo(() => projectSetup(project), [project]);
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateProjectDto) => {
      const res = await api.post<ProjectDetail>('/hr/projects', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProjectDto }) => {
      const res = await api.patch<ProjectDetail>(`/hr/projects/${id}`, data);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: [KEY, id] });
    },
  });
}

export function useArchiveProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<{ message: string }>(`/hr/projects/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: [KEY, projectId, 'members'],
    queryFn: async () => {
      const res = await api.get<ProjectMember[]>(`/hr/projects/${projectId}/members`);
      return res.data;
    },
    enabled: !!projectId,
  });
}

export function useAddProjectMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: AddProjectMemberDto }) => {
      const res = await api.post<ProjectMember>(`/hr/projects/${projectId}/members`, data);
      return res.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: [KEY, projectId] });
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'members'] });
    },
  });
}

/** Sets a member's hourly rate on a project. */
export function useUpdateProjectMemberRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      employeeId,
      hourlyRate,
    }: {
      projectId: string;
      employeeId: string;
      hourlyRate: number | null;
    }) => {
      const res = await api.patch<ProjectMember>(
        `/hr/projects/${projectId}/members/${employeeId}`,
        { hourlyRate },
      );
      return res.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'members'] });
    },
  });
}

export function useRemoveProjectMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, employeeId }: { projectId: string; employeeId: string }) => {
      const res = await api.delete<{ message: string }>(
        `/hr/projects/${projectId}/members/${employeeId}`,
      );
      return res.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: [KEY, projectId] });
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'members'] });
    },
  });
}

export function useProjectTasks(projectId: string) {
  return useQuery({
    queryKey: [KEY, projectId, 'tasks'],
    queryFn: async () => {
      const res = await api.get<ProjectTask[]>(`/hr/projects/${projectId}/tasks`);
      return res.data;
    },
    enabled: !!projectId,
  });
}

export function useCreateProjectTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: CreateProjectTaskDto }) => {
      const res = await api.post<ProjectTask>(`/hr/projects/${projectId}/tasks`, data);
      return res.data;
    },
    onSuccess: (_, { projectId }) => invalidateTaskChange(queryClient, projectId),
  });
}

export function useUpdateProjectTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      taskId,
      data,
    }: {
      projectId: string;
      taskId: string;
      data: UpdateProjectTaskDto;
    }) => {
      const res = await api.patch<ProjectTask>(`/hr/projects/${projectId}/tasks/${taskId}`, data);
      return res.data;
    },
    // Sprints hold tasks, and a finished task stops its timers on the server.
    onSuccess: (_, { projectId }) =>
      invalidateTaskChange(queryClient, projectId, ['sprints', 'time']),
  });
}

/** Moves a task: to a workflow stage (the status follows it) or, with no stage, straight to a status. */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      status,
      stage,
    }: {
      taskId: string;
      status?: TaskStatus;
      stage?: string;
    }) => {
      const res = await api.patch<ProjectTask>(
        `/hr/projects/tasks/${taskId}/status`,
        stage ? { stage } : { status },
      );
      return res.data;
    },
    onSuccess: (updated, { taskId }) => {
      // Put the new status and stage straight into the cached task lists, so the board doesn't show
      // the old ones until the refetch below lands.
      queryClient.setQueriesData<ProjectTask[]>(
        { queryKey: [KEY], predicate: (q) => q.queryKey[2] === 'tasks' },
        (old) =>
          old?.map((t) =>
            t.id === taskId ? { ...t, status: updated.status, stage: updated.stage } : t,
          ),
      );
      // Going to Done stops the task's timers on the server.
      invalidateTaskChange(
        queryClient,
        updated.projectId,
        updated.status === 'DONE' ? ['time', 'sprints'] : ['sprints'],
      );
    },
  });
}

export function useDeleteProjectTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, taskId }: { projectId: string; taskId: string }) => {
      const res = await api.delete<{ message: string }>(
        `/hr/projects/${projectId}/tasks/${taskId}`,
      );
      return res.data;
    },
    // The task's subtasks go with it.
    onSuccess: (_, { projectId }) =>
      invalidateTaskChange(queryClient, projectId, ['sprints', 'time', 'subtasks']),
  });
}

export function useProjectActivities(projectId: string) {
  return useQuery({
    queryKey: [KEY, projectId, 'activities'],
    queryFn: async () => {
      const res = await api.get<ProjectActivity[]>(`/hr/projects/${projectId}/activities`);
      return res.data;
    },
    enabled: !!projectId,
  });
}
