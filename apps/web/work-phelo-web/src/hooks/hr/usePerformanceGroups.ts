import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import type { PerformanceGroup, PerformanceGroupInput } from '@/types/appraisal';

// Shared so a loading query hands back the same empty array every render.
const NONE: PerformanceGroup[] = [];

const toastError = (error: unknown) =>
  useToastStore.getState().addToast({ message: extractError(error), type: 'error' });

export function usePerformanceGroups() {
  const query = useQuery({
    queryKey: ['appraisal-groups'],
    queryFn: () => api.get<PerformanceGroup[]>('/hr/appraisal-groups').then((r) => r.data),
  });
  return { groups: query.data ?? NONE, isLoading: query.isLoading };
}

export function useSaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: PerformanceGroupInput }) =>
      id
        ? api.patch(`/hr/appraisal-groups/${id}`, input).then((r) => r.data)
        : api.post('/hr/appraisal-groups', input).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appraisal-groups'] }),
    onError: toastError,
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/hr/appraisal-groups/${id}`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appraisal-groups'] }),
    onError: toastError,
  });
}
