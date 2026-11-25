import { useQuery } from '@tanstack/react-query';
import type { Period } from '@/components/atoms/PeriodToggle';
import { api } from '@/lib/api';
import { dashboardRanges } from '@/lib/dashboardPeriod';
import { DashboardSummary, HiresAndExits, HrDashboardKpis, OnLeaveEntry } from '@/types/hr';

/** Headline HR figures for the period filter, with the previous period for trends. */
export function useHrDashboardKpis(period: Period, year: number) {
  const { fromDate, toDate, prevFromDate, prevToDate } = dashboardRanges(period, year);

  return useQuery({
    queryKey: ['dashboard', 'kpis', fromDate, toDate, prevFromDate, prevToDate] as const,
    queryFn: async () => {
      const res = await api.get<HrDashboardKpis>('/hr/dashboard/kpis', {
        params: { fromDate, toDate, prevFromDate, prevToDate },
      });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}

/** The approved leave behind the "On Leave" figure for the period filter. */
export function useOnLeave(period: Period, year: number, options?: { enabled?: boolean }) {
  const { fromDate, toDate } = dashboardRanges(period, year);

  return useQuery({
    queryKey: ['dashboard', 'on-leave', fromDate, toDate] as const,
    queryFn: async () => {
      const res = await api.get<{ onLeave: OnLeaveEntry[] }>('/hr/dashboard/on-leave', {
        params: { fromDate, toDate },
      });
      return res.data.onLeave;
    },
    enabled: options?.enabled ?? true,
  });
}

/** The people behind the "Hires & Exits" figure for the period filter. */
export function useHiresAndExits(period: Period, year: number, options?: { enabled?: boolean }) {
  const { fromDate, toDate } = dashboardRanges(period, year);

  return useQuery({
    queryKey: ['dashboard', 'hires-exits', fromDate, toDate] as const,
    queryFn: async () => {
      const res = await api.get<HiresAndExits>('/hr/dashboard/hires-exits', {
        params: { fromDate, toDate },
      });
      return res.data;
    },
    enabled: options?.enabled ?? true,
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await api.get<DashboardSummary>('/hr/dashboard/summary');
      return res.data;
    },
  });
}
