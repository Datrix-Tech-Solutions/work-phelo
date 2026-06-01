import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Facultative,
  CreateFacultativePayload,
  UpdateFacultativePayload,
} from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';
const FACULTATIVES_KEY = ['reinsurance', 'placements'] as const;

function extractList(data: unknown): Facultative[] {
  if (Array.isArray(data)) return data as Facultative[];
  const paginated = data as { items?: Facultative[]; data?: Facultative[] };
  return paginated?.items ?? paginated?.data ?? [];
}

export function useFacultatives() {
  return useQuery({
    queryKey: FACULTATIVES_KEY,
    queryFn: async () => {
      const res = await api.get(BASE);
      return extractList(res.data);
    },
  });
}

export function useFacultativePlacement(id: string) {
  return useQuery({
    queryKey: [...FACULTATIVES_KEY, id],
    queryFn: async () => {
      const res = await api.get<Facultative>(`${BASE}/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateFacultative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateFacultativePayload) => {
      const res = await api.post<Facultative>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY });
    },
  });
}

export function useUpdateFacultative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateFacultativePayload & { id: string }) => {
      const res = await api.patch<Facultative>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY });
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, id] });
    },
  });
}

export function useDeleteFacultative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${BASE}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY });
    },
  });
}
