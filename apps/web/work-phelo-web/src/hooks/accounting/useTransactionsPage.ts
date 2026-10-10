import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { mapDocument } from '@/hooks/accounting/useTradeDocuments';
import type {
  AccountingTradeDocument,
  CashbookTransaction,
  QueryTransactionsParams,
  TransactionsPageItem,
} from '@/types/accounting';

/** Every mutation refreshes the page that is showing, see the query provider. */
export const TRANSACTIONS_PAGE_KEY = ['accounting', 'transactions-page'] as const;

interface RawItem {
  kind: 'RECEIVABLE' | 'PAYABLE' | 'CASHBOOK';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: Record<string, any>;
}

/** One page of the Transactions list. The filtering, search and paging are done by the server,
 *  so the cost of a page doesn't grow with the history. */
export function useTransactionsPage(params: QueryTransactionsParams) {
  return useQuery({
    queryKey: [...TRANSACTIONS_PAGE_KEY, params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await api.get<{
        items: RawItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>('/accounting/transactions', { params });
      const items = res.data.items.map<TransactionsPageItem>((item) =>
        item.kind === 'CASHBOOK'
          ? { kind: 'cashbook', transaction: item.record as unknown as CashbookTransaction }
          : {
              kind: 'document',
              document: mapDocument(item.record, item.kind) as AccountingTradeDocument,
            },
      );
      return { ...res.data, items };
    },
  });
}
