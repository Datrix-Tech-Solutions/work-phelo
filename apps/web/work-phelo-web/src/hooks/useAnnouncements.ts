import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: () => api.get('/hr/announcements').then((r) => r.data),
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { title: string; body: string }) =>
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
