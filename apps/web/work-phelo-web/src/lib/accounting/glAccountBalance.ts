import type { TrialBalanceReport } from '@/types/accounting';

export function buildAccountBalanceMap(report: TrialBalanceReport | undefined): Map<string, number> {
  const balances = new Map<string, number>();
  if (!report) return balances;
  for (const entries of Object.values(report.accounts)) {
    for (const entry of entries) {
      const debit = Number(entry.debitBalance);
      const credit = Number(entry.creditBalance);
      const signed = entry.account.normalBalance === 'CREDIT' ? credit - debit : debit - credit;
      balances.set(entry.account.id, signed);
    }
  }
  return balances;
}

export function formatAccountBalance(value: number | undefined, currency: string): string {
  if (value === undefined) return '—';
  const formatted = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `(${currency} ${formatted})` : `${currency} ${formatted}`;
}
