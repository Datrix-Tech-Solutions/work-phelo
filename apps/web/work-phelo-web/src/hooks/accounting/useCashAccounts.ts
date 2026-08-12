import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AccountingCashAccount, QueryCashAccountsParams } from '@/types/accounting';

export const CASH_ACCOUNTS_KEY = ['accounting', 'cash-accounts'] as const;
export const CASHBOOK_KEY = ['accounting', 'cashbook'] as const;

export function useCashAccounts(params: QueryCashAccountsParams = {}) {
  const { accountKind, currency, isActive } = params;
  return useQuery({
    queryKey: [...CASH_ACCOUNTS_KEY, accountKind ?? null, currency ?? null, isActive ?? null],
    queryFn: async () => {
      const res = await api.get<AccountingCashAccount[]>('/accounting/cash-accounts', {
        params: { accountKind, currency, isActive },
      });
      return res.data;
    },
  });
}

export function useCashAccountOptions(params: QueryCashAccountsParams = {}) {
  const { data = [], isLoading, isError } = useCashAccounts({ isActive: true, ...params });
  return {
    options: data
      .filter((account) => account.isActive)
      .map((account) => ({
        value: account.id,
        label: [
          account.name,
          account.accountKind.replaceAll('_', ' '),
          account.currency,
          account.glAccount ? `${account.glAccount.code} ${account.glAccount.name}` : null,
        ]
          .filter(Boolean)
          .join(' - '),
      })),
    isLoading,
    isError,
  };
}
