import { useQuery } from '@tanstack/react-query';
import type { Period } from '@/components/atoms/PeriodToggle';
import { api } from '@/lib/api';
import { dashboardRanges } from '@/lib/dashboardPeriod';
import type { SeriesBucket } from '@/lib/periodSeries';
import type { TransportDashboardSummary, TransportTrendPoint } from '@/types/marketing';

const ENDPOINT = '/marketing/dashboard/transport';

/** Transport dashboard figures for the period filter, with the previous period for trends. */
export function useTransportDashboard(period: Period, year: number, enabled = true) {
  const { fromDate, toDate, prevFromDate, prevToDate } = dashboardRanges(period, year);

  return useQuery({
    queryKey: [
      'marketing',
      'dashboard',
      'transport',
      fromDate,
      toDate,
      prevFromDate,
      prevToDate,
    ] as const,
    queryFn: async () =>
      (
        await api.get<TransportDashboardSummary>(`${ENDPOINT}/summary`, {
          params: { fromDate, toDate, prevFromDate, prevToDate },
        })
      ).data,
    enabled,
    placeholderData: (previous) => previous,
    // Pending approvals and overdue trips change through the day.
    refetchInterval: 60_000,
  });
}

/** Requests raised and trips completed for each of the given ranges, in one request. */
export function useTransportTrend(buckets: SeriesBucket[], enabled = true) {
  const ranges = buckets.map((b) => `${b.fromDate}:${b.toDate}`).join(',');

  return useQuery({
    queryKey: ['marketing', 'dashboard', 'transport', 'trend', ranges] as const,
    queryFn: async () =>
      (await api.get<TransportTrendPoint[]>(`${ENDPOINT}/trend`, { params: { ranges } })).data,
    enabled: enabled && buckets.length > 0,
    placeholderData: (previous) => previous,
  });
}
