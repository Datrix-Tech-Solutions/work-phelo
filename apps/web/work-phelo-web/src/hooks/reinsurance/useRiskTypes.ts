import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { RiskType, CreateRiskTypePayload, UpdateRiskTypePayload } from '@/types/reinsurance';

const RISK_TYPES_KEY = ['reinsurance', 'risk-types'] as const;

export function useRiskTypes() {
  return useQuery({
    queryKey: RISK_TYPES_KEY,
    queryFn: async () => {
      const res = await api.get<RiskType[]>('/operations/reinsurance/risk-types');
      return Array.isArray(res.data) ? res.data : ((res.data as { data: RiskType[] })?.data ?? []);
    },
  });
}

export function useCreateRiskType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRiskTypePayload) => {
      const res = await api.post<RiskType>('/operations/reinsurance/risk-types', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RISK_TYPES_KEY });
    },
  });
}

export function useUpdateRiskType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateRiskTypePayload & { id: string }) => {
      const res = await api.patch<RiskType>(`/operations/reinsurance/risk-types/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RISK_TYPES_KEY });
    },
  });
}

export function useDeleteRiskType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/operations/reinsurance/risk-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RISK_TYPES_KEY });
    },
  });
}
