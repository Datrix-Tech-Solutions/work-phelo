import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CrmPreferences } from '@/types/marketing';

const ENDPOINT = '/marketing/crm-settings/preferences';
const KEY = ['marketing', 'crm-settings', 'preferences'] as const;

export function useCrmPreferences() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<CrmPreferences>(ENDPOINT)).data,
  });
}

export function useUpdateCrmPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CrmPreferences) =>
      (await api.put<CrmPreferences>(ENDPOINT, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      // Automatic follow-up dates are worked out from this setting.
      queryClient.invalidateQueries({ queryKey: ['marketing', 'follow-ups'] });
    },
  });
}
