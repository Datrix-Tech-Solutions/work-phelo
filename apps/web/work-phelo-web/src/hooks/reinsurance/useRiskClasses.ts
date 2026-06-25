import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { RiskClass, CreateRiskClassPayload, UpdateRiskClassPayload } from '@/types/reinsurance';

const BASE = '/operations/reinsurance/settings/risk-classes';
const RISK_CLASSES_KEY = ['reinsurance', 'risk-classes'] as const;
const STABLE_SETTINGS_STALE_TIME_MS = 5 * 60 * 1000;

function extractList(data: unknown): RiskClass[] {
  if (Array.isArray(data)) return data as RiskClass[];
  const paginated = data as { items?: RiskClass[]; data?: RiskClass[] };
  return paginated?.items ?? paginated?.data ?? [];
}

export function useRiskClasses() {
  return useQuery({
    queryKey: RISK_CLASSES_KEY,
    queryFn: fetchRiskClasses,
    staleTime: STABLE_SETTINGS_STALE_TIME_MS,
  });
}

async function fetchRiskClasses() {
  const res = await api.get(BASE);
  return extractList(res.data);
}

export function useRiskClassOptions() {
  return useQuery({
    queryKey: RISK_CLASSES_KEY,
    queryFn: fetchRiskClasses,
    select: (list) => list.map((rc) => ({ value: rc.id, label: rc.name })),
    staleTime: STABLE_SETTINGS_STALE_TIME_MS,
  });
}

export function useCreateRiskClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRiskClassPayload) => {
      const res = await api.post<RiskClass>(BASE, payload);
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
      const res = await api.patch<RiskClass>(`${BASE}/${id}`, payload);
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
      await api.delete(`${BASE}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RISK_CLASSES_KEY });
    },
  });
}
