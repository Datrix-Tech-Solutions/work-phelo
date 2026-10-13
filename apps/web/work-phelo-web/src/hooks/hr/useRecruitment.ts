import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
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
}

export function useCandidates({
  search,
  vacancyId,
  stageId,
  page = 1,
  limit = 10,
}: CandidatesQuery = {}) {
  return useQuery({
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

type ApiCandidateDetail = Omit<
  RecruitmentCandidateDetail,
  'languages' | 'educationHistory' | 'experienceHistory'
> & {
  metadata?: { languages?: unknown } | null;
};

/**
 * The API stores education as one text field and has no languages yet, so the overview's
 * school entries and languages are derived here until the application form collects them.
 */
function normalizeCandidate(raw: ApiCandidateDetail): RecruitmentCandidateDetail {
  const languages = Array.isArray(raw.metadata?.languages)
    ? (raw.metadata.languages as unknown[]).filter((l): l is string => typeof l === 'string')
    : [];
  const school = raw.education?.trim();
  const role = raw.currentJobTitle?.trim();
  return {
    ...raw,
    languages,
    educationHistory: school
      ? [{ school, level: raw.highestEducationLevel, startYear: null, endYear: null }]
      : [],
    experienceHistory: role
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
    onSuccess: (_interview, input) =>
      queryClient.invalidateQueries({
        queryKey: [...CANDIDATES_KEY, 'interviews', input.candidateId],
      }),
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
