const FILLER_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'the',
  'to',
  'with',
]);

// Front-end suggestion only: first three letters of each meaningful word, joined by "-".
// "Payment of Supplier Invoice" -> "PAY-SUP-INV". The user can freely edit the result.
export function suggestTransactionTypeCode(name: string): string {
  const words = name
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const meaningful = words.filter((w) => !FILLER_WORDS.has(w.toLowerCase()));
  return (meaningful.length > 0 ? meaningful : words).map((w) => w.slice(0, 3)).join('-');
}

/** The Transaction Type a direct cashbook entry was made under, read back from its number
 *  (<code><YY>-<00000>, e.g. RCPT26-00001). Null for an entry without a number (older rows). */
export function transactionTypeCodeFromNumber(transactionNumber: string | null): string | null {
  const match = transactionNumber?.match(/^(.+?)\d{2}-\d{5,}$/);
  return match ? match[1] : null;
}
