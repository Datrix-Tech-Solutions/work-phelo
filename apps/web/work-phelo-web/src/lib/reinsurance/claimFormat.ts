/** Shared money/date formatters for the claim detail screens. */

/** Markers written to a recovery receipt's `notes` by its Mode of Payment — there's no
 *  dedicated backend field for this yet, so other screens read it back off the note text
 *  (the Recoveries table's "Offset" tag, the History table's "Mode of Payment" column). Keep
 *  these in sync with `RecordRecoveryReceiptModal`, the only place that writes them. A receipt
 *  with neither marker was recorded "To Broker". */
export const OFFSET_CLAIM_RECEIPT_NOTE = 'Recovery offset against claim';
export const DIRECT_TO_CEDANT_RECEIPT_NOTE = 'Paid directly to cedant';

export function fmt(val: number | string | null | undefined, currency?: string | null) {
  if (val == null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
