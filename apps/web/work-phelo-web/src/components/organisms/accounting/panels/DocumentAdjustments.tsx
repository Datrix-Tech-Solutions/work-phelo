'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import type { AccountingTradeSide, TaxType } from '@/types/accounting';

export type DocAdjustmentKind = 'TAX' | 'DEDUCTION' | 'CHARGE';

/** One tax, deduction or charge on a bill or invoice. */
export type DocAdjustmentRow = {
  key: string;
  kind: DocAdjustmentKind;
  /** TAX only: the tax type, whose rate sets the amount. */
  taxTypeId: string;
  glAccountId: string;
  /** DEDUCTION and CHARGE: a percentage of the amount, or a flat figure. */
  mode: 'PERCENT' | 'FLAT';
  percent: string;
  flat: string;
  description: string;
};

let rowCounter = 0;

export function newDocAdjustmentRow(kind: DocAdjustmentKind): DocAdjustmentRow {
  return {
    key: `doc-adj-${++rowCounter}`,
    kind,
    taxTypeId: '',
    glAccountId: '',
    mode: 'FLAT',
    percent: '',
    flat: '',
    description: '',
  };
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function docAdjustmentAmount(
  row: DocAdjustmentRow,
  subtotal: number,
  taxTypes: TaxType[],
): number {
  if (row.kind === 'TAX') {
    const rate = taxTypes.find((t) => t.id === row.taxTypeId)?.rate ?? 0;
    return round2((subtotal * rate) / 100);
  }
  if (row.mode === 'PERCENT') return round2((subtotal * (Number(row.percent) || 0)) / 100);
  return round2(Number(row.flat) || 0);
}

/** What the rows add up to: taxes and charges add to what is owed, deductions take away. */
export function summarizeDocAdjustments(
  rows: DocAdjustmentRow[],
  subtotal: number,
  taxTypes: TaxType[],
) {
  const sum = (kind: DocAdjustmentKind) =>
    rows
      .filter((row) => row.kind === kind)
      .reduce((total, row) => total + docAdjustmentAmount(row, subtotal, taxTypes), 0);
  const taxAmount = sum('TAX');
  const chargesTotal = sum('CHARGE');
  const deductionsTotal = sum('DEDUCTION');
  return {
    taxAmount,
    chargesTotal,
    deductionsTotal,
    total: subtotal + taxAmount + chargesTotal - deductionsTotal,
  };
}

function fmt(value: number, currency: string) {
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface AdjustmentContext {
  rows: DocAdjustmentRow[];
  onChange: (rows: DocAdjustmentRow[]) => void;
  subtotal: number;
  currency: string;
  side: AccountingTradeSide;
  documentDate: string;
  taxTypes: TaxType[];
  /** Account a tax type has on this type's rule, from rules made before taxes moved here. */
  ruleTaxAccounts: Map<string, string>;
  accountOptions: SearchSelectOption[];
  isLoadingAccounts: boolean;
}

/** The Add Tax / Add Deduction / Add Charge buttons — the same row of buttons as a direct
 *  payment, with room in front for the form's own "Add Line". */
export function DocumentAdjustmentButtons({
  rows,
  onChange,
  leading,
}: {
  rows: DocAdjustmentRow[];
  onChange: (rows: DocAdjustmentRow[]) => void;
  leading?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {leading}
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...rows, newDocAdjustmentRow('TAX')])}
      >
        Add Tax
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...rows, newDocAdjustmentRow('DEDUCTION')])}
      >
        Add Deduction
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...rows, newDocAdjustmentRow('CHARGE')])}
      >
        Add Charge
      </Button>
    </div>
  );
}

/** What the lines add up to, as at the foot of a direct payment: the amount, what is added and
 *  taken off, and the total. Just the total when there is nothing to add or take off. */
export function DocumentAdjustmentSummary({
  rows,
  subtotal,
  currency,
  taxTypes,
}: {
  rows: DocAdjustmentRow[];
  subtotal: number;
  currency: string;
  taxTypes: TaxType[];
}) {
  const summary = summarizeDocAdjustments(rows, subtotal, taxTypes);
  const hasAdjustments = rows.length > 0;
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-gray-50 px-3 py-2 text-sm">
      {hasAdjustments && (
        <>
          <div className="flex items-center justify-between text-gray-600">
            <span>Amount</span>
            <span>{fmt(subtotal, currency)}</span>
          </div>
          {summary.taxAmount > 0 && (
            <div className="flex items-center justify-between text-gray-600">
              <span>Plus tax</span>
              <span>+ {fmt(summary.taxAmount, currency)}</span>
            </div>
          )}
          {summary.chargesTotal > 0 && (
            <div className="flex items-center justify-between text-gray-600">
              <span>Plus charges</span>
              <span>+ {fmt(summary.chargesTotal, currency)}</span>
            </div>
          )}
          {summary.deductionsTotal > 0 && (
            <div className="flex items-center justify-between text-gray-600">
              <span>Less deductions</span>
              <span>− {fmt(summary.deductionsTotal, currency)}</span>
            </div>
          )}
        </>
      )}
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-700">Total</span>
        <span className="font-semibold text-gray-900">{fmt(summary.total, currency)}</span>
      </div>
    </div>
  );
}

