import { create } from 'zustand';

/** One row of the bank statement as read from the uploaded sheet. Money in and out are kept apart
 *  so the reconcile page can show them the way it shows the ledger. */
export interface BankStatementRow {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  reference: string;
  description: string;
  moneyIn: number;
  moneyOut: number;
  balance?: number;
}

interface BankStatementDraftState {
  /** Statement rows per cash account. */
  rowsByAccount: Record<string, BankStatementRow[]>;
  setRows: (cashAccountId: string, rows: BankStatementRow[]) => void;
  clearRows: (cashAccountId: string) => void;
}

/** Holds the values read from an uploaded statement until the reconcile page is done with them.
 *  Nothing is persisted: the file is never kept, and a refresh drops the values, like the
 *  journal line import. */
export const useBankStatementDraftStore = create<BankStatementDraftState>((set) => ({
  rowsByAccount: {},
  setRows: (cashAccountId, rows) =>
    set((state) => ({ rowsByAccount: { ...state.rowsByAccount, [cashAccountId]: rows } })),
  clearRows: (cashAccountId) =>
    set((state) => {
      const next = { ...state.rowsByAccount };
      delete next[cashAccountId];
      return { rowsByAccount: next };
    }),
}));
