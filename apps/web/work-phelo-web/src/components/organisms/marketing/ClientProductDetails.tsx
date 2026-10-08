'use client';

import { ChevronDown } from 'lucide-react';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Input } from '@/components/atoms/Input';
import { inputClass } from '@/lib/utils';
import { formatMoney } from '@/lib/formatMoney';

export interface ClientProductDetail {
  expectedRevenue: string;
  commissionRate: string;
  expectedCloseDate: string;
}

export const EMPTY_PRODUCT_DETAIL: ClientProductDetail = {
  expectedRevenue: '',
  commissionRate: '',
  expectedCloseDate: '',
};

/** Commission is the rate's share of the expected revenue. Achieved revenue is never entered here:
 * it comes from the billing transactions once the client is billable. */
export function commissionAmount(detail: ClientProductDetail): number | null {
  const rate = parseFloat(detail.commissionRate);
  const expected = parseFloat(detail.expectedRevenue);
  if (!Number.isFinite(rate) || !Number.isFinite(expected)) return null;
  return Math.round(((expected * rate) / 100 + Number.EPSILON) * 100) / 100;
}

interface Props {
  name: string;
  value: ClientProductDetail;
  onChange: (value: ClientProductDetail) => void;
}

export function ClientProductDetails({ name, value, onChange }: Props) {
  function set<K extends keyof ClientProductDetail>(key: K, v: ClientProductDetail[K]) {
    onChange({ ...value, [key]: v });
  }
  const commission = commissionAmount(value);

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5">
      <p className="truncate text-xs font-bold text-gray-900" title={name}>
        {name}
      </p>
      <div className="grid grid-cols-4 items-end gap-2">
        <CurrencyInput
          label="Expected Revenue"
          currency="GHS"
          lockCurrency
          value={value.expectedRevenue}
          onValueChange={(v) => set('expectedRevenue', v)}
        />
        <Input
          label="Commission %"
          type="number"
          min={0}
          max={100}
          step="any"
          placeholder="0"
          value={value.commissionRate}
          onChange={(e) => set('commissionRate', e.target.value)}
          rightElement={<span className="text-sm text-gray-400">%</span>}
        />
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Expected Commission</label>
          <input
            type="text"
            readOnly
            tabIndex={-1}
            value={commission === null ? '' : formatMoney(commission)}
            placeholder="—"
            className={inputClass()}
          />
        </div>
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
}: {
  details: ClientProductDetail[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const sum = (pick: (d: ClientProductDetail) => number | null) =>
    details.reduce((acc, d) => {
      const n = pick(d);
      return acc + (n != null && Number.isFinite(n) ? n : 0);
    }, 0);

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
      <div className="grid grid-cols-4 items-end gap-2">
        <TotalCell label="Expected Revenue" amount={sum((d) => parseFloat(d.expectedRevenue))} />
        <div />
        <TotalCell label="Expected Commission" amount={sum(commissionAmount)} />
      </div>
    </div>
  );
}
