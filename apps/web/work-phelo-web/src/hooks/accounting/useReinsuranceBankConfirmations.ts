import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PlacementPayment } from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';
const PENDING_BANK_CONFIRMATIONS_KEY = ['accounting', 'reinsurance-bank-confirmations'] as const;

export interface ConfirmReinsurerDisbursementBankPaymentPayload {
  placementId: string;
  paymentId: string;
  bankConfirmedAt: string;
  bankReference: string;
  agreedExchangeRate?: number;
  bankChargeAmount?: number;
  withholdingTaxAmount?: number;
  notes?: string;
}

export function usePendingReinsurerDisbursementConfirmations() {
  return useQuery({
    queryKey: PENDING_BANK_CONFIRMATIONS_KEY,
    queryFn: async () => {
      const res = await api.get<{ items: PlacementPayment[] }>(
        `${BASE}/payments/pending-bank-confirmation`,
      );
      return res.data.items;
    },
  });
}

export function useConfirmReinsurerDisbursementBankPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      placementId,
      paymentId,
      ...payload
    }: ConfirmReinsurerDisbursementBankPaymentPayload) => {
      const res = await api.post<PlacementPayment>(
        `${BASE}/${placementId}/payments/${paymentId}/bank-confirmation`,
        payload,
      );
      return res.data;
    },
    onSuccess: (payment) => {
      queryClient.invalidateQueries({
        queryKey: PENDING_BANK_CONFIRMATIONS_KEY,
      });
      queryClient.invalidateQueries({
        queryKey: ['reinsurance', 'facultatives', payment.placementId],
      });
      queryClient.invalidateQueries({
        queryKey: ['reinsurance', 'facultatives', payment.placementId, 'payments'],
      });
      queryClient.invalidateQueries({
        queryKey: ['reinsurance', 'facultatives', payment.placementId, 'financial-position'],
      });
    },
  });
}
