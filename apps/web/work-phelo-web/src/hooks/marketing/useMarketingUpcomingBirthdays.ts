import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MarketingDashboardBirthdays } from '@/types/marketing';

/** Birthdays of prospect and client contacts in the next 30 days; for one rep when `userId` is given. */
export function useMarketingUpcomingBirthdays(userId?: string) {
  return useQuery({
    queryKey: ['marketing', 'dashboard', 'birthdays', userId ?? null] as const,
    queryFn: async () => {
      const res = await api.get<MarketingDashboardBirthdays>(
        '/marketing/dashboard/upcoming-birthdays',
        { params: userId ? { userId } : {} },
      );
      return res.data;
    },
    staleTime: 60_000,
  });
}
