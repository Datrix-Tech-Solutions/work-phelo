import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/hr/notifications').then((r) => r.data),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get('/hr/notifications/unread-count').then((r) => r.data),
    refetchInterval: 30000,
  });
}

export function useAllNotifications(filter?: string, page = 1) {
  return useQuery({
    queryKey: ['notifications-all', filter, page],
    queryFn: () =>
      api.get('/hr/notifications/all', { params: { filter, page } }).then((r) => r.data),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/hr/notifications/${id}/read`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch('/hr/notifications/mark-all-read').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/hr/notifications/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
