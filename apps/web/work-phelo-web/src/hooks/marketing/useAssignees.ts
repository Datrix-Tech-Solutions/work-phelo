import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Assignee } from '@/types/marketing';

/** People a prospect or client can be assigned to. Only fetched for users allowed to assign. */
export function useAssignees(enabled: boolean) {
  return useQuery({
    queryKey: ['marketing', 'assignees'] as const,
    queryFn: async () => {
      const res = await api.get<Assignee[]>('/marketing/assignees');
      return res.data;
    },
    enabled,
    staleTime: 60_000,
  });
}
