import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AccountingBankConfirmationWorkItem,
  ConfirmBankPaymentPayload,
} from '@/types/accountingIntegration';
import type { PlacementPayment } from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';
const PENDING_BANK_CONFIRMATIONS_KEY = ['accounting', 'reinsurance-bank-confirmations'] as const;

export interface ConfirmReinsurerDisbursementBankPaymentPayload extends ConfirmBankPaymentPayload {
  placementId: string;
  paymentId: string;
}

function sourceDescription(payment: PlacementPayment) {
  if (payment.endorsementClosing) {
    return `Endorsement closing ${payment.endorsementClosing.closingNumber}`;
  }
  if (payment.closing) {
    return `Closing ${payment.closing.closingNumber}`;
  }
  return 'Credit-note allocation';
}

export function mapReinsurancePaymentToBankConfirmationWorkItem(
  payment: PlacementPayment,
): AccountingBankConfirmationWorkItem {
  return {
    id: `REINSURANCE:${payment.id}`,
    sourceModule: 'REINSURANCE',
    sourceRecordId: payment.id,
    sourceParentId: payment.placementId,
    sourceReference: payment.settlementReference ?? payment.reference ?? payment.id,
    sourceDescription: sourceDescription(payment),
    counterpartyName: payment.counterparty.name,
    counterpartyType: payment.counterparty.type,
    amount: payment.amount,
    currency: payment.currency,
    businessDate: payment.paymentDate,
    operationalReference: payment.reference,
    settlementReference: payment.settlementReference,
    status: payment.status,
  };
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

export function useReinsuranceBankConfirmationWorkItems() {
  const query = usePendingReinsurerDisbursementConfirmations();
  return {
    ...query,
    data: query.data?.map(mapReinsurancePaymentToBankConfirmationWorkItem),
  };
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
