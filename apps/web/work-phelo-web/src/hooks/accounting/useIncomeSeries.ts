import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SeriesBucket } from '@/lib/periodSeries';

export interface IncomeSeriesPoint {
  fromDate: string;
  toDate: string;
  totalRevenue: string;
  totalExpenses: string;
}

/** Revenue and expenses for each of the given ranges, in one request. */
export function useIncomeSeries(buckets: SeriesBucket[]) {
  const ranges = buckets.map((b) => `${b.fromDate}:${b.toDate}`).join(',');

  return useQuery({
    queryKey: ['accounting', 'reports', 'income-series', ranges] as const,
    queryFn: async () =>
      (
        await api.get<IncomeSeriesPoint[]>('/accounting/reports/income-series', {
          params: { ranges },
        })
      ).data,
    enabled: buckets.length > 0,
    placeholderData: (previous) => previous,
  });
}
