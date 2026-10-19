import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  DepartmentDistribution,
  PendingActions,
  RecentActivityEvent,
  UpcomingBirthday,
} from '@/types/hr';

export function useEmployeeDashboard() {
  return useQuery({
    queryKey: ['employee-dashboard'],
    queryFn: () => api.get('/hr/dashboard/me').then((r) => r.data),
  });
}

export function useDepartmentDistribution() {
  return useQuery({
    queryKey: ['dashboard-dept-distribution'],
    queryFn: () =>
      api.get<DepartmentDistribution>('/hr/dashboard/department-distribution').then((r) => r.data),
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ['dashboard-recent-activity'],
    queryFn: () =>
      api
        .get<{ activity: RecentActivityEvent[] }>('/hr/dashboard/recent-activity')
        .then((r) => r.data),
  });
}

export function useUpcomingBirthdays() {
  return useQuery({
    queryKey: ['dashboard-birthdays'],
    queryFn: () =>
      api
        .get<{ birthdays: UpcomingBirthday[] }>('/hr/dashboard/upcoming-birthdays')
        .then((r) => r.data),
  });
}

export function useRecentlyAdded() {
  return useQuery({
    queryKey: ['dashboard-recently-added'],
    queryFn: () => api.get('/hr/dashboard/recently-added').then((r) => r.data),
  });
}

export function usePendingActions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['dashboard-pending-actions'],
    queryFn: () => api.get<PendingActions>('/hr/dashboard/pending-actions').then((r) => r.data),
    enabled: options?.enabled,
  });
}
