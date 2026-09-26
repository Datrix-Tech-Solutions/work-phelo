import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MakeSourceLedgerPaymentPayload, SourceLedgerEntry } from '@/types/accounting';

const BASE = '/accounting/source-ledger';
export const SOURCE_LEDGER_KEY = ['accounting', 'source-ledger'] as const;

export function useSourceLedger(sourceTypeId?: string) {
  return useQuery({
    queryKey: [...SOURCE_LEDGER_KEY, sourceTypeId ?? null],
    queryFn: async () =>
      (
        await api.get<SourceLedgerEntry[]>(BASE, {
          params: sourceTypeId ? { sourceTypeId } : undefined,
        })
      ).data,
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
