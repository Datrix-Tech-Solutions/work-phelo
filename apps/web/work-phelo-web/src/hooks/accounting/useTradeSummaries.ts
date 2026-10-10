import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AccountsPayableSummary, AccountsReceivableSummary } from '@/types/accounting';

/** Optional window (YYYY-MM-DD, inclusive) for the "raised in the period" figure. */
export interface TradeSummaryWindow {
  fromDate?: string;
  toDate?: string;
}

export function useAccountsReceivableSummary(window: TradeSummaryWindow = {}) {
  return useQuery({
    queryKey: ['accounting', 'receivables', 'summary', window],
    queryFn: async () =>
      (
        await api.get<AccountsReceivableSummary>('/accounting/receivables/summary', {
          params: window,
        })
      ).data,
  });
}

export function useAccountsPayableSummary(window: TradeSummaryWindow = {}) {
  return useQuery({
    queryKey: ['accounting', 'payables', 'summary', window],
    queryFn: async () =>
      (await api.get<AccountsPayableSummary>('/accounting/payables/summary', { params: window }))
        .data,
  });
}
