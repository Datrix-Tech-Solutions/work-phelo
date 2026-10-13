import { useQuery } from '@tanstack/react-query';
import type { Period } from '@/components/atoms/PeriodToggle';
import { api } from '@/lib/api';
import { dashboardRanges } from '@/lib/dashboardPeriod';
import type { MarketingSalesPersonnel } from '@/types/marketing';

/** Per-rep prospects, clients, expected and achieved revenue for the period filter's range. */
export function useMarketingSalesPersonnel(period: Period, year: number) {
  const { fromDate, toDate } = dashboardRanges(period, year);

  return useQuery({
    queryKey: ['marketing', 'dashboard', 'sales-personnel', fromDate, toDate] as const,
    queryFn: async () =>
      (
        await api.get<MarketingSalesPersonnel>('/marketing/dashboard/sales-personnel', {
          params: { fromDate, toDate },
        })
      ).data,
    placeholderData: (previous) => previous,
  });
}
