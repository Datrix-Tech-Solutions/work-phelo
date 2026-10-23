import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CASHBOOK_KEY,
  CASH_ACCOUNTS_KEY,
  useCashAccounts,
} from '@/hooks/accounting/useCashAccounts';
import { GL_ACCOUNTS_KEY } from '@/hooks/accounting/useGLAccounts';
import { glAccountLedgerQuery, useGLAccountLedger } from '@/hooks/accounting/useGLAccountLedger';
import { useFiscalYears } from '@/hooks/accounting/useFiscalPeriods';
import type {
  CashbookTransaction,
  CreateCashbookAdjustmentPayload,
  CreateCashbookEntryPayload,
  CreateCashbookTransferPayload,
  PaginatedResult,
  QueryCashbookParams,
  RejectDraftPayload,
  ReverseCashbookTransactionPayload,
  UpdateCashbookDraftPayload,
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

export interface CashAndBankStats {
  netCashPosition: Record<string, number>;
  inflowYtd: Record<string, number>;
  outflowYtd: Record<string, number>;
}

function localDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function add(totals: Record<string, number>, currency: string, amount: number) {
  totals[currency] = (totals[currency] ?? 0) + amount;
}

/**
 * Cash and Bank figures are read from the journal lines on the cash accounts' GL accounts, the
 * same lines the General Ledger table lists. So they include everything that touches the account
 * (receipts, payments, bill and invoice payments, transfers, and journals posted straight to it,
 * such as an opening balance or capital) and always agree with the ledger. A debit is money in
 * and a credit is money out. Amounts are in the journal's own currency, totalled per currency
 * with no FX applied.
 *
 * Inflow/outflow are year-to-date, starting from the fiscal year that contains today rather
 * than the calendar year — a tenant whose fiscal year doesn't start in January should still
 * see "this year" mean their fiscal year. Falls back to 1 January if no fiscal year covers
 * today (e.g. none has been set up yet).
 *
 * Money moved between two of your own cash accounts is not an inflow or outflow of the business,
 * so on the all-accounts view a journal that touches two cash accounts is left out.
 */
export function useCashAndBankStats() {
  const { data: fiscalYears = [] } = useFiscalYears();
  const { data: cashAccounts = [], isLoading: isLoadingAccounts } = useCashAccounts();
  const toDate = localDate(new Date());
  const currentYear = fiscalYears.find(
    (year) => year.startDate.slice(0, 10) <= toDate && toDate <= year.endDate.slice(0, 10),
  );
  const fromDate = currentYear
    ? currentYear.startDate.slice(0, 10)
    : `${new Date().getFullYear()}-01-01`;

  const glAccountIds = useMemo(
    () => Array.from(new Set(cashAccounts.map((account) => account.glAccountId))),
    [cashAccounts],
  );
  const ledgers = useQueries({
    queries: glAccountIds.map((id) => glAccountLedgerQuery(id)),
    combine: (results) => ({
      isLoading: results.some((result) => result.isLoading),
      entries: results.flatMap((result) => result.data?.entries ?? []),
    }),
  });

  const data = useMemo<CashAndBankStats | undefined>(() => {
    if (isLoadingAccounts || ledgers.isLoading) return undefined;
    // The cash accounts' own balances are the same journal lines, summed.
    const stats: CashAndBankStats = { netCashPosition: {}, inflowYtd: {}, outflowYtd: {} };
    for (const account of cashAccounts) {
      add(stats.netCashPosition, account.currency, Number(account.balance));
    }

    const cashAccountsPerJournal = new Map<string, Set<string>>();
    for (const entry of ledgers.entries) {
      const accounts = cashAccountsPerJournal.get(entry.journalEntryId) ?? new Set<string>();
      accounts.add(entry.glAccountId);
      cashAccountsPerJournal.set(entry.journalEntryId, accounts);
    }
    for (const entry of ledgers.entries) {
      if ((cashAccountsPerJournal.get(entry.journalEntryId)?.size ?? 0) > 1) continue;
      const date = entry.journalEntry.transactionDate.slice(0, 10);
      if (date < fromDate || date > toDate) continue;
      const currency = entry.journalEntry.transactionCurrency;
      add(stats.inflowYtd, currency, Number(entry.transactionDebit));
      add(stats.outflowYtd, currency, Number(entry.transactionCredit));
    }
    return stats;
  }, [cashAccounts, isLoadingAccounts, ledgers, fromDate, toDate]);

  return { data, isLoading: isLoadingAccounts || ledgers.isLoading };
}

export interface CashAccountStats {
  inflow: Record<string, number>;
  outflow: Record<string, number>;
  net: Record<string, number>;
}

/** All-time inflow/outflow/net for one Cash/Bank account, from its GL account's journal lines —
 *  the lines the General Ledger table under it lists, so the cards always agree with that table. */
export function useCashAccountStats(
  glAccountId: string | undefined,
  range?: { fromDate?: string; toDate?: string },
) {
  const { data: ledger, isLoading } = useGLAccountLedger(glAccountId ?? '');
  const fromDate = range?.fromDate;
  const toDate = range?.toDate;
  const data = useMemo<CashAccountStats | undefined>(() => {
    if (!ledger) return undefined;
    const stats: CashAccountStats = { inflow: {}, outflow: {}, net: {} };
    for (const entry of ledger.entries) {
      const day = entry.journalEntry.transactionDate.slice(0, 10);
      if (fromDate && day < fromDate) continue;
      if (toDate && day > toDate) continue;
      const currency = entry.journalEntry.transactionCurrency;
      const debit = Number(entry.transactionDebit);
      const credit = Number(entry.transactionCredit);
      add(stats.inflow, currency, debit);
      add(stats.outflow, currency, credit);
      add(stats.net, currency, debit - credit);
    }
    return stats;
  }, [ledger, fromDate, toDate]);
  return { data, isLoading: !!glAccountId && isLoading };
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
    // The Cash and Bank figures are read from the ledger.
    queryClient.invalidateQueries({ queryKey: GL_ACCOUNTS_KEY });
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

/** Completes a draft direct receipt or payment. Its amount stays as raised. */
export function useUpdateCashbookDraft() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async ({
      transactionId,
      ...payload
    }: UpdateCashbookDraftPayload & { transactionId: string }) => {
      const res = await api.patch<CashbookTransaction>(`${BASE}/${transactionId}`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

/** Turns a draft direct receipt or payment down. It keeps its record, never posts. */
export function useRejectCashbookTransaction() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async ({
      transactionId,
      ...payload
    }: RejectDraftPayload & { transactionId: string }) => {
      const res = await api.post<CashbookTransaction>(`${BASE}/${transactionId}/reject`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

/** Deletes a draft direct receipt, payment or transfer for good. Posted entries are never deletable. */
export function useDeleteCashbookDraft() {
  const invalidate = useInvalidateCashbook();
  return useMutation({
    mutationFn: async (transactionId: string) => {
      await api.delete(`${BASE}/${transactionId}`);
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
