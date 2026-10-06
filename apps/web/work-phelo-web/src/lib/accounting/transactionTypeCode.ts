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
