'use client';

import { ChevronDown } from 'lucide-react';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { DatePicker } from '@/components/atoms/DatePicker';
import { inputClass } from '@/lib/utils';
import { formatMoney } from '@/lib/formatMoney';

export interface ClientProductDetail {
  expectedRevenue: string;
  expectedCloseDate: string;
}

export const EMPTY_PRODUCT_DETAIL: ClientProductDetail = {
  expectedRevenue: '',
  expectedCloseDate: '',
};

interface Props {
  name: string;
  value: ClientProductDetail;
  onChange: (value: ClientProductDetail) => void;
}

export function ClientProductDetails({ name, value, onChange }: Props) {
  function set<K extends keyof ClientProductDetail>(key: K, v: ClientProductDetail[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5">
      <p className="truncate text-xs font-bold text-gray-900" title={name}>
        {name}
      </p>
      <div className="grid grid-cols-2 items-end gap-2">
        <CurrencyInput
          label="Expected Revenue"
          currency="GHS"
          lockCurrency
          value={value.expectedRevenue}
          onValueChange={(v) => set('expectedRevenue', v)}
        />
        <DatePicker
          label="Close Date"
          size="sm"
          value={value.expectedCloseDate}
          onChange={(v) => set('expectedCloseDate', v)}
        />
      </div>
    </div>
  );
}

function TotalCell({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
      <label className="text-sm font-bold text-gray-900">{label}</label>
      <input
        type="text"
        readOnly
        tabIndex={-1}
        value={formatMoney(amount)}
        className={inputClass()}
      />
    </div>
  );
}

/** Sums across every selected product, laid out in the same columns as the product rows. */
export function ClientProductTotals({
  details,
  expanded,
  onToggle,
  inline = false,
}: {
  details: ClientProductDetail[];
  expanded: boolean;
  onToggle: () => void;
  /** Shows the totals as plain text next to the label instead of read-only fields. */
  inline?: boolean;
}) {
  const sum = (pick: (d: ClientProductDetail) => number | null) =>
    details.reduce((acc, d) => {
      const n = pick(d);
      return acc + (n != null && Number.isFinite(n) ? n : 0);
    }, 0);

  if (inline) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-900"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`}
          />
          Totals · {details.length} products
          <span className="font-normal text-gray-500">({expanded ? 'hide' : 'show'} products)</span>
        </button>
        <p className="text-xs text-gray-600">
          Expected Revenue:{' '}
          <span className="font-bold text-gray-900">
            {formatMoney(sum((d) => parseFloat(d.expectedRevenue)))}
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex items-center gap-1.5 self-start text-xs font-bold text-gray-900"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`}
        />
        Totals · {details.length} products
        <span className="font-normal text-gray-500">({expanded ? 'hide' : 'show'} products)</span>
      </button>
      <div className="grid grid-cols-2 items-end gap-2">
        <TotalCell label="Expected Revenue" amount={sum((d) => parseFloat(d.expectedRevenue))} />
      </div>
    </div>
  );
}
