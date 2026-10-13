import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CompletePaymentRequestPayload,
  PaymentRequest,
  RejectDraftPayload,
} from '@/types/accounting';

/* Payment requests raised by another module (e.g. Marketing) against a posted invoice. The
 * accountant records one through Receive Payment (choosing the bank) or rejects it. */

const BASE = '/accounting/receivables';
const KEY = ['accounting', 'payment-requests'] as const;

/** Requests waiting for the accountant, newest first. */
export function usePendingPaymentRequests() {
  return useQuery({
    queryKey: [...KEY, 'pending'] as const,
    queryFn: async () => {
      const res = await api.get<{ data: PaymentRequest[] }>(`${BASE}/payment-requests`, {
        params: { status: 'PENDING', limit: 100 },
      });
      return res.data.data;
    },
  });
}

/** Every request raised against one invoice, whatever its state. */
export function useInvoicePaymentRequests(invoiceId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'invoice', invoiceId] as const,
    queryFn: async () => {
      const res = await api.get<{ items: PaymentRequest[] }>(
        `${BASE}/invoices/${invoiceId}/payment-requests`,
      );
      return res.data.items;
    },
    enabled: !!invoiceId,
  });
}

/** A request being settled or turned down also changes the invoice, its balance and the cashbook. */
function useInvalidateAfterRequest() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: KEY });
    queryClient.invalidateQueries({ queryKey: ['accounting'] });
  };
}

export function useCompletePaymentRequest() {
  const invalidate = useInvalidateAfterRequest();
  return useMutation({
    mutationFn: async ({ id, ...payload }: CompletePaymentRequestPayload & { id: string }) => {
      const res = await api.post<PaymentRequest>(
        `${BASE}/payment-requests/${id}/complete`,
        payload,
      );
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useRejectPaymentRequest() {
  const invalidate = useInvalidateAfterRequest();
  return useMutation({
    mutationFn: async ({ id, ...payload }: RejectDraftPayload & { id: string }) => {
      const res = await api.post<PaymentRequest>(`${BASE}/payment-requests/${id}/reject`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}
