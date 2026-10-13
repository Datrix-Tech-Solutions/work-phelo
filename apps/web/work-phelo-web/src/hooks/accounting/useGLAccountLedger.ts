import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { GLAccountLedger } from '@/types/accounting';

/** Shared by the ledger table and the Cash and Bank cards so both read one cached copy. */
export function glAccountLedgerQuery(accountId: string) {
  return {
    queryKey: ['accounting', 'gl-accounts', accountId, 'ledger'] as const,
    queryFn: async () =>
      (await api.get<GLAccountLedger>(`/accounting/accounts/${accountId}/ledger`)).data,
  };
}

export function useGLAccountLedger(accountId: string) {
  return useQuery({ ...glAccountLedgerQuery(accountId), enabled: Boolean(accountId) });
}
