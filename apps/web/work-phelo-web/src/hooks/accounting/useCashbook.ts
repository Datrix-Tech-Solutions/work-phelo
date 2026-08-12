import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CASHBOOK_KEY, CASH_ACCOUNTS_KEY } from '@/hooks/accounting/useCashAccounts';
import type {
  CashbookTransaction,
  CreateCashbookAdjustmentPayload,
  CreateCashbookEntryPayload,
  CreateCashbookTransferPayload,
  PaginatedResult,
  QueryCashbookParams,
  ReverseCashbookTransactionPayload,
} from '@/types/accounting';

const BASE = '/accounting/cashbook';

export function useCashbookTransactions(params: QueryCashbookParams = {}) {
  return useQuery({
    queryKey: [...CASHBOOK_KEY, 'list', params],
    queryFn: async () => {
      const res = await api.get<PaginatedResult<CashbookTransaction>>(BASE, { params });
      return res.data;
    },
  });
}

export function useCashbookTransaction(transactionId: string | undefined) {
  return useQuery({
    queryKey: [...CASHBOOK_KEY, transactionId],
    queryFn: async () => {
      const res = await api.get<CashbookTransaction>(`${BASE}/${transactionId}`);
      return res.data;
    },
    enabled: !!transactionId,
  });
}

function useInvalidateCashbook() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: CASHBOOK_KEY });
    queryClient.invalidateQueries({ queryKey: CASH_ACCOUNTS_KEY });
  };
}

export function useCreateCashbookReceipt() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async (payload: CreateCashbookEntryPayload) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/receipts`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useCreateCashbookPayment() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async (payload: CreateCashbookEntryPayload) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/payments`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useCreateCashbookCharge() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async (payload: CreateCashbookEntryPayload) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/charges`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useCreateCashbookAdjustment() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async (payload: CreateCashbookAdjustmentPayload) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/adjustments`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useCreateCashbookTransfer() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async (payload: CreateCashbookTransferPayload) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/transfers`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function usePostCashbookTransaction() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/${transactionId}/post`);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useReverseCashbookTransaction() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async ({
      transactionId,
      ...payload
    }: ReverseCashbookTransactionPayload & { transactionId: string }) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/${transactionId}/reverse`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}
