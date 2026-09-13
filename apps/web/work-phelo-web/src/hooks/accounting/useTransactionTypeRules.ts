import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  TransactionTypeRule,
  CreateTransactionTypeRulePayload,
  UpdateTransactionTypeRulePayload,
} from '@/types/accounting';

const BASE = '/accounting/transaction-type-rules';
export const TRANSACTION_TYPE_RULES_KEY = ['accounting', 'transaction-type-rules'] as const;

export function useTransactionTypeRules() {
  return useQuery({
    queryKey: TRANSACTION_TYPE_RULES_KEY,
    queryFn: async () => (await api.get<TransactionTypeRule[]>(BASE)).data,
  });
}

export function useCreateTransactionTypeRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTransactionTypeRulePayload) =>
      (await api.post<TransactionTypeRule>(BASE, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRANSACTION_TYPE_RULES_KEY }),
  });
}

export function useUpdateTransactionTypeRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTransactionTypeRulePayload & { id: string }) =>
      (await api.patch<TransactionTypeRule>(`${BASE}/${id}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRANSACTION_TYPE_RULES_KEY }),
  });
}

export function useDeleteTransactionTypeRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`${BASE}/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRANSACTION_TYPE_RULES_KEY }),
  });
}
