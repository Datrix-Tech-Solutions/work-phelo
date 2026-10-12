import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  JobOpeningStatus,
  RecruitmentVacancy,
  RecruitmentVacancyPage,
  RecruitmentVacancyPayload,
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
