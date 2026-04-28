import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AppraisalCycle,
  AppraisalKpi,
  AppraisalTemplate,
  CreateAppraisalCycleDto,
  CreateAppraisalKpiDto,
  CreateAppraisalTemplateDto,
  CycleResultsSummary,
} from '@/types/hr';

type ListParams = { page?: number; search?: string };
type KpiScoreInput = { kpiId: string; score: number; comment?: string };
type ReviewSubmissionInput = {
  id: string;
  score?: number;
  comment?: string;
  kpiScores?: KpiScoreInput[];
};
type MyAppraisalRecord = Record<string, unknown> & {
  id: unknown;
  cycleId: unknown;
  cycleName?: unknown;
  cycleStatus?: string;
  overallStatus?: string;
  overallScore?: number | null;
  cycle?: unknown;
};
type TeamAppraisalRecord = Record<string, unknown> & {
  id: unknown;
  employeeId: unknown;
  cycleId: unknown;
  employeeName?: unknown;
  cycleName?: unknown;
  selfSubmittedAt?: unknown;
  managerReviewDeadline?: unknown;
  overallStatus?: string;
};

function unpackListResponse<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.cycles)) return record.cycles as T[];
    if (Array.isArray(record.templates)) return record.templates as T[];
    if (Array.isArray(record.notifications)) return record.notifications as T[];
  }

  return [];
}

function normalizeCycle(cycle: Record<string, unknown>): AppraisalCycle {
  return {
    ...cycle,
    title: String(cycle.title ?? cycle.name ?? ''),
    name: String(cycle.name ?? cycle.title ?? ''),
  } as AppraisalCycle & { name: string };
}

function normalizeTemplate(template: Record<string, unknown>): AppraisalTemplate {
  return {
    ...template,
    kpis: Array.isArray(template.kpis) ? template.kpis : [],
  } as AppraisalTemplate;
}

function stripTemplatePayload(
  dto: Partial<CreateAppraisalTemplateDto>,
): Partial<CreateAppraisalTemplateDto> {
  const payload = { ...dto } as Partial<CreateAppraisalTemplateDto> & {
    tenantSlug?: string;
  };
  delete payload.tenantSlug;
  return payload;
}

function buildReviewPayload(input: Omit<ReviewSubmissionInput, 'id'>) {
  const payload: {
    score?: number;
    comment?: string;
    kpiScores?: KpiScoreInput[];
  } = {};

  if (typeof input.score === 'number') payload.score = input.score;
  if (typeof input.comment === 'string' && input.comment.length > 0) {
    payload.comment = input.comment;
  } else if (input.comment === '') {
    payload.comment = '';
  }
  if (input.kpiScores?.length) payload.kpiScores = input.kpiScores;

  return payload;
}

export function useAppraisalTemplates(params?: ListParams) {
  return useQuery<AppraisalTemplate[]>({
    queryKey: params ? ['appraisal-templates', params] : ['appraisal-templates'],
    queryFn: async () => {
      const res = await api.get('/hr/appraisals/templates', {
        params: params ? { page: params.page, search: params.search || undefined } : undefined,
      });
      return unpackListResponse<Record<string, unknown>>(res.data).map(normalizeTemplate);
    },
  });
}

export function useCreateAppraisalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<CreateAppraisalTemplateDto>) =>
      api.post('/hr/appraisals/templates', stripTemplatePayload(dto)).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-templates'] });
    },
  });
}

export function useUpdateAppraisalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Partial<CreateAppraisalTemplateDto>) =>
      api.put(`/hr/appraisals/templates/${id}`, stripTemplatePayload(dto)).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-templates'] });
    },
  });
}

export function useDeleteAppraisalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/hr/appraisals/templates/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-templates'] });
    },
  });
}

export function useAppraisalCycles(params?: ListParams) {
  return useQuery<AppraisalCycle[]>({
    queryKey: params ? ['appraisal-cycles', params] : ['appraisal-cycles'],
    queryFn: async () => {
      const res = await api.get('/hr/appraisals/cycles', {
        params: params ? { page: params.page, search: params.search || undefined } : undefined,
      });
      return unpackListResponse<Record<string, unknown>>(res.data).map(normalizeCycle);
    },
  });
}

export function useCreateAppraisalCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<CreateAppraisalCycleDto>) =>
      api.post('/hr/appraisals/cycles', dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles'] });
    },
  });
}

