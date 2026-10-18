import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { educationLevelLabel } from '@/lib/hr/educationLevels';
import type {
  CutoffResult,
  JobOpeningStatus,
  RecruitmentCandidate,
  CandidateInterview,
  InterviewMode,
  InterviewStatus,
  RecruitmentCandidateDetail,
  RecruitmentCandidatePage,
  RecruitmentStageHistoryEntry,
  RecruitmentStage,
  RecruitmentVacancy,
  RecruitmentVacancyPage,
  RecruitmentVacancyPayload,
  ScheduleInterviewInput,
  VacancyDetails,
} from '@/types/recruitment';

const VACANCIES_KEY = ['recruitment', 'vacancies'] as const;

interface JobOpeningsQuery {
  search?: string;
  status?: JobOpeningStatus;
  page?: number;
  limit?: number;
}

export function useJobOpenings({ search, status, page = 1, limit = 8 }: JobOpeningsQuery = {}) {
  return useQuery({
    queryKey: [...VACANCIES_KEY, 'list', { search, status, page, limit }],
    queryFn: async () => {
      const res = await api.get<RecruitmentVacancyPage>('/hr/recruitment/vacancies', {
        params: { search: search || undefined, status, page, limit },
      });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useJobOpening(id: string) {
  return useQuery({
    queryKey: [...VACANCIES_KEY, 'detail', id],
    queryFn: async () => {
      const res = await api.get<RecruitmentVacancy>(`/hr/recruitment/vacancies/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateJobOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RecruitmentVacancyPayload) => {
      const res = await api.post<RecruitmentVacancy>('/hr/recruitment/vacancies', payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VACANCIES_KEY }),
  });
}

export function useUpdateJobOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: RecruitmentVacancyPayload & { id: string }) => {
      const res = await api.patch<RecruitmentVacancy>(`/hr/recruitment/vacancies/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VACANCIES_KEY }),
  });
}

/** Moves a draft opening to OPEN. The API checks the fields a public posting needs. */
export function usePublishJobOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<RecruitmentVacancy>(`/hr/recruitment/vacancies/${id}`, {
        status: 'OPEN',
      });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VACANCIES_KEY }),
  });
}

export function useReopenJobOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<RecruitmentVacancy>(`/hr/recruitment/vacancies/${id}/reopen`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VACANCIES_KEY }),
  });
}

/** Sets the match-score cut-off; with `dryRun` it only reports who would move. */
export function useSetCutoff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      cutoffScore,
      dryRun,
    }: {
      id: string;
      cutoffScore: number | null;
      dryRun?: boolean;
    }) => {
      const res = await api.post<CutoffResult>(`/hr/recruitment/vacancies/${id}/cutoff`, {
        cutoffScore,
        dryRun,
      });
      return res.data;
    },
    onSuccess: (result) => {
      if (!result.applied) return;
      queryClient.invalidateQueries({ queryKey: VACANCIES_KEY });
      queryClient.invalidateQueries({ queryKey: ['recruitment', 'candidates'] });
    },
  });
}

export function useCloseJobOpening() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<RecruitmentVacancy>(`/hr/recruitment/vacancies/${id}/close`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VACANCIES_KEY }),
  });
}

const CANDIDATES_KEY = ['recruitment', 'candidates'] as const;
const STAGES_KEY = ['recruitment', 'stages'] as const;

