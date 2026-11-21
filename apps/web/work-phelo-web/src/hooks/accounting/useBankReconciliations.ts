import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  BankReconciliation,
  BankReconciliationDetail,
  CompleteBankReconciliationPayload,
} from '@/types/accounting';

const BASE = '/accounting/bank-reconciliations';
export const BANK_RECONCILIATIONS_KEY = ['accounting', 'bank-reconciliations'] as const;

export function useBankReconciliations(cashAccountId: string | undefined) {
  return useQuery({
    queryKey: [...BANK_RECONCILIATIONS_KEY, 'list', cashAccountId],
    queryFn: async () => {
      const res = await api.get<BankReconciliation[]>(BASE, { params: { cashAccountId } });
      return res.data;
    },
    enabled: !!cashAccountId,
  });
}

export function useBankReconciliation(id: string | undefined) {
  return useQuery({
    queryKey: [...BANK_RECONCILIATIONS_KEY, 'detail', id],
    queryFn: async () => {
      const res = await api.get<BankReconciliationDetail>(`${BASE}/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

/** Ledger lines of the cash account that earlier reconciliations already covered. */
export function useReconciledJournalLineIds(cashAccountId: string | undefined) {
  return useQuery({
    queryKey: [...BANK_RECONCILIATIONS_KEY, 'reconciled-entries', cashAccountId],
    queryFn: async () => {
      const res = await api.get<{ journalLineIds: string[] }>(`${BASE}/reconciled-entries`, {
        params: { cashAccountId },
      });
      return new Set(res.data.journalLineIds);
    },
    enabled: !!cashAccountId,
  });
}

export function useCompleteBankReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CompleteBankReconciliationPayload) => {
      const res = await api.post<BankReconciliationDetail>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_RECONCILIATIONS_KEY });
    },
  });
}
