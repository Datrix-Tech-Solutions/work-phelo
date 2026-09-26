import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  TransactionTypeRule,
  CreateTransactionTypeRulePayload,
  UpdateTransactionTypeRulePayload,
} from '@/types/accounting';
import { TRANSACTION_TYPES_KEY } from './useTransactionTypes';

const BASE = '/accounting/transaction-type-rules';
export const TRANSACTION_TYPE_RULES_KEY = ['accounting', 'transaction-type-rules'] as const;

export function useTransactionTypeRules() {
  return useQuery({
    queryKey: TRANSACTION_TYPE_RULES_KEY,
    queryFn: async () => (await api.get<TransactionTypeRule[]>(BASE)).data,
  });
}

// A rule change also shifts the transaction type's `rulesCount`, so refresh both lists.
function invalidateRuleQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: TRANSACTION_TYPE_RULES_KEY });
  queryClient.invalidateQueries({ queryKey: TRANSACTION_TYPES_KEY });
}

export function useCreateTransactionTypeRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTransactionTypeRulePayload) =>
      (await api.post<TransactionTypeRule>(BASE, payload)).data,
    onSuccess: () => invalidateRuleQueries(queryClient),
  });
}

export function useUpdateTransactionTypeRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTransactionTypeRulePayload & { id: string }) =>
      (await api.patch<TransactionTypeRule>(`${BASE}/${id}`, payload)).data,
    onSuccess: () => invalidateRuleQueries(queryClient),
  });
}

export function useDeleteTransactionTypeRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`${BASE}/${id}`)).data,
    onSuccess: () => invalidateRuleQueries(queryClient),
  });
}
