import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useUpdateModules(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (modules: Record<string, boolean>) =>
      api.patch(`/auth/tenants/${tenantId}/modules`, modules).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });
}

export function useUpdateFeatures(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { module: string; features: Record<string, boolean> }) =>
      api.patch(`/auth/tenants/${tenantId}/features`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });
}

export function useFeatureHistory(tenantId: string) {
  return useQuery({
    queryKey: ['feature-history', tenantId],
    queryFn: () => api.get(`/auth/tenants/${tenantId}/feature-history`).then((r) => r.data),
  });
}
