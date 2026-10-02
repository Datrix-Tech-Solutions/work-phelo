import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  MakeSourceLedgerPaymentPayload,
  SourceLedgerEntry,
  SourceLedgerQuery,
  SourceLedgerSummary,
} from '@/types/accounting';

const BASE = '/accounting/source-ledger';
export const SOURCE_LEDGER_KEY = ['accounting', 'source-ledger'] as const;

export function useSourceLedger(query: SourceLedgerQuery = {}) {
  return useQuery({
    queryKey: [...SOURCE_LEDGER_KEY, query],
    queryFn: async () => (await api.get<SourceLedgerEntry[]>(BASE, { params: query })).data,
  });
}

export function useSourceLedgerSummary(sourceTypeId: string | undefined) {
  return useQuery({
    queryKey: [...SOURCE_LEDGER_KEY, 'summary', sourceTypeId ?? null],
    queryFn: async () =>
      (await api.get<SourceLedgerSummary>(`${BASE}/summary`, { params: { sourceTypeId } })).data,
    enabled: !!sourceTypeId,
  });
}

export function useMakeSourceLedgerPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entryId,
      payload,
    }: {
      entryId: string;
      payload: MakeSourceLedgerPaymentPayload;
    }) => (await api.post<SourceLedgerEntry>(`${BASE}/${entryId}/payments`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SOURCE_LEDGER_KEY });
    },
  });
}
