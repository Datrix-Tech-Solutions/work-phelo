import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { RiskClass, CreateRiskClassPayload, UpdateRiskClassPayload } from '@/types/reinsurance';

const RISK_CLASSES_KEY = ['reinsurance', 'risk-classes'] as const;

export function useRiskClasses() {
  return useQuery({
    queryKey: RISK_CLASSES_KEY,
    queryFn: async () => {
      const res = await api.get<RiskClass[]>('/operations/reinsurance/risk-classes');
      return Array.isArray(res.data) ? res.data : ((res.data as { data: RiskClass[] })?.data ?? []);
    },
  });
}

/** Lightweight options list for SearchSelect dropdowns */
export function useRiskClassOptions() {
  return useQuery({
    queryKey: [...RISK_CLASSES_KEY, 'options'],
    queryFn: async () => {
      const res = await api.get<RiskClass[]>('/operations/reinsurance/risk-classes');
      const list = Array.isArray(res.data)
        ? res.data
        : ((res.data as { data: RiskClass[] })?.data ?? []);
      return list.map((rc) => ({ value: rc.id, label: rc.name }));
    },
  });
}

export function useCreateRiskClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRiskClassPayload) => {
      const res = await api.post<RiskClass>('/operations/reinsurance/risk-classes', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RISK_CLASSES_KEY });
    },
  });
}

export function useUpdateRiskClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateRiskClassPayload & { id: string }) => {
      const res = await api.patch<RiskClass>(`/operations/reinsurance/risk-classes/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RISK_CLASSES_KEY });
    },
  });
}

export function useDeleteRiskClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/operations/reinsurance/risk-classes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RISK_CLASSES_KEY });
    },
  });
}
