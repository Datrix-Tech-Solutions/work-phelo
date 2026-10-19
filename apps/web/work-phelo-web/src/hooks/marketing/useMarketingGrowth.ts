import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SeriesBucket } from '@/lib/periodSeries';
import type { MarketingGrowthPoint } from '@/types/marketing';

/** New prospects and new clients for each of the given ranges, in one request. */
export function useMarketingGrowth(buckets: SeriesBucket[], userId?: string) {
  const ranges = buckets.map((b) => `${b.fromDate}:${b.toDate}`).join(',');

  return useQuery({
    queryKey: ['marketing', 'dashboard', 'growth', ranges, userId ?? null] as const,
    queryFn: async () =>
      (
        await api.get<MarketingGrowthPoint[]>('/marketing/dashboard/growth', {
          params: { ranges, ...(userId ? { userId } : {}) },
        })
      ).data,
    enabled: buckets.length > 0,
    placeholderData: (previous) => previous,
  });
}
