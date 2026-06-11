import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PlacementEmailThreadConversation, PlacementEmailThreadSummary } from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';

export const placementEmailKeys = {
  all: ['reinsurance', 'placement-emails'] as const,
  threads: (placementId: string) => [...placementEmailKeys.all, placementId, 'threads'] as const,
  thread: (placementId: string, threadId: string) =>
    [...placementEmailKeys.threads(placementId), threadId] as const,
};

export function usePlacementEmailThreads(placementId: string) {
  return useQuery({
    queryKey: placementEmailKeys.threads(placementId),
    queryFn: async () => {
      const res = await api.get<PlacementEmailThreadSummary[]>(
        `${BASE}/${placementId}/email/threads`,
      );
      return res.data;
    },
    enabled: !!placementId,
  });
}

export function usePlacementEmailThread(placementId: string, threadId?: string | null) {
  return useQuery({
    queryKey: placementEmailKeys.thread(placementId, threadId ?? ''),
    queryFn: async () => {
      const res = await api.get<PlacementEmailThreadConversation>(
        `${BASE}/${placementId}/email/threads/${threadId}`,
      );
      return res.data;
    },
    enabled: !!placementId && !!threadId,
  });
}
