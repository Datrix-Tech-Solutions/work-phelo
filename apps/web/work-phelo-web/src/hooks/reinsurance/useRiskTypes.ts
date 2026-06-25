import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  RiskType,
  CreateRiskTypePayload,
  UpdateRiskTypePayload,
  CreateRiskTypeFieldPayload,
} from '@/types/reinsurance';

const BASE = '/operations/reinsurance/settings/risk-types';
const RISK_TYPES_KEY = ['reinsurance', 'risk-types'] as const;
const STABLE_SETTINGS_STALE_TIME_MS = 5 * 60 * 1000;

function extractList(data: unknown): RiskType[] {
  if (Array.isArray(data)) return data as RiskType[];
  const paginated = data as { items?: RiskType[]; data?: RiskType[] };
  return paginated?.items ?? paginated?.data ?? [];
}

export function useRiskTypes(riskClassId?: string) {
  return useQuery({
    queryKey: RISK_TYPES_KEY,
    queryFn: fetchRiskTypes,
    select: (list) => (riskClassId ? list.filter((rt) => rt.riskClassId === riskClassId) : list),
    staleTime: STABLE_SETTINGS_STALE_TIME_MS,
  });
}

async function fetchRiskTypes() {
  const res = await api.get(BASE);
  return extractList(res.data);
}

export function useCreateRiskType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRiskTypePayload) => {
      const res = await api.post<RiskType>(BASE, payload);
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
      const res = await api.patch<RiskType>(`${BASE}/${id}`, payload);
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
      await api.delete(`${BASE}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RISK_TYPES_KEY });
    },
  });
}

export function useDeleteRiskTypeField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ riskTypeId, fieldId }: { riskTypeId: string; fieldId: string }) => {
      await api.delete(`${BASE}/${riskTypeId}/fields/${fieldId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RISK_TYPES_KEY });
    },
  });
}

export function useCreateRiskTypeField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      riskTypeId,
      ...payload
    }: CreateRiskTypeFieldPayload & { riskTypeId: string }) => {
      const res = await api.post(`${BASE}/${riskTypeId}/fields`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RISK_TYPES_KEY });
    },
  });
}

export function useRiskTypeOptions(riskClassId?: string) {
  return useQuery({
    queryKey: RISK_TYPES_KEY,
    queryFn: fetchRiskTypes,
    select: (list) => {
      const filtered = riskClassId ? list.filter((rt) => rt.riskClassId === riskClassId) : list;
      return filtered.map((rt) => ({ value: rt.id, label: rt.name }));
    },
    staleTime: STABLE_SETTINGS_STALE_TIME_MS,
  });
}
