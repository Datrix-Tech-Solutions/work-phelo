import type { SourceLedgerPaymentState } from '@/types/accounting';

export const SOURCE_LEDGER_STATUS_LABEL: Record<SourceLedgerPaymentState, string> = {
  OPEN: 'Unpaid',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
};

export const SOURCE_LEDGER_STATUS_VARIANT: Record<
  SourceLedgerPaymentState,
  'neutral' | 'warning' | 'success'
> = {
  OPEN: 'neutral',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
};

export function fmtSourceLedgerAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Days since the entry's event date (when the accrual/liability was created) — the
 *  standard "how overdue is this" signal for an open or partially paid item. */
export function agingDays(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
}