/** The tax, deduction and charge cards. A tax takes its rate from the tax type and its account
 *  from the tax type's default (or the type's rule, for older rules); a deduction or charge is
 *  typed as a percentage or a flat amount. All of them can have their account changed. */
export function DocumentAdjustmentRows({
  rows,
  onChange,
  subtotal,
  currency,
  side,
  documentDate,
  taxTypes,
  ruleTaxAccounts,
  accountOptions,
  isLoadingAccounts,
}: AdjustmentContext) {
  const inForce = taxTypes.filter(
    (t) =>
      t.isActive &&
      (!documentDate || t.effectiveFrom.slice(0, 10) <= documentDate) &&
      (!t.effectiveTo || !documentDate || t.effectiveTo.slice(0, 10) >= documentDate),
  );
  const taxOptions: SearchSelectOption[] = inForce.map((t) => ({
    value: t.id,
    label: `${t.name} (${t.rate}%)`,
  }));
  const defaultAccount = (taxTypeId: string) => {
    const taxType = taxTypes.find((t) => t.id === taxTypeId);
    return (
      ruleTaxAccounts.get(taxTypeId) ??
      (side === 'PAYABLE' ? taxType?.payableAccountId : taxType?.receivableAccountId) ??
      ''
    );
  };

  const update = (key: string, patch: Partial<DocAdjustmentRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const remove = (key: string) => onChange(rows.filter((row) => row.key !== key));

  return (
    <>
      {rows.map((row) => {
        const amount = docAdjustmentAmount(row, subtotal, taxTypes);
        const isTax = row.kind === 'TAX';
        const rate = isTax ? taxTypes.find((t) => t.id === row.taxTypeId)?.rate : undefined;
        return (
          <div
            key={row.key}
            className={`grid grid-cols-1 items-end gap-2 rounded-xl border border-gray-200 p-2.5 ${
              isTax
                ? 'sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,0.6fr)_minmax(0,1fr)_auto]'
                : 'sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_auto_minmax(0,0.9fr)_minmax(0,1fr)_auto]'
            }`}
          >
            {isTax ? (
              <SearchSelect
                label="Tax (adds to the total)"
                placeholder={taxOptions.length ? 'Select a tax…' : 'No tax types in force'}
                options={taxOptions}
                value={row.taxTypeId}
                onChange={(value) =>
                  update(row.key, {
                    taxTypeId: value,
                    // Offer the account this tax usually posts to, unless one was already chosen.
                    glAccountId: row.glAccountId || defaultAccount(value),
                  })
                }
              />
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-900">
                  {row.kind === 'DEDUCTION'
                    ? 'Deduction (reduces the total)'
                    : 'Charge (adds to the total)'}
                </span>
                <input
                  type="text"
                  value={row.description}
                  placeholder={row.kind === 'DEDUCTION' ? 'e.g. Trade discount' : 'e.g. Delivery'}
                  maxLength={500}
                  onChange={(e) => update(row.key, { description: e.target.value })}
                  className="h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand"
                />
              </div>
            )}

            <SearchSelect
              label="Account"
              placeholder={isLoadingAccounts ? 'Loading…' : 'Select account…'}
              options={accountOptions}
              value={row.glAccountId}
              onChange={(value) => update(row.key, { glAccountId: value })}
            />

            {isTax ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-gray-900">Rate</span>
                <span className="flex h-10 items-center text-sm text-gray-900">
                  {rate !== undefined ? `${rate}%` : '—'}
                </span>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-gray-900">Basis</span>
                  <div className="flex h-10 overflow-hidden rounded-lg border border-gray-300 text-xs font-medium">
                    {(['PERCENT', 'FLAT'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => update(row.key, { mode })}
                        className={`px-2.5 transition-colors ${
                          row.mode === mode
                            ? 'bg-brand/10 text-brand'
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {mode === 'PERCENT' ? '%' : 'Flat'}
                      </button>
                    ))}
                  </div>
                </div>
                {row.mode === 'PERCENT' ? (
                  <NumberField
                    label="Rate (%)"
                    value={Number(row.percent) || 0}
                    onChange={(value) => update(row.key, { percent: String(value) })}
                  />
                ) : (
                  <NumberField
                    label="Amount"
                    value={Number(row.flat) || 0}
                    onChange={(value) => update(row.key, { flat: String(value) })}
                  />
                )}
              </>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-900">Amount</span>
              <span className="flex h-10 items-center text-sm font-semibold text-gray-900">
                {fmt(amount, currency)}
              </span>
            </div>

            <div className="flex h-10 items-center">
              <button
                type="button"
                aria-label="Remove line"
                title="Remove line"
                onClick={() => remove(row.key)}
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Taxes, deductions and charges as one block: the cards, the buttons and the total. The
 *  older New Invoice form uses this; the New Transaction form composes the pieces itself so the
 *  buttons sit with its lines. */
export function DocumentAdjustments(props: AdjustmentContext) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
      <span className="text-sm font-bold text-gray-900">Taxes, deductions and charges</span>
      <DocumentAdjustmentRows {...props} />
      <DocumentAdjustmentButtons rows={props.rows} onChange={props.onChange} />
      {props.rows.length > 0 && (
        <DocumentAdjustmentSummary
          rows={props.rows}
          subtotal={props.subtotal}
          currency={props.currency}
          taxTypes={props.taxTypes}
        />
      )}
    </div>
  );
}
