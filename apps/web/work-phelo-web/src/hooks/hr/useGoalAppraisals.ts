import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import type {
  Assessment,
  CycleInput,
  EmployeeObjective,
  Goal,
  GoalCycle,
  GoalInput,
  Ratings,
} from '@/types/appraisal';

// Shared so a loading query hands back the same empty array every render.
const NONE: never[] = [];

const toastError = (error: unknown) =>
  useToastStore.getState().addToast({ message: extractError(error), type: 'error' });

const ratingList = (ratings: Ratings) =>
  Object.entries(ratings).map(([objectiveId, r]) => ({
    objectiveId,
    score: r.score,
    comment: r.comment || undefined,
  }));

// ── Goals ────────────────────────────────────────────────────────────────────

export function useGoals() {
  const query = useQuery({
    queryKey: ['appraisal-goals'],
    queryFn: () => api.get<Goal[]>('/hr/appraisal-goals').then((r) => r.data),
  });
  return { goals: query.data ?? (NONE as Goal[]), isLoading: query.isLoading };
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return (...keys: string[]) =>
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
}

export function useSaveGoal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: GoalInput }) => {
      const body = {
        name: input.name,
        selfAssessmentWeight: input.selfAssessmentWeight,
        employeeIds: input.employeeIds,
      };
      return id
        ? api.patch(`/hr/appraisal-goals/${id}`, body).then((r) => r.data)
        : api.post('/hr/appraisal-goals', body).then((r) => r.data);
    },
    onSuccess: () => invalidate('appraisal-goals'),
    onError: toastError,
  });
}

export function useDeleteGoal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/hr/appraisal-goals/${id}`).then((r) => r.data),
    onSuccess: () => invalidate('appraisal-goals', 'appraisal-objectives'),
    onError: toastError,
  });
}

// ── Cycles ───────────────────────────────────────────────────────────────────

export function useGoalCycles() {
  const query = useQuery({
    queryKey: ['goal-cycles'],
    queryFn: () => api.get<GoalCycle[]>('/hr/appraisals/cycles').then((r) => r.data),
  });
  return { cycles: query.data ?? (NONE as GoalCycle[]), isLoading: query.isLoading };
}

export function useGoalCycle(id: string) {
  const { cycles, isLoading } = useGoalCycles();
  return { cycle: cycles.find((c) => c.id === id), isLoading };
}

export function useSaveCycle() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<CycleInput> }) =>
      id
        ? api.patch(`/hr/appraisals/cycles/${id}`, input).then((r) => r.data)
        : api.post('/hr/appraisals/cycles', input).then((r) => r.data),
    onSuccess: () => invalidate('goal-cycles'),
    onError: toastError,
  });
}

/** Start, close, cancel and delete change which assessments exist, so they refresh those too. */
function useCycleAction<T, R>(run: (arg: T) => Promise<R>) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: run,
    onSuccess: () => invalidate('goal-cycles', 'assessments'),
    onError: toastError,
  });
}

export const useStartCycle = () =>
  useCycleAction((id: string) =>
    api
      .post<{ message: string; skipped: number }>(`/hr/appraisals/cycles/${id}/start`)
      .then((r) => r.data),
  );
export const useCloseCycle = () =>
  useCycleAction((id: string) =>
    api.patch(`/hr/appraisals/cycles/${id}/close`).then((r) => r.data),
  );
export const useCancelCycle = () =>
  useCycleAction(({ id, reason }: { id: string; reason: string }) =>
    api.patch(`/hr/appraisals/cycles/${id}/cancel`, { reason }).then((r) => r.data),
  );
export const useDeleteCycle = () =>
  useCycleAction((id: string) => api.delete(`/hr/appraisals/cycles/${id}`).then((r) => r.data));

// ── Assessments ──────────────────────────────────────────────────────────────

function useAssessmentList(key: unknown[], url: string, enabled = true) {
  const query = useQuery({
    queryKey: ['assessments', ...key],
    queryFn: () => api.get<Assessment[]>(url).then((r) => r.data),
    enabled,
  });
  return { assessments: query.data ?? (NONE as Assessment[]), isLoading: query.isLoading };
}

export const useCycleAssessments = (cycleId: string) =>
  useAssessmentList(['cycle', cycleId], `/hr/appraisals/cycles/${cycleId}/assessments`);

export const useMyAssessments = () =>
  useAssessmentList(['mine'], '/hr/appraisals/assessments/mine');

export const useTeamAssessments = (enabled = true) =>
  useAssessmentList(['team'], '/hr/appraisals/assessments/team', enabled);

export const useEmployeeAssessments = (employeeId?: string) =>
  useAssessmentList(
    ['employee', employeeId],
    `/hr/appraisals/assessments/employee/${employeeId}`,
    !!employeeId,
  );

export function useAssessment(id: string) {
  const query = useQuery({
    queryKey: ['assessments', 'one', id],
    queryFn: () => api.get<Assessment>(`/hr/appraisals/assessments/${id}`).then((r) => r.data),
  });
  return { assessment: query.data, isLoading: query.isLoading };
}

/** Every assessment action changes lists and totals, so they all refresh together. */
function useAssessmentAction<T, R>(run: (arg: T) => Promise<R>) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: run,
    onSuccess: () => invalidate('assessments', 'goal-cycles'),
    onError: toastError,
  });
}

export const useSubmitSelfAssessment = () =>
  useAssessmentAction(({ id, ratings }: { id: string; ratings: Ratings }) =>
    api.patch(`/hr/appraisals/${id}/self-assessment`, { ratings: ratingList(ratings) }),
  );
export const useSubmitManagerReview = () =>
  useAssessmentAction(
    ({ id, ratings, comment }: { id: string; ratings: Ratings; comment: string }) =>
      api.patch(`/hr/appraisals/${id}/manager-review`, { ratings: ratingList(ratings), comment }),
  );
export const useApproveAssessment = () =>
  useAssessmentAction(({ id, note }: { id: string; note: string }) =>
    api.patch(`/hr/appraisals/${id}/finalize`, { note }),
  );
export const useRejectAssessment = () =>
  useAssessmentAction(({ id, reason }: { id: string; reason: string }) =>
    api.patch(`/hr/appraisals/${id}/reopen`, { target: 'MANAGER', reason }),
  );

// ── Objectives ───────────────────────────────────────────────────────────────

export function useEmployeeObjectives(employeeId?: string) {
  const query = useQuery({
    queryKey: ['appraisal-objectives', employeeId],
    queryFn: () =>
      api
        .get<EmployeeObjective[]>(`/hr/appraisal-objectives/employee/${employeeId}`)
        .then((r) => r.data),
    enabled: !!employeeId,
  });
  return { objectives: query.data ?? (NONE as EmployeeObjective[]), isLoading: query.isLoading };
}

export function useCreateObjective() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: {
      employeeId: string;
      goalId?: string;
      name: string;
      comments: string[];
    }) => api.post('/hr/appraisal-objectives', input).then((r) => r.data),
    onSuccess: () => invalidate('appraisal-objectives'),
    onError: toastError,
  });
}

export function useLinkObjective() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, goalId }: { id: string; goalId: string | null }) =>
      api.patch(`/hr/appraisal-objectives/${id}/goal`, { goalId }).then((r) => r.data),
    onSuccess: () => invalidate('appraisal-objectives'),
    onError: toastError,
  });
}

export function useAddObjectiveComment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.post(`/hr/appraisal-objectives/${id}/comments`, { body }).then((r) => r.data),
    onSuccess: () => invalidate('appraisal-objectives'),
    onError: toastError,
  });
}
