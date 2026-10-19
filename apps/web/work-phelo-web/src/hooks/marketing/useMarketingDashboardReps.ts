import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MarketingDashboardRep } from '@/types/marketing';

/** Sales reps the dashboard can be filtered to. */
export function useMarketingDashboardReps(enabled = true) {
  return useQuery({
    queryKey: ['marketing', 'dashboard', 'reps'] as const,
    queryFn: async () => (await api.get<MarketingDashboardRep[]>('/marketing/dashboard/reps')).data,
    enabled,
    staleTime: 60_000,
  });
}
