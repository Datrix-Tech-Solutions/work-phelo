import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CreateAnnouncementPayload,
  PaginatedAnnouncementsResponse,
  QueryAnnouncementsParams,
} from '@/types/hr';

function normalizeAnnouncementParams(params?: QueryAnnouncementsParams): QueryAnnouncementsParams {
  return {
    page: params?.page ?? 1,
    limit: params?.limit ?? 20,
    ...(params?.search ? { search: params.search } : {}),
    ...(params?.audienceType ? { audienceType: params.audienceType } : {}),
    ...(typeof params?.sendEmail === 'boolean' ? { sendEmail: params.sendEmail } : {}),
    ...(typeof params?.includeExpired === 'boolean'
      ? { includeExpired: params.includeExpired }
      : {}),
    ...(params?.view ? { view: params.view } : {}),
  };
}

export function useAnnouncements(params?: QueryAnnouncementsParams) {
  const normalizedParams = normalizeAnnouncementParams(params);

  return useQuery({
    queryKey: ['announcements', normalizedParams],
    queryFn: () =>
      api
        .get<PaginatedAnnouncementsResponse>('/hr/announcements', {
          params: normalizedParams,
        })
        .then((r) => r.data),
  });
}

export function useVisibleAnnouncements(params?: Omit<QueryAnnouncementsParams, 'view'>) {
  return useAnnouncements({
    ...params,
    view: 'visible',
  });
}

export function useAnnouncementsPage(params?: QueryAnnouncementsParams) {
  const query = useAnnouncements(params);

  return {
    ...query,
    items: query.data?.items ?? [],
    meta: query.data?.meta ?? {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      total: 0,
      totalPages: 0,
    },
  };
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAnnouncementPayload) =>
      api.post('/hr/announcements', dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/hr/announcements/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}
