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

type RawRuleLine = Omit<TransactionTypeRule['lines'][number], 'scopes'> & {
  scopes?: TransactionTypeRule['lines'][number]['scopes'];
  // The shape before a main line could list several scopes.
  scopeCategory?: TransactionTypeRule['lines'][number]['scopes'][number]['category'] | null;
  scopeClassification?: TransactionTypeRule['lines'][number]['scopes'][number]['classification'];
};

/** Reads a rule from the API. A server that still returns the single `scopeCategory` /
 *  `scopeClassification` is read as a list of one, so the screens only deal with `scopes`. */
function toRule(raw: Omit<TransactionTypeRule, 'lines'> & { lines: RawRuleLine[] }) {
  return {
    ...raw,
    lines: raw.lines.map((line) => {
      const category = line.scopeCategory ?? line.scopeClassification?.category;
      return {
        ...line,
        scopes:
          line.scopes ??
          (category
            ? [
                {
                  id: line.id,
                  category,
                  classification: line.scopeClassification ?? null,
                  account: null,
                },
              ]
            : []),
      };
    }),
  } satisfies TransactionTypeRule;
}

export function useTransactionTypeRules() {
  return useQuery({
    queryKey: TRANSACTION_TYPE_RULES_KEY,
    queryFn: async () => (await api.get<Parameters<typeof toRule>[0][]>(BASE)).data.map(toRule),
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
      toRule((await api.post<Parameters<typeof toRule>[0]>(BASE, payload)).data),
    onSuccess: () => invalidateRuleQueries(queryClient),
  });
}

export function useUpdateTransactionTypeRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTransactionTypeRulePayload & { id: string }) =>
      toRule((await api.patch<Parameters<typeof toRule>[0]>(`${BASE}/${id}`, payload)).data),
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
