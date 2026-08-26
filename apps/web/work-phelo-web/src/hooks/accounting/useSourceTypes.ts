import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  SourceTypeDefinition,
  CreateSourceTypePayload,
  UpdateSourceTypePayload,
} from '@/types/accounting';

const BASE = '/accounting/source-types';
export const SOURCE_TYPES_KEY = ['accounting', 'source-types'] as const;

export function useSourceTypes() {
  return useQuery({
    queryKey: SOURCE_TYPES_KEY,
    queryFn: async () => (await api.get<SourceTypeDefinition[]>(BASE)).data,
  });
}

export function useCreateSourceType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSourceTypePayload) =>
      (await api.post<SourceTypeDefinition>(BASE, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOURCE_TYPES_KEY }),
  });
}

export function useUpdateSourceType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateSourceTypePayload & { id: string }) =>
      (await api.patch<SourceTypeDefinition>(`${BASE}/${id}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOURCE_TYPES_KEY }),
  });
}

export function useDeleteSourceType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`${BASE}/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOURCE_TYPES_KEY }),
  });
}