export function useUpdateAppraisalCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Partial<CreateAppraisalCycleDto>) =>
      api.patch(`/hr/appraisals/cycles/${id}`, dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles'] });
    },
  });
}

export function useDeleteAppraisalCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/hr/appraisals/cycles/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles'] });
    },
  });
}

export function useStartAppraisalCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cycleId: string) =>
      api.post(`/hr/appraisals/cycles/${cycleId}/start`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles'] });
    },
  });
}

export function useCycleAppraisals(cycleId: string) {
  return useQuery({
    queryKey: ['cycle-appraisals', cycleId],
    queryFn: () => api.get(`/hr/appraisals/cycles/${cycleId}/appraisals`).then((r) => r.data),
    enabled: !!cycleId,
  });
}

export function useCycleKpis(cycleId: string) {
  return useQuery<AppraisalKpi[]>({
    queryKey: ['cycle-kpis', cycleId],
    queryFn: async () => {
      const res = await api.get(`/hr/appraisals/cycles/${cycleId}/kpis`);
      return unpackListResponse<AppraisalKpi>(res.data);
    },
    enabled: !!cycleId,
  });
}

export function useCreateCycleKpi(cycleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<CreateAppraisalKpiDto>) =>
      api.post(`/hr/appraisals/cycles/${cycleId}/kpis`, dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-kpis', cycleId] });
    },
  });
}

export function useUpdateCycleKpi(cycleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: { id: string } & Partial<CreateAppraisalKpiDto>) =>
      api.put(`/hr/appraisals/cycles/${cycleId}/kpis/${id}`, dto).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-kpis', cycleId] });
    },
  });
}

export function useSeedCycleFromTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cycleId: string) =>
      api.post(`/hr/appraisals/cycles/${cycleId}/seed-from-template`).then((r) => r.data),
    onSuccess: (_, cycleId) => {
      queryClient.invalidateQueries({ queryKey: ['cycle-kpis', cycleId] });
      queryClient.invalidateQueries({ queryKey: ['appraisal-cycles'] });
    },
  });
}

export function useCycleResults(cycleId: string) {
  return useQuery<CycleResultsSummary>({
    queryKey: ['cycle-results', cycleId],
    queryFn: () => api.get(`/hr/appraisals/cycles/${cycleId}/results`).then((r) => r.data),
    enabled: !!cycleId,
  });
}

export function useAppraisal(id: string) {
  return useQuery({
    queryKey: ['appraisal', id],
    queryFn: () => api.get(`/hr/appraisals/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useMyAppraisals() {
  return useQuery<MyAppraisalRecord[]>({
    queryKey: ['my-appraisals'],
    queryFn: async () => {
      const res = await api.get('/hr/appraisals/my');
      const list = unpackListResponse<MyAppraisalRecord>(res.data);
      return list.map((appraisal) => {
        const cycle = appraisal.cycle as Record<string, unknown> | undefined;
        return {
          ...appraisal,
          cycleName:
            (appraisal.cycleName as string) ??
            (cycle?.title as string) ??
            (cycle?.name as string) ??
            '',
          cycleStatus: (appraisal.cycleStatus as string) ?? 'UPCOMING',
          overallStatus: (appraisal.overallStatus as string) ?? 'NotStarted',
        };
      });
    },
  });
}

export function useTeamAppraisals() {
  return useQuery<TeamAppraisalRecord[]>({
    queryKey: ['team-appraisals'],
    queryFn: async () => {
      const res = await api.get('/hr/appraisals/team');
      return unpackListResponse<TeamAppraisalRecord>(res.data);
    },
  });
}

export function useSubmitSelfAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: ReviewSubmissionInput) =>
      api
        .patch(`/hr/appraisals/${id}/self-assessment`, buildReviewPayload(payload))
        .then((r) => r.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['my-appraisals'] });
      queryClient.invalidateQueries({ queryKey: ['appraisal', id] });
    },
  });
}

export function useSubmitManagerReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: ReviewSubmissionInput) =>
      api
        .patch(`/hr/appraisals/${id}/manager-review`, buildReviewPayload(payload))
        .then((r) => r.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['team-appraisals'] });
      queryClient.invalidateQueries({ queryKey: ['cycle-appraisals'] });
      queryClient.invalidateQueries({ queryKey: ['appraisal', id] });
    },
  });
}
