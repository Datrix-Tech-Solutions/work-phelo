import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TripHistoryResponse } from '@/types/marketing';

const PAGE_SIZE = 10;

function useTripHistory(basePath: string | null) {
  return useInfiniteQuery({
    queryKey: ['marketing', 'trip-history', basePath] as const,
    queryFn: async ({ pageParam }) => {
      const res = await api.get<TripHistoryResponse>(`${basePath}/trip-history`, {
        params: { page: pageParam, limit: PAGE_SIZE },
      });
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: !!basePath,
  });
}

/** Completed trips for one vehicle; pass undefined to stay idle until a card is opened. */
export function useFleetTripHistory(assetId: string | undefined) {
  return useTripHistory(assetId ? `/marketing/fleet/${assetId}` : null);
}

/** Completed trips for one transport officer; pass undefined to stay idle until a card is opened. */
export function useOfficerTripHistory(officerId: string | undefined) {
  return useTripHistory(officerId ? `/marketing/transport-officers/${officerId}` : null);
}
