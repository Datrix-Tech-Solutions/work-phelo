import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  AddClientProductPayload,
  BillingOptions,
  BillingTransactionsResponse,
  ClientBillingSummary,
  ClientDetail,
  ClientDetailProduct,
  ClientListItem,
  ClientListResponse,
  ClientsQuery,
  ConvertedClient,
  ConvertProspectPayload,
  CreateClientPayload,
  CreateProspectInteractionPayload,
  RaiseClientBillingPayload,
  RequestClientPaymentPayload,
  UpdateClientPayload,
} from '@/types/marketing';

const ENDPOINT = '/marketing/clients';
const CLIENTS_KEY = ['marketing', 'clients'] as const;

export function useClients(query: ClientsQuery = {}) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, query] as const,
    queryFn: async () => {
      const res = await api.get<ClientListResponse>(ENDPOINT, { params: query });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateClientPayload) => {
      const res = await api.post<ClientListItem>(ENDPOINT, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

export function useConvertProspectToClient(prospectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ConvertProspectPayload) => {
      const res = await api.post<ConvertedClient>(
        `/marketing/prospects/${prospectId}/convert`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
      // The prospect leaves the active list and its follow-ups move over to the client.
      queryClient.invalidateQueries({ queryKey: ['marketing', 'prospects'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'follow-ups'] });
    },
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, 'detail', id] as const,
    queryFn: async () => {
      const res = await api.get<ClientDetail>(`${ENDPOINT}/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${ENDPOINT}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
      // Deleting a client turns its originating prospect back into an active one.
      queryClient.invalidateQueries({ queryKey: ['marketing', 'prospects'] });
      queryClient.invalidateQueries({ queryKey: ['marketing', 'follow-ups'] });
    },
  });
}

export function useAddClientProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AddClientProductPayload) => {
      const res = await api.post<ClientDetailProduct>(`${ENDPOINT}/${id}/products`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateClientPayload) => {
      const res = await api.patch<ClientDetail>(`${ENDPOINT}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

export function useAddClientInteraction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateProspectInteractionPayload) => {
      const res = await api.post(`${ENDPOINT}/${id}/interactions`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

/** Whether Accounting is set up to bill clients, and what the billing form offers. */
export function useBillingOptions() {
  return useQuery({
    queryKey: [...CLIENTS_KEY, 'billing-options'] as const,
    queryFn: async () => {
      const res = await api.get<BillingOptions>(`${ENDPOINT}/billing/options`);
      return res.data;
    },
    staleTime: 30_000,
    retry: false,
  });
}

export function useClientBillingTransactions(id: string, page: number, enabled = true) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, 'detail', id, 'billing', 'transactions', page] as const,
    queryFn: async () => {
      const res = await api.get<BillingTransactionsResponse>(
        `${ENDPOINT}/${id}/billing/transactions`,
        { params: { page, limit: 10 } },
      );
      return res.data;
    },
    enabled: enabled && !!id,
    placeholderData: (previous) => previous,
  });
}

/** Achieved revenue for the client and per product — Accounting's receipts. */
export function useClientBillingSummary(id: string, enabled = true) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, 'detail', id, 'billing', 'summary'] as const,
    queryFn: async () => {
      const res = await api.get<ClientBillingSummary>(`${ENDPOINT}/${id}/billing/summary`);
      return res.data;
    },
    enabled: enabled && !!id,
  });
}

export function useRaiseClientBilling(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RaiseClientBillingPayload) => {
      const res = await api.post(`${ENDPOINT}/${id}/billing`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

/** The client has paid (part of) a posted invoice — asks Accounting to record it. */
export function useRequestClientPayment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RequestClientPaymentPayload) => {
      const res = await api.post(`${ENDPOINT}/${id}/billing/payments`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

/** Withdraws a payment request Accounting has not acted on yet. */
export function useCancelClientPayment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const res = await api.post(`${ENDPOINT}/${id}/billing/payments/${requestId}/cancel`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}
