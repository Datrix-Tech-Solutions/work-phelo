import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreatePlacementPaymentPayload,
  PlacementLockStatus,
  PlacementPayment,
} from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';
const FACULTATIVES_KEY = ['reinsurance', 'placements'] as const;

export const placementPaymentKeys = {
  all: ['reinsurance', 'placement-payments'] as const,
  list: (placementId: string) => [...placementPaymentKeys.all, placementId, 'list'] as const,
  detail: (placementId: string, paymentId: string) =>
    [...placementPaymentKeys.all, placementId, paymentId] as const,
  lockStatus: (placementId: string) =>
    [...placementPaymentKeys.all, placementId, 'lock-status'] as const,
};

function extractPaymentList(data: unknown): PlacementPayment[] {
  if (Array.isArray(data)) return data as PlacementPayment[];
  return ((data as { items?: PlacementPayment[] })?.items ?? []) as PlacementPayment[];
}

export function usePlacementPayments(placementId: string) {
  return useQuery({
    queryKey: placementPaymentKeys.list(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/payments`);
      return extractPaymentList(res.data);
    },
    enabled: !!placementId,
  });
}

export function usePlacementPayment(placementId: string, paymentId?: string) {
  return useQuery({
    queryKey: placementPaymentKeys.detail(placementId, paymentId ?? ''),
    queryFn: async () => {
      const res = await api.get<PlacementPayment>(`${BASE}/${placementId}/payments/${paymentId}`);
      return res.data;
    },
    enabled: !!placementId && !!paymentId,
  });
}

export function usePlacementLockStatus(placementId: string) {
  return useQuery({
    queryKey: placementPaymentKeys.lockStatus(placementId),
    queryFn: async () => {
      const res = await api.get<PlacementLockStatus>(`${BASE}/${placementId}/lock-status`);
      return res.data;
    },
    enabled: !!placementId,
  });
}

export function useCreatePlacementPayment(placementId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      placementId: targetPlacementId,
      payload,
    }: {
      placementId?: string;
      payload: CreatePlacementPaymentPayload;
    }) => {
      const id = targetPlacementId ?? placementId;
      if (!id) throw new Error('Placement is required to record a payment.');
      const res = await api.post<PlacementPayment>(`${BASE}/${id}/payments`, payload);
      return res.data;
    },
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: placementPaymentKeys.list(payment.placementId) });
      queryClient.invalidateQueries({
        queryKey: placementPaymentKeys.lockStatus(payment.placementId),
      });
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY });
      queryClient.invalidateQueries({
        queryKey: [...FACULTATIVES_KEY, payment.placementId],
      });
    },
  });
}

export function useReversePlacementPayment(placementId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await api.post<PlacementPayment>(
        `${BASE}/${placementId}/payments/${paymentId}/reverse`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: placementPaymentKeys.list(placementId) });
      queryClient.invalidateQueries({ queryKey: placementPaymentKeys.lockStatus(placementId) });
      queryClient.invalidateQueries({ queryKey: FACULTATIVES_KEY });
      queryClient.invalidateQueries({ queryKey: [...FACULTATIVES_KEY, placementId] });
    },
  });
}
