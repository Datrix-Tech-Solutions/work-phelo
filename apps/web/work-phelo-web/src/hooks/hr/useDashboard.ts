import { useQuery } from '@tanstack/react-query';
import type { Period } from '@/components/atoms/PeriodToggle';
import { api } from '@/lib/api';
import { dashboardRanges } from '@/lib/dashboardPeriod';
import { DashboardSummary, HrDashboardKpis } from '@/types/hr';

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

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await api.get<DashboardSummary>('/hr/dashboard/summary');
      return res.data;
    },
  });
}
