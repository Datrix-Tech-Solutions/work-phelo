'use client';

import { HandHelping, Package, Trash2 } from 'lucide-react';
import { Input } from '@/components/atoms/Input';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';

/** One item on a bill or invoice — like a line on a direct payment, plus a cost centre. */
export type DocLineRow = {
  key: string;
  glAccountId: string;
  /** Goods: work the amount out from quantity × unit price. Service: a straight amount. */
  useQtyPrice: boolean;
  quantity: string;
  unitPrice: string;
  amount: string;
  description: string;
  costCentreId: string;
};

let rowCounter = 0;

export function newDocLineRow(defaults: {
  glAccountId?: string;
  useQtyPrice: boolean;
}): DocLineRow {
  return {
    key: `doc-line-${++rowCounter}`,
    glAccountId: defaults.glAccountId ?? '',
    useQtyPrice: defaults.useQtyPrice,
    quantity: '',
    unitPrice: '',
    amount: '',
    description: '',
    costCentreId: '',
  };
}

/** quantity × unit price rounded half-up to 2 decimals (EPSILON guards float artefacts). */
function product(quantity: string, unitPrice: string) {
  const value = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function docLineAmount(row: DocLineRow): number {
  return row.useQtyPrice ? product(row.quantity, row.unitPrice) : Number(row.amount) || 0;
}

/** The item cards of a bill or invoice (the form adds the Add Line button and the total). Each one posts to its own account — any account inside the
 *  transaction type's scope, or the one account the rule fixes — and can carry its own cost
 *  centre. The icon on a row switches it between goods (quantity × unit price) and a service (a
 *  straight amount). */
export function DocumentLines({
  rows,
  onChange,
  accountLabel,
  accountOptions,
  fixedAccountLabel,
  isLoadingAccounts,
  costCentreOptions,
  showCostCentre,
}: {
  rows: DocLineRow[];
  onChange: (rows: DocLineRow[]) => void;
  accountLabel: string;
  /** The accounts an item may post to, when the rule scopes its main line. */
  accountOptions: SearchSelectOption[];
  /** Set when the rule fixes one account: there is nothing to pick, and no reason to add items. */
  fixedAccountLabel: string | null;
  isLoadingAccounts: boolean;
  costCentreOptions: SearchSelectOption[];
  /** Whether a row's account is one a department can be tagged on (an expense or revenue one). */
  showCostCentre: (row: DocLineRow) => boolean;
}) {
  const update = (key: string, patch: Partial<DocLineRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <>
      {rows.map((row) => {
        const withCostCentre = showCostCentre(row);
        const accountField = fixedAccountLabel ? (
          <Input label={accountLabel} readOnly value={fixedAccountLabel} />
        ) : (
          <SearchSelect
            label={accountLabel}
            placeholder={
              isLoadingAccounts
                ? 'Loading…'
                : accountOptions.length === 0
                  ? 'No accounts available for this transaction type'
                  : 'Select account…'
            }
            options={accountOptions}
            value={row.glAccountId}
            onChange={(value) => update(row.key, { glAccountId: value })}
          />
        );
        const descriptionField = (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-gray-900">Description</span>
            <input
              type="text"
              value={row.description}
              placeholder="Optional"
              maxLength={500}
              onChange={(e) => update(row.key, { description: e.target.value })}
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-brand"
            />
          </div>
        );
        const costCentreField = withCostCentre ? (
          <SearchSelect
            label="Cost Centre"
            placeholder="Optional"
            options={costCentreOptions}
            value={row.costCentreId}
            onChange={(value) => update(row.key, { costCentreId: value })}
          />
        ) : null;
        const actions = (
          <div className="flex items-center gap-1 pb-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={row.useQtyPrice}
              aria-label={row.useQtyPrice ? 'Goods' : 'Service'}
              title={
                row.useQtyPrice
                  ? 'Goods (quantity × unit price) — click for a service, a straight amount'
                  : 'Service (straight amount) — click for goods, quantity × unit price'
              }
              onClick={() => {
                // Carry the figure across so switching never loses what was typed.
                if (row.useQtyPrice) {
                  update(row.key, {
                    useQtyPrice: false,
                    amount: String(docLineAmount(row) || ''),
                  });
                } else {
                  update(row.key, {
                    useQtyPrice: true,
                    quantity: '1',
                    unitPrice: row.amount,
                  });
                }
              }}
              className={`rounded-md p-1.5 transition-colors ${
                row.useQtyPrice
                  ? 'bg-brand/10 text-brand'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }`}
            >
              {row.useQtyPrice ? <Package size={15} /> : <HandHelping size={15} />}
            </button>
            {rows.length > 1 ? (
              <button
                type="button"
                aria-label="Remove line"
                title="Remove line"
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} />
              </button>
            ) : (
              <span className="w-[27px]" aria-hidden />
            )}
          </div>
        );

        return (
          <div key={row.key} className="rounded-xl border border-gray-200 p-2.5">
            {row.useQtyPrice ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto]">
                  {accountField}
                  <NumberField
                    label="Quantity"
                    placeholder="0"
                    value={Number(row.quantity) || 0}
                    onChange={(value) => update(row.key, { quantity: String(value) })}
                  />
                  <NumberField
                    label="Unit Price"
                    value={Number(row.unitPrice) || 0}
                    onChange={(value) => update(row.key, { unitPrice: String(value) })}
                  />
                  <NumberField
                    label="Amount"
                    value={docLineAmount(row)}
                    onChange={() => {}}
                    disabled
                  />
                  {actions}
                </div>
                <div className={`grid grid-cols-1 gap-2 ${withCostCentre ? 'sm:grid-cols-2' : ''}`}>
                  {descriptionField}
                  {costCentreField}
                </div>
              </div>
            ) : (
              <div
                className={`grid grid-cols-1 items-end gap-2 ${
                  withCostCentre
                    ? 'sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_auto]'
                    : 'sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_auto]'
                }`}
              >
                {accountField}
                <NumberField
                  label="Amount"
                  value={Number(row.amount) || 0}
                  onChange={(value) => update(row.key, { amount: String(value) })}
                />
                {descriptionField}
                {costCentreField}
                {actions}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
