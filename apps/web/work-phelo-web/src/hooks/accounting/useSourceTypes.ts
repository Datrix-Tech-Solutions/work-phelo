import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SourceTypeDefinition, SourceTypeSetup } from '@/types/accounting';

const BASE = '/accounting/source-types';
export const SOURCE_TYPES_KEY = ['accounting', 'source-types'] as const;

/** Populated automatically once a module's integration setup with Accounting completes —
 *  never created from this side. This list is read-only plus a link/unlink toggle. */
export function useSourceTypes() {
  return useQuery({
    queryKey: SOURCE_TYPES_KEY,
    queryFn: async () => (await api.get<SourceTypeDefinition[]>(BASE)).data,
  });
}

export function useLinkSourceType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<SourceTypeDefinition>(`${BASE}/${id}/link`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOURCE_TYPES_KEY }),
  });
}

export function useUnlinkSourceType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<SourceTypeDefinition>(`${BASE}/${id}/unlink`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOURCE_TYPES_KEY }),
  });
}

/** What is left to set up before a module can raise transactions in Accounting. */
export function useSourceTypeSetup(id: string | undefined) {
  return useQuery({
    queryKey: [...SOURCE_TYPES_KEY, 'setup', id] as const,
    queryFn: async () => (await api.get<SourceTypeSetup>(`${BASE}/${id}/setup`)).data,
    enabled: !!id,
  });
}
