import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SeriesBucket } from '@/lib/periodSeries';

export interface CashFlowSeriesPoint {
  fromDate: string;
  toDate: string;
  operating: string;
  investing: string;
  financing: string;
  netChangeInCash: string;
}

/** Operating, investing and financing cash flow for each of the given ranges, in one request. */
export function useCashFlowSeries(buckets: SeriesBucket[]) {
  const ranges = buckets.map((b) => `${b.fromDate}:${b.toDate}`).join(',');

  return useQuery({
    queryKey: ['accounting', 'reports', 'cash-flow-series', ranges] as const,
    queryFn: async () =>
      (
        await api.get<CashFlowSeriesPoint[]>('/accounting/reports/cash-flow-series', {
          params: { ranges },
        })
      ).data,
    enabled: buckets.length > 0,
    placeholderData: (previous) => previous,
  });
}
