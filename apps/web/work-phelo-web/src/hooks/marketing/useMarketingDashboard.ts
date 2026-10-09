import { useQuery } from '@tanstack/react-query';
import type { Period } from '@/components/atoms/PeriodToggle';
import { api } from '@/lib/api';
import { dashboardRanges } from '@/lib/dashboardPeriod';
import type { MarketingDashboardSummary } from '@/types/marketing';

/** Marketing dashboard figures for the period filter, with the previous period for trends. */
export function useMarketingDashboard(period: Period, year: number) {
  const { fromDate, toDate, prevFromDate, prevToDate } = dashboardRanges(period, year);

  return useQuery({
    queryKey: ['marketing', 'dashboard', fromDate, toDate, prevFromDate, prevToDate] as const,
    queryFn: async () => {
      const res = await api.get<MarketingDashboardSummary>('/marketing/dashboard/summary', {
        params: { fromDate, toDate, prevFromDate, prevToDate },
      });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}
