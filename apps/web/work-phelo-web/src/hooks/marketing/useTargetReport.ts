import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TargetReportFilters } from '@/types/marketing';

/** The reps, branches and departments the target report offers this caller. */
export function useTargetReportFilters(enabled = true) {
  return useQuery({
    queryKey: ['marketing', 'reports', 'targets', 'filters'] as const,
    queryFn: async () =>
      (await api.get<TargetReportFilters>('/marketing/reports/targets/filters')).data,
    enabled,
    staleTime: 60_000,
  });
}
