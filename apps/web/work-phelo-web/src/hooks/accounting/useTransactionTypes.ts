import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DEFAULT_TRANSACTION_TYPES } from '@/lib/accounting/defaultTransactionTypes';
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
    queryFn: async () => (await api.get<TransactionTypeDefinition[]>(BASE)).data,
    // Seeds the table with the system defaults (the types that used to be hardcoded
    // in the cashbook chooser) — replaced automatically once a real fetch succeeds.
    initialData: DEFAULT_TRANSACTION_TYPES,
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
