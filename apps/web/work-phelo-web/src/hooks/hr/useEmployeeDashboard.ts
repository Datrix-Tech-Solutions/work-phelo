import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  DepartmentDistribution,
  OutTodayEntry,
  PayrollStatus,
  PendingActions,
  RecentActivityEvent,
  UpcomingBirthday,
  UpcomingEvent,
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

export function useUpcomingEvents() {
  return useQuery({
    queryKey: ['dashboard-upcoming-events'],
    queryFn: () =>
      api
        .get<{ events: UpcomingEvent[]; withinDays: number }>('/hr/dashboard/upcoming-events')
        .then((r) => r.data),
  });
}

export function useOutToday() {
  return useQuery({
    queryKey: ['dashboard-out-today'],
    queryFn: () => api.get<{ out: OutTodayEntry[] }>('/hr/dashboard/out-today').then((r) => r.data),
  });
}

export function usePayrollStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['dashboard-payroll-status'],
    queryFn: () => api.get<PayrollStatus>('/hr/dashboard/payroll-status').then((r) => r.data),
    enabled: options?.enabled,
  });
}
