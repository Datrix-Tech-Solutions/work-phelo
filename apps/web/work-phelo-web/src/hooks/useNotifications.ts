import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notification/in-app').then((r) => r.data),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get('/notification/in-app/unread-count').then((r) => r.data),
    refetchInterval: 30000,
  });
}

export function useAllNotifications(filter?: string, page = 1) {
  return useQuery({
    queryKey: ['notifications-all', filter, page],
    queryFn: () =>
      api.get('/notification/in-app/all', { params: { filter, page } }).then((r) => r.data),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notification/in-app/${id}/read`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch('/notification/in-app/mark-all-read').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/notification/in-app/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
