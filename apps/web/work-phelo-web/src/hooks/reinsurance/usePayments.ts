import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PlacementPayment, CreatePlacementPaymentPayload } from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';

const paymentsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'payments'] as const;

export function usePlacementPayments(placementId: string) {
  return useQuery({
    queryKey: paymentsKey(placementId),
    queryFn: async () => {
      const res = await api.get(`${BASE}/${placementId}/payments`);
      const items: PlacementPayment[] = res.data?.items ?? res.data ?? [];
      return items;
    },
    enabled: !!placementId,
  });
}

export function useCreatePlacementPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      ...payload
    }: CreatePlacementPaymentPayload & { placementId: string }) => {
      const res = await api.post(`${BASE}/${placementId}/payments`, payload);
      return res.data as PlacementPayment;
    },
    onSuccess: (_, { placementId }) => {
      queryClient.invalidateQueries({ queryKey: paymentsKey(placementId) });
    },
  });
}

export function useReversePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ placementId, paymentId }: { placementId: string; paymentId: string }) => {
      const res = await api.post(`${BASE}/${placementId}/payments/${paymentId}/reverse`);
      return res.data as PlacementPayment;
    },
    onSuccess: (_, { placementId }) => {
      queryClient.invalidateQueries({ queryKey: paymentsKey(placementId) });
    },
  });
}
