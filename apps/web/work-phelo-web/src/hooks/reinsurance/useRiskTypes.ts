import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { RiskType, CreateRiskTypePayload, UpdateRiskTypePayload } from '@/types/reinsurance';

const RISK_TYPES_KEY = ['reinsurance', 'risk-types'] as const;

export function useRiskTypes() {
  return useQuery({
    queryKey: RISK_TYPES_KEY,
    queryFn: async () => {
      const res = await api.get<RiskType[]>('/operations/reinsurance/settings/business-classes');
      return Array.isArray(res.data) ? res.data : ((res.data as { data: RiskType[] })?.data ?? []);
    },
  });
}

export function useCreateRiskType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRiskTypePayload) => {
      const res = await api.post<RiskType>(
        '/operations/reinsurance/settings/business-classes',
        payload,
      );
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
      const res = await api.patch<RiskType>(
        `/operations/reinsurance/settings/business-classes/${id}`,
        payload,
      );
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
      await api.delete(`/operations/reinsurance/settings/business-classes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RISK_TYPES_KEY });
    },
  });
}

export function useRiskTypeOptions() {
  return useQuery({
    queryKey: [...RISK_TYPES_KEY, 'options'],
    queryFn: async () => {
      const res = await api.get<RiskType[]>('/operations/reinsurance/settings/business-classes');
      const list = Array.isArray(res.data)
        ? res.data
        : ((res.data as { data: RiskType[] })?.data ?? []);
      return list.map((rt) => ({ value: rt.id, label: rt.name }));
    },
  });
}
