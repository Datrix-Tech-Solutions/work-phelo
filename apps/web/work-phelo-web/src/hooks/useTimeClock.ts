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
    queryFn: () => api.get<TodaySession>('/hr/time-clock/today').then((r) => r.data),
    refetchInterval: 60_000,
  });
}

export function useClockIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<TodaySession>('/hr/time-clock/clock-in');
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
      const res = await api.post<TodaySession>('/hr/time-clock/clock-out');
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

export function useStartBreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<TodaySession>('/hr/time-clock/break/start');
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
      const res = await api.post<TodaySession>('/hr/time-clock/break/end');
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
      const res = await api.get('/hr/time-clock/my-history', {
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
      requestedClockIn?: string;
      requestedClockOut?: string;
      reason: string;
    }) => {
      const res = await api.post<CorrectionRequest>('/hr/time-clock/corrections', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'corrections'] });
    },
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export function useLiveAttendance() {
  return useQuery<LiveAttendanceEntry[]>({
    queryKey: ['timeclock', 'live'],
    queryFn: async () => {
      const res = await api.get('/hr/time-clock/live');
      return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
    },
    refetchInterval: 30_000,
  });
}

export function useAttendanceStats() {
  return useQuery<AttendanceStats>({
    queryKey: ['timeclock', 'stats'],
    queryFn: () => api.get<AttendanceStats>('/hr/time-clock/stats/today').then((r) => r.data),
    refetchInterval: 30_000,
  });
}

export function useAttendanceRecords(params: {
  page: number;
  fromDate?: string;
  toDate?: string;
  departmentId?: string;
  status?: string;
  search?: string;
}) {
  return useQuery<{ data: TimeEntry[]; totalPages: number }>({
    queryKey: ['timeclock', 'records', params],
    queryFn: async () => {
      const res = await api.get('/hr/time-clock/records', {
        params: {
          page: params.page,
          limit: 10,
          fromDate: params.fromDate || undefined,
          toDate: params.toDate || undefined,
          departmentId: params.departmentId || undefined,
          status: params.status || undefined,
          search: params.search || undefined,
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
      const res = await api.get('/hr/time-clock/corrections', {
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
      status,
      reviewNote,
    }: {
      id: string;
      status: 'APPROVED' | 'REJECTED';
      reviewNote?: string;
    }) => {
      const res = await api.patch<CorrectionRequest>(`/hr/time-clock/corrections/${id}/review`, {
        status,
        reviewNote,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'corrections'] });
      queryClient.invalidateQueries({ queryKey: ['timeclock', 'records'] });
    },
  });
}
