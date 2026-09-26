import type { JournalSource, JournalSourceCategory } from '@/types/accounting';

export const JOURNAL_SOURCE_LABELS: Record<JournalSourceCategory, string> = {
  RECEIVABLE: 'Receivable',
  PAYABLE: 'Payable',
  CASH_AND_BANK: 'Cash & Bank',
  INTEGRATION: 'Integration',
  MANUAL: 'Manual',
};

export const JOURNAL_SOURCE_VARIANT: Record<
  JournalSourceCategory,
  'info' | 'warning' | 'neutral' | 'success'
> = {
  RECEIVABLE: 'info',
  PAYABLE: 'warning',
  CASH_AND_BANK: 'success',
  INTEGRATION: 'neutral',
  MANUAL: 'neutral',
};

/** "Invoice INV26-00001" — the kind of transaction and its own number. */
export function describeJournalSource(source: JournalSource): string {
  return source.number ? `${source.kind} ${source.number}` : source.kind;
}
