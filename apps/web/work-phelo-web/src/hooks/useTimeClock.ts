import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  TodaySession,
  TimeEntry,
  LiveAttendanceEntry,
  AttendanceStats,
  CorrectionRequest,
} from '@/types/timeclock';

// ── Employee ─────────────────────────────────────────────────────────────────

export function useMyTodaySession() {
  return useQuery<TodaySession>({
    queryKey: ['timeclock', 'today'],
    queryFn: () => api.get<TodaySession>('/hr/time/today').then((r) => r.data),
    refetchInterval: 60_000,
  });
}

export function useClockIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: { location?: string; note?: string }) => {
      const res = await api.post<TodaySession>('/hr/time/clock-in', payload ?? {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'live'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'stats'] });
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<TodaySession>('/hr/time/clock-out');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'live'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'stats'] });
    },
  });
}

// Break start/end — not yet available in the backend
export function useStartBreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<TodaySession>('/hr/time/break/start');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'live'] });
    },
  });
}

export function useEndBreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<TodaySession>('/hr/time/break/end');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'live'] });
    },
  });
}

export function useMyAttendanceHistory(page: number = 1) {
  return useQuery<{ data: TimeEntry[]; totalPages: number }>({
    queryKey: ['timeclock', 'history', page],
    queryFn: async () => {
      const res = await api.get('/hr/time/attendance', {
        params: { page, limit: 10 },
      });
      const raw = res.data;
      if (Array.isArray(raw)) return { data: raw, totalPages: 1 };
      return { data: raw?.data ?? [], totalPages: raw?.totalPages ?? 1 };
    },
  });
}

export function useSubmitCorrectionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      date: string;
      requestedIn?: string;
      requestedOut?: string;
      reason: string;
    }) => {
      const res = await api.post<CorrectionRequest>('/hr/time/corrections', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'corrections'] });
    },
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

// Live attendance — not yet available in the backend
export function useLiveAttendance() {
  return useQuery<LiveAttendanceEntry[]>({
    queryKey: ['timeclock', 'live'],
    queryFn: async () => {
      const res = await api.get('/hr/time/live');
      return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
    },
    refetchInterval: 30_000,
  });
}

// Attendance stats — not yet available in the backend
export function useAttendanceStats() {
  return useQuery<AttendanceStats>({
    queryKey: ['timeclock', 'stats'],
    queryFn: () => api.get<AttendanceStats>('/hr/time/stats/today').then((r) => r.data),
    refetchInterval: 30_000,
  });
}

export function useAttendanceRecords(params: {
  page: number;
  fromDate?: string;
  toDate?: string;
  employeeId?: string;
  departmentId?: string;
  status?: string;
  search?: string;
}) {
  return useQuery<{ data: TimeEntry[]; totalPages: number }>({
    queryKey: ['timeclock', 'records', params],
    queryFn: async () => {
      const res = await api.get('/hr/time/attendance', {
        params: {
          employeeId: params.employeeId || undefined,
          from: params.fromDate || undefined,
          to: params.toDate || undefined,
        },
      });
      const raw = res.data;
      if (Array.isArray(raw)) return { data: raw, totalPages: 1 };
      return { data: raw?.data ?? [], totalPages: raw?.totalPages ?? 1 };
    },
  });
}

export function useCorrectionRequests(status?: string) {
  return useQuery<CorrectionRequest[]>({
    queryKey: ['timeclock', 'corrections', status ?? 'all'],
    queryFn: async () => {
      const res = await api.get('/hr/time/corrections', {
        params: status ? { status } : undefined,
      });
      return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
    },
  });
}

export function useReviewCorrectionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      action,
      note,
    }: {
      id: string;
      action: 'APPROVED' | 'REJECTED';
      note?: string;
    }) => {
      const res = await api.patch<CorrectionRequest>(`/hr/time/corrections/${id}/review`, {
        action,
        note,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'corrections'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'records'] });
    },
  });
}
