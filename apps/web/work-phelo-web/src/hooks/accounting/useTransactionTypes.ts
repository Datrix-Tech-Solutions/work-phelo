import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  TransactionTypeDefinition,
  CreateTransactionTypePayload,
  UpdateTransactionTypePayload,
} from '@/types/accounting';

const BASE = '/accounting/transaction-types';
export const TRANSACTION_TYPES_KEY = ['accounting', 'transaction-types'] as const;

export function useTransactionTypes() {
  return useQuery({
    queryKey: TRANSACTION_TYPES_KEY,
    // The backend auto-seeds the standard set (Receipt/Payment/Transfer/Charge/
    // Adjustment) for a tenant on first read, so this never comes back empty for
    // long — no need for a hardcoded client-side placeholder.
    queryFn: async () => (await api.get<TransactionTypeDefinition[]>(BASE)).data,
  });
}

export function useCreateTransactionType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTransactionTypePayload) =>
      (await api.post<TransactionTypeDefinition>(BASE, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRANSACTION_TYPES_KEY }),
  });
}

export function useUpdateTransactionType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTransactionTypePayload & { id: string }) =>
      (await api.patch<TransactionTypeDefinition>(`${BASE}/${id}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRANSACTION_TYPES_KEY }),
  });
}

export function useDeleteTransactionType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`${BASE}/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRANSACTION_TYPES_KEY }),
  });
}
