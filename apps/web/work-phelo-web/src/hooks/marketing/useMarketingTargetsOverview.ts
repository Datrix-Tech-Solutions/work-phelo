import { useQuery } from '@tanstack/react-query';
import type { Period } from '@/components/atoms/PeriodToggle';
import { api } from '@/lib/api';
import { dashboardRanges } from '@/lib/dashboardPeriod';
import type { MarketingTargetsOverview } from '@/types/marketing';

/** Target progress for the period filter, for one sales rep when `userId` is given. */
export function useMarketingTargetsOverview(period: Period, year: number, userId?: string) {
  const { fromDate, toDate } = dashboardRanges(period, year);

  return useQuery({
    queryKey: ['marketing', 'dashboard', 'targets', fromDate, toDate, userId ?? null] as const,
    queryFn: async () => {
      const res = await api.get<MarketingTargetsOverview>('/marketing/dashboard/targets', {
        params: { fromDate, toDate, ...(userId ? { userId } : {}) },
      });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}
