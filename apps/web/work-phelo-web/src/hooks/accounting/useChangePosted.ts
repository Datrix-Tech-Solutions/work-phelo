import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AccountingTradeSide,
  ArchiveListResult,
  QueryArchiveParams,
} from '@/types/accounting';

/* Voiding, editing and restoring posted entries while their period is open. A change here moves
 * balances, statements and reports everywhere, so every accounting query is refreshed afterwards. */

const ARCHIVE_KEY = ['accounting', 'archive'] as const;

function useRefreshAccounting() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['accounting'] });
}

type Action = 'void' | 'restore' | 'edit';

function request(action: Action, url: string, data: unknown) {
  if (action === 'edit') return api.patch(`${url}/posted`, data);
  return api.post(`${url}/${action}`, data ?? {});
}

function usePostedAction<T extends { id: string }>(action: Action, urlFor: (vars: T) => string) {
  const refresh = useRefreshAccounting();
  return useMutation({
    mutationFn: async (vars: T) => {
      const { id: _id, ...body } = vars;
      void _id;
      const res = await request(action, urlFor(vars), body);
      return res.data as unknown;
    },
    onSuccess: refresh,
  });
}

export interface VoidVars {
  id: string;
  reason: string;
}

/* ---- Journals ---- */

const JOURNALS = '/accounting/journals';

export function useVoidJournal() {
  return usePostedAction<VoidVars>('void', (v) => `${JOURNALS}/${v.id}`);
}
export function useEditPostedJournal() {
  return usePostedAction<{ id: string } & Record<string, unknown>>(
    'edit',
    (v) => `${JOURNALS}/${v.id}`,
  );
}
export function useRestoreJournal() {
  return usePostedAction<{ id: string } & Record<string, unknown>>(
    'restore',
    (v) => `${JOURNALS}/${v.id}`,
  );
}

/* ---- Cashbook (direct receipts, payments, contra transactions) ---- */

const CASHBOOK = '/accounting/cashbook';

export function useVoidCashbook() {
  return usePostedAction<VoidVars>('void', (v) => `${CASHBOOK}/${v.id}`);
}
export function useEditPostedCashbook() {
  return usePostedAction<{ id: string } & Record<string, unknown>>(
    'edit',
    (v) => `${CASHBOOK}/${v.id}`,
  );
}
export function useRestoreCashbook() {
  return usePostedAction<{ id: string } & Record<string, unknown>>(
    'restore',
    (v) => `${CASHBOOK}/${v.id}`,
  );
}

/* ---- Invoices, bills, credit/debit notes, receipts and payments ---- */

/** Which kind of trade record: a document (invoice/bill), a credit/debit note, or a receipt/payment. */
export type TradeEntryKind = 'document' | 'note' | 'settlement';

function tradeUrl(side: AccountingTradeSide, kind: TradeEntryKind, id: string) {
  const base = side === 'RECEIVABLE' ? '/accounting/receivables' : '/accounting/payables';
  const segment =
    kind === 'note'
      ? 'credit-notes'
      : kind === 'settlement'
        ? side === 'RECEIVABLE'
          ? 'receipts'
          : 'payments'
        : side === 'RECEIVABLE'
          ? 'invoices'
          : 'bills';
  return `${base}/${segment}/${id}`;
}

type TradeVars = { id: string; kind: TradeEntryKind } & Record<string, unknown>;

function useTradeAction(side: AccountingTradeSide, action: Action) {
  const refresh = useRefreshAccounting();
  return useMutation({
    mutationFn: async (vars: TradeVars) => {
      const { id, kind, ...body } = vars;
      const res = await request(action, tradeUrl(side, kind, id), body);
      return res.data as unknown;
    },
    onSuccess: refresh,
  });
}

export function useVoidTradeEntry(side: AccountingTradeSide) {
  return useTradeAction(side, 'void');
}
export function useEditPostedTradeEntry(side: AccountingTradeSide) {
  return useTradeAction(side, 'edit');
}
export function useRestoreTradeEntry(side: AccountingTradeSide) {
  return useTradeAction(side, 'restore');
}

/* ---- The archive ---- */

export function useArchive(params: QueryArchiveParams = {}) {
  return useQuery({
    queryKey: [...ARCHIVE_KEY, params],
    queryFn: async () => {
      const res = await api.get<ArchiveListResult>('/accounting/archive', { params });
      return res.data;
    },
  });
}