interface CandidatesQuery {
  search?: string;
  vacancyId?: string;
  stageId?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export function useCandidates({
  search,
  vacancyId,
  stageId,
  page = 1,
  limit = 10,
  enabled = true,
}: CandidatesQuery = {}) {
  return useQuery({
    enabled,
    queryKey: [...CANDIDATES_KEY, 'list', { search, vacancyId, stageId, page, limit }],
    queryFn: async () => {
      const res = await api.get<RecruitmentCandidatePage>('/hr/recruitment/candidates', {
        params: {
          search: search || undefined,
          vacancyId: vacancyId || undefined,
          stageId: stageId || undefined,
          page,
          limit,
        },
      });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useRecruitmentStages(enabled = true) {
  return useQuery({
    queryKey: STAGES_KEY,
    queryFn: async () => {
      const res = await api.get<RecruitmentStage[]>('/hr/recruitment/stages');
      return res.data;
    },
    enabled,
  });
}

export function useCreateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const res = await api.post<RecruitmentStage>('/hr/recruitment/stages', payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STAGES_KEY }),
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name?: string; description?: string }) => {
      const res = await api.patch<RecruitmentStage>(`/hr/recruitment/stages/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STAGES_KEY }),
  });
}

export function useDeleteStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/recruitment/stages/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STAGES_KEY }),
  });
}

export function useMoveCandidateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stageId, note }: { id: string; stageId: string; note?: string }) => {
      const res = await api.patch<RecruitmentCandidate>(`/hr/recruitment/candidates/${id}/stage`, {
        stageId,
        note: note || undefined,
      });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CANDIDATES_KEY }),
  });
}

interface ApiEducationEntry {
  level?: string;
  qualification?: string;
  institution?: string;
}

interface ApiWorkEntry {
  role?: string;
  company?: string;
  start?: string;
  end?: string;
}

type ApiCandidateDetail = Omit<
  RecruitmentCandidateDetail,
  'languages' | 'certificates' | 'educationHistory' | 'experienceHistory'
> & {
  languages?: string[] | null;
  certificates?: string[] | null;
  educationHistory?: ApiEducationEntry[] | null;
  workHistory?: ApiWorkEntry[] | null;
};

/** Applications made before structured history existed only have the single-value fields. */
function normalizeCandidate(raw: ApiCandidateDetail): RecruitmentCandidateDetail {
  const school = raw.education?.trim();
  const role = raw.currentJobTitle?.trim();

  const structuredEducation = (raw.educationHistory ?? []).map((entry) => ({
    school: [entry.qualification, entry.institution].filter(Boolean).join(', ') || 'Not specified',
    level: entry.level ? educationLevelLabel(entry.level) : null,
    startYear: null,
    endYear: null,
  }));
  const structuredExperience = (raw.workHistory ?? []).map((entry) => ({
    role: entry.role ?? '',
    company: entry.company || null,
    startDate: entry.start || null,
    endDate: entry.end || null,
    description: null,
  }));

  return {
    ...raw,
    languages: raw.languages ?? [],
    certificates: raw.certificates ?? [],
    educationHistory:
      structuredEducation.length > 0
        ? structuredEducation
        : school
          ? [{ school, level: raw.highestEducationLevel, startYear: null, endYear: null }]
          : [],
    experienceHistory:
      structuredExperience.length > 0
        ? structuredExperience
        : role
          ? [
              {
                role,
                company: raw.currentEmployer,
                startDate: null,
                endDate: null,
                description: null,
              },
            ]
          : [],
  };
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: [...CANDIDATES_KEY, 'detail', id],
    queryFn: async () => {
      const res = await api.get<ApiCandidateDetail>(`/hr/recruitment/candidates/${id}`);
      return normalizeCandidate(res.data);
    },
    enabled: !!id,
    retry: false,
  });
}

export function useCandidateStageHistory(id: string) {
  return useQuery({
    queryKey: [...CANDIDATES_KEY, 'history', id],
    queryFn: async () => {
      const res = await api.get<RecruitmentStageHistoryEntry[]>(
        `/hr/recruitment/candidates/${id}/stage-history`,
      );
      return res.data;
    },
    enabled: !!id,
  });
}

/** An interview as the interviews endpoint returns it. */
interface ApiInterview {
  id: string;
  mode: InterviewMode;
  status: InterviewStatus;
  scheduledAt: string;
  durationMinutes: number;
  platform: string | null;
  meetingLink: string | null;
  phone: string | null;
  location: string | null;
  notes: string | null;
  feedback: string | null;
}

const INTERVIEW_TITLES: Record<InterviewMode, string> = {
  VIDEO: 'Video interview',
  PHONE: 'Phone interview',
  IN_PERSON: 'On-site interview',
};

function toCandidateInterview(api: ApiInterview): CandidateInterview {
  return {
    id: api.id,
    title: INTERVIEW_TITLES[api.mode],
    mode: api.mode,
    status: api.status,
    scheduledAt: api.scheduledAt,
    durationMinutes: api.durationMinutes,
    location: api.location,
    interviewers: [],
    feedback: api.feedback,
    platform: api.platform,
    meetingLink: api.meetingLink,
    phone: api.phone,
    notes: api.notes,
  };
}

export function useCandidateInterviews(id: string) {
  return useQuery({
    queryKey: [...CANDIDATES_KEY, 'interviews', id],
    queryFn: async (): Promise<CandidateInterview[]> => {
      const res = await api.get<ApiInterview[]>(`/hr/recruitment/candidates/${id}/interviews`);
      return res.data.map(toCandidateInterview);
    },
    enabled: !!id,
  });
}

/** Changes the details of a scheduled interview. */
export function useUpdateInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      interviewId,
      ...input
    }: ScheduleInterviewInput & { interviewId: string }): Promise<CandidateInterview> => {
      const res = await api.patch<ApiInterview>(
        `/hr/recruitment/candidates/${input.candidateId}/interviews/${interviewId}`,
        {
          mode: input.mode,
          scheduledAt: new Date(`${input.date}T${input.startTime}:00`).toISOString(),
          durationMinutes: input.durationMinutes,
          platform: input.platform,
          meetingLink: input.meetingLink,
          phone: input.phone,
          location: input.location,
          notes: input.notes,
        },
      );
      return toCandidateInterview(res.data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CANDIDATES_KEY }),
  });
}

/** Completes or cancels an interview. The API moves the candidate's stage as part of it. */
export function useUpdateInterviewStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      candidateId,
      interviewId,
      status,
      feedback,
      stageId,
    }: {
      candidateId: string;
      interviewId: string;
      status: 'COMPLETED' | 'CANCELLED';
      feedback?: string;
      stageId?: string;
    }) => {
      const res = await api.patch<ApiInterview>(
        `/hr/recruitment/candidates/${candidateId}/interviews/${interviewId}`,
        { status, feedback: feedback || undefined, stageId: stageId || undefined },
      );
      return toCandidateInterview(res.data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CANDIDATES_KEY }),
  });
}

export function useScheduleInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleInterviewInput): Promise<CandidateInterview> => {
      const res = await api.post<ApiInterview>(
        `/hr/recruitment/candidates/${input.candidateId}/interviews`,
        {
          mode: input.mode,
          // The date and time are the recruiter's local time, sent as an exact instant.
          scheduledAt: new Date(`${input.date}T${input.startTime}:00`).toISOString(),
          durationMinutes: input.durationMinutes,
          platform: input.platform,
          meetingLink: input.meetingLink,
          phone: input.phone,
          location: input.location,
          notes: input.notes,
        },
      );
      return toCandidateInterview(res.data);
    },
    // Scheduling also moves the candidate to the Interview stage, so refresh every candidate view.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CANDIDATES_KEY }),
  });
}

/** What the candidate's job opening asked for, used to score the match. Needs vacancy access. */
export function useVacancyRequirements(vacancyId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...VACANCIES_KEY, 'requirements', vacancyId],
    queryFn: async (): Promise<VacancyDetails | null> => {
      const res = await api.get<RecruitmentVacancy>(`/hr/recruitment/vacancies/${vacancyId}`);
      return res.data.details;
    },
    enabled: enabled && !!vacancyId,
  });
}
