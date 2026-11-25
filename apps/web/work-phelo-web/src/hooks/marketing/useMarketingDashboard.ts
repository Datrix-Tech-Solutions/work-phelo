import { useQuery } from '@tanstack/react-query';
import type { Period } from '@/components/atoms/PeriodToggle';
import { api } from '@/lib/api';
import { dashboardRanges } from '@/lib/dashboardPeriod';
import type {
  MarketingDashboardClientRevenue,
  MarketingDashboardPeriodProspect,
  MarketingDashboardStageProspect,
  MarketingDashboardSummary,
  MarketingDashboardWonDeal,
} from '@/types/marketing';

/** Marketing dashboard figures for the period filter, with the previous period for trends; for one rep when `userId` is given. */
export function useMarketingDashboard(period: Period, year: number, userId?: string) {
  const { fromDate, toDate, prevFromDate, prevToDate } = dashboardRanges(period, year);

  return useQuery({
    queryKey: [
      'marketing',
      'dashboard',
      fromDate,
      toDate,
      prevFromDate,
      prevToDate,
      userId ?? null,
    ] as const,
    queryFn: async () => {
      const res = await api.get<MarketingDashboardSummary>('/marketing/dashboard/summary', {
        params: { fromDate, toDate, prevFromDate, prevToDate, ...(userId ? { userId } : {}) },
      });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}

/** The prospects behind one pipeline stage card. Nothing is asked for until a stage is open. */
export function useStageProspects(
  stageId: string,
  period: Period,
  year: number,
  userId?: string,
  enabled = true,
) {
  const { fromDate, toDate } = dashboardRanges(period, year);

  return useQuery({
    queryKey: [
      'marketing',
      'dashboard',
      'stage-prospects',
      stageId,
      fromDate,
      toDate,
      userId ?? null,
    ] as const,
    queryFn: async () => {
      const res = await api.get<{ prospects: MarketingDashboardStageProspect[] }>(
        '/marketing/dashboard/pipeline-prospects',
        { params: { stageId, fromDate, toDate, ...(userId ? { userId } : {}) } },
      );
      return res.data.prospects;
    },
    enabled: enabled && !!stageId,
  });
}

/** One of the lists behind the CRM headline figures, for the period and optional rep. */
function useDashboardList<T>(
  path: string,
  field: string,
  period: Period,
  year: number,
  userId: string | undefined,
  enabled: boolean,
) {
  const { fromDate, toDate } = dashboardRanges(period, year);

  return useQuery({
    queryKey: ['marketing', 'dashboard', path, fromDate, toDate, userId ?? null] as const,
    queryFn: async () => {
      const res = await api.get<Record<string, T[]>>(`/marketing/dashboard/${path}`, {
        params: { fromDate, toDate, ...(userId ? { userId } : {}) },
      });
      return res.data[field];
    },
    enabled,
  });
}

export const useWonDeals = (period: Period, year: number, userId?: string, enabled = true) =>
  useDashboardList<MarketingDashboardWonDeal>('won-deals', 'deals', period, year, userId, enabled);

export const useClientRevenue = (period: Period, year: number, userId?: string, enabled = true) =>
  useDashboardList<MarketingDashboardClientRevenue>(
    'revenue-by-client',
    'clients',
    period,
    year,
    userId,
    enabled,
  );

export const usePeriodProspects = (period: Period, year: number, userId?: string, enabled = true) =>
  useDashboardList<MarketingDashboardPeriodProspect>(
    'period-prospects',
    'prospects',
    period,
    year,
    userId,
    enabled,
  );

/** The prospects or clients behind one bar of the growth chart, for that bar's own dates. */
export function useGrowthRecords<T>(
  path: 'period-prospects' | 'new-clients',
  range: { fromDate: string; toDate: string } | null,
  userId?: string,
  enabled = true,
) {
  const { fromDate = '', toDate = '' } = range ?? {};

  return useQuery({
    queryKey: ['marketing', 'dashboard', path, fromDate, toDate, userId ?? null] as const,
    queryFn: async () => {
      const res = await api.get<Record<string, T[]>>(`/marketing/dashboard/${path}`, {
        params: { fromDate, toDate, ...(userId ? { userId } : {}) },
      });
      return res.data[path === 'new-clients' ? 'clients' : 'prospects'];
    },
    enabled: enabled && range !== null,
  });
}
