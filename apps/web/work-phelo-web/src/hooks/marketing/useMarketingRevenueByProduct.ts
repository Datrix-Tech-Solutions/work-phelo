import { useQuery } from '@tanstack/react-query';
import type { Period } from '@/components/atoms/PeriodToggle';
import { api } from '@/lib/api';
import { dashboardRanges } from '@/lib/dashboardPeriod';
import type { MarketingRevenueByProduct } from '@/types/marketing';

/** Revenue Accounting received in the period filter's range, split by product. */
export function useMarketingRevenueByProduct(period: Period, year: number) {
  const { fromDate, toDate } = dashboardRanges(period, year);

  return useQuery({
    queryKey: ['marketing', 'dashboard', 'revenue-by-product', fromDate, toDate] as const,
    queryFn: async () =>
      (
        await api.get<MarketingRevenueByProduct>('/marketing/dashboard/revenue-by-product', {
          params: { fromDate, toDate },
        })
      ).data,
    placeholderData: (previous) => previous,
  });
}
