'use client';

export interface PostingPreviewLine {
  key: string;
  /** The account, or a prompt while it hasn't been picked yet. */
  account: string;
  side: 'Debit' | 'Credit';
  amount: number;
  /** What the line is, when that isn't obvious from the account (a tax, a deduction…). */
  note?: string;
}

function fmt(value: number, currency: string) {
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** What the entry will post, as plain read-only text: each account, its side and its amount. The
 *  lines the transaction type's rule fixes (the control account, or the cash account) appear
 *  here beside the ones the user is entering, and it updates as they type. */
export function PostingPreview({
  lines,
  currency,
}: {
  lines: PostingPreviewLine[];
  currency: string;
}) {
  const debits = lines.filter((l) => l.side === 'Debit').reduce((s, l) => s + l.amount, 0);
  const credits = lines.filter((l) => l.side === 'Credit').reduce((s, l) => s + l.amount, 0);
  const balanced = Math.abs(debits - credits) < 0.005;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-900">Posting</span>
        <span className={`text-xs font-medium ${balanced ? 'text-gray-500' : 'text-amber-600'}`}>
          {balanced
            ? 'Debits equal credits'
            : `Debits ${fmt(debits, currency)} · Credits ${fmt(credits, currency)}`}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-1.5 text-sm">
        <span className="text-xs font-medium text-gray-500">Account</span>
        <span className="text-xs font-medium text-gray-500">Side</span>
        <span className="text-right text-xs font-medium text-gray-500">Amount</span>
        {lines.map((line) => (
          <div key={line.key} className="contents">
            <span className="min-w-0 truncate text-gray-900">
              {line.account}
              {line.note && <span className="ml-2 text-xs text-gray-500">{line.note}</span>}
            </span>
            <span className="text-gray-700">{line.side}</span>
            <span className="text-right text-gray-900">{fmt(line.amount, currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
