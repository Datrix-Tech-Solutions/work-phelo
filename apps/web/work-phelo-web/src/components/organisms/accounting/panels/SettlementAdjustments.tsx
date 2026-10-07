'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import type { RuleLineSettlementKind, TaxType, TransactionTypeRule } from '@/types/accounting';

/** One deduction or charge taken when a bill/invoice is settled. A row from the type's rule starts
 *  with its account filled in and is ticked on or off per payment; a one-off row is always on. */
export type AdjustmentRow = {
  key: string;
  /** The rule line it came from, null for a one-off row the user added. */
  ruleLineId: string | null;
  /** A one-off row that takes a tax type (e.g. withholding tax) instead of a typed description. */
  isTaxRow?: boolean;
  kind: RuleLineSettlementKind;
  label: string;
  taxTypeId: string | null;
  /** A tax type's percentage — fixed by the tax, so it can't be edited here. */
  taxRate: number | null;
  glAccountId: string;
  mode: 'PERCENT' | 'FLAT';
  percent: string;
  flat: string;
  description: string;
  enabled: boolean;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** A percentage is worked out from the amount being settled; a flat figure is taken as typed. */
export function adjustmentAmount(row: AdjustmentRow, settleAmount: number): number {
  if (row.mode === 'PERCENT') return round2((settleAmount * (Number(row.percent) || 0)) / 100);
  return round2(Number(row.flat) || 0);
}

let rowCounter = 0;
const nextKey = () => `adj-${++rowCounter}`;

/** The rule's settlement lines as rows. Taxes have a fixed rate and usually apply every time, so
 *  they start ticked (opt out by unticking); a discount or bank charge changes each time, so it
 *  starts unticked until the user ticks it and types a figure. */
export function rowsFromRule(lines: TransactionTypeRule['lines']): AdjustmentRow[] {
  return lines
    .filter((line) => line.settlementKind)
    .map((line) => ({
      key: nextKey(),
      ruleLineId: line.id,
      kind: line.settlementKind!,
      label:
        line.description ||
        line.taxType?.name ||
        (line.settlementKind === 'DEDUCTION' ? 'Deduction' : 'Charge'),
      taxTypeId: line.taxType?.id ?? null,
      taxRate: line.taxType ? line.taxType.rate : null,
      glAccountId: line.account?.id ?? '',
      mode: line.taxType ? ('PERCENT' as const) : ('FLAT' as const),
      percent: line.taxType ? String(line.taxType.rate) : '',
      flat: '',
      description: line.description ?? '',
      enabled: !!line.taxType,
    }));
}

export function newTaxRow(): AdjustmentRow {
  return { ...newOneOffRow('DEDUCTION'), isTaxRow: true };
}

export function newOneOffRow(kind: RuleLineSettlementKind): AdjustmentRow {
  return {
    key: nextKey(),
    ruleLineId: null,
    kind,
    label: '',
    taxTypeId: null,
    taxRate: null,
    glAccountId: '',
    mode: 'FLAT',
    percent: '',
    flat: '',
    description: '',
    enabled: true,
  };
}

/** Deductions and charges taken at settlement. Each row works out its own amount; the parent adds
 *  them up into the cash that actually moves. */
export function SettlementAdjustments({
  rows,
  onChange,
  settleAmount,
  isReceipt,
  currency,
  accountOptions,
  isLoadingAccounts,
  taxTypes,
  settlementDate,
}: {
  rows: AdjustmentRow[];
  onChange: (rows: AdjustmentRow[]) => void;
  settleAmount: number;
  isReceipt: boolean;
  currency: string;
  accountOptions: SearchSelectOption[];
  isLoadingAccounts: boolean;
  /** Tax types that can be taken at settlement (e.g. withholding tax) — in force on the date. */
  taxTypes: TaxType[];
  settlementDate: string;
}) {
  const taxOptions: SearchSelectOption[] = taxTypes
    .filter(
      (t) =>
        t.isActive &&
        (!settlementDate || t.effectiveFrom.slice(0, 10) <= settlementDate) &&
        (!t.effectiveTo || !settlementDate || t.effectiveTo.slice(0, 10) >= settlementDate),
    )
    .map((t) => ({ value: t.id, label: `${t.name} (${t.rate}%)` }));
  // A tax usually posts to the same account every time: the tax type's default on this side.
  const chooseTax = (key: string, taxTypeId: string) => {
    const taxType = taxTypes.find((t) => t.id === taxTypeId);
    const row = rows.find((r) => r.key === key);
    if (!taxType || !row) return;
    update(key, {
      taxTypeId,
      taxRate: taxType.rate,
      mode: 'PERCENT',
      percent: String(taxType.rate),
      description: taxType.name,
      glAccountId:
        row.glAccountId ||
        (isReceipt ? taxType.receivableAccountId : taxType.payableAccountId) ||
        '',
    });
  };
  const verb = isReceipt ? 'received' : 'paid';
  const update = (key: string, patch: Partial<AdjustmentRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const remove = (key: string) => onChange(rows.filter((row) => row.key !== key));

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-gray-900">Deductions and charges</span>
          <span className="text-xs text-gray-500">
            Tick what applies. A deduction reduces the cash {verb}; a charge adds to it.
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => onChange([...rows, newTaxRow()])}>
            Add Tax
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange([...rows, newOneOffRow('DEDUCTION')])}
          >
            Add Deduction
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange([...rows, newOneOffRow('CHARGE')])}
          >
            Add Charge
          </Button>
        </div>
      </div>

      {rows.map((row) => {
        const isOneOff = row.ruleLineId === null;
        const amount = adjustmentAmount(row, settleAmount);
        return (
          <div
            key={row.key}
            className={`grid grid-cols-1 items-end gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_auto_minmax(0,1fr)_minmax(0,1fr)_auto] ${
              row.enabled ? 'border-gray-200' : 'border-dashed border-gray-200 bg-gray-50'
            }`}
          >
            {isOneOff && row.isTaxRow ? (
              <SearchSelect
                label="Tax"
                placeholder={taxOptions.length ? 'Select a tax…' : 'No tax types in force'}
                options={taxOptions}
                value={row.taxTypeId ?? ''}
                onChange={(value) => chooseTax(row.key, value)}
              />
            ) : isOneOff ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500">
                  {row.kind === 'DEDUCTION' ? 'Deduction' : 'Charge'}
                </span>
                <input
                  type="text"
                  value={row.description}
                  placeholder="Description"
                  maxLength={500}
                  onChange={(e) => update(row.key, { description: e.target.value })}
                  className="h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand"
                />
              </div>
            ) : (
              <label className="flex items-center gap-2 pb-2.5 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={() => update(row.key, { enabled: !row.enabled })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="min-w-0">
                  {row.label}
                  {row.taxRate !== null && (
                    <span className="ml-1 text-xs text-gray-500">({row.taxRate}%)</span>
                  )}
                  <span className="block text-xs text-gray-500">
                    {row.kind === 'DEDUCTION' ? 'Deduction' : 'Charge'}
                  </span>
                </span>
              </label>
            )}

            <SearchSelect
              label="Account"
              placeholder={isLoadingAccounts ? 'Loading…' : 'Select account…'}
              options={accountOptions}
              value={row.glAccountId}
              onChange={(value) => update(row.key, { glAccountId: value })}
              disabled={!row.enabled}
            />

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Basis</span>
              <div className="flex h-10 overflow-hidden rounded-lg border border-gray-300 text-xs font-medium">
                {(['PERCENT', 'FLAT'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={!row.enabled}
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
                disabled={!row.enabled || row.taxRate !== null}
              />
            ) : (
              <NumberField
                label="Amount"
                value={Number(row.flat) || 0}
                onChange={(value) => update(row.key, { flat: String(value) })}
                disabled={!row.enabled}
              />
            )}

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Amount</span>
              <span className="flex h-10 items-center text-sm font-semibold text-gray-900">
                {row.enabled
                  ? `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '—'}
              </span>
            </div>

            <div className="flex h-10 items-center">
              {isOneOff ? (
                <button
                  type="button"
                  aria-label="Remove line"
                  title="Remove line"
                  onClick={() => remove(row.key)}
                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              ) : (
                <span className="w-[27px]" aria-hidden />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
