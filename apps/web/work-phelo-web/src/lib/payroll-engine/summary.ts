// GENERATED from packages/payroll-engine/src/summary.ts by scripts/sync-payroll-engine.mjs.
// Do not edit this copy. Change the package, then run: npm run sync:payroll-engine

import { ALLOWANCE_TYPES, BASE_LABELS } from './constants';
import type { PayComponent } from './types';

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `GHS 1,234.50`, with a leading minus sign for negatives. */
export function formatAmount(n: number, currency: string): string {
  return `${n < 0 ? '−' : ''}${currency} ${nf.format(Math.abs(n))}`;
}

export function formatNumber(n: number): string {
  return nf.format(n);
}

/** One-line description of how a component is calculated, for the list. */
export function summarize(c: PayComponent, currency: string, all: PayComponent[] = []): string {
  const p = c.params;
  const baseName =
    (c.base === 'component' && all.find((x) => x.id === c.baseComponentId)?.name) ||
    BASE_LABELS[c.base];
  let text: string;
  switch (c.method) {
    case 'fixed':
      text = `${formatAmount(p.amount ?? 0, currency)} fixed`;
      break;
    case 'percent': {
      text = `${p.rate ?? 0}% of ${baseName}`;
      if (p.baseCap != null) text += `, base up to ${formatAmount(p.baseCap, currency)}`;
      if (p.min != null) text += `, min ${formatAmount(p.min, currency)}`;
      if (p.max != null) text += `, max ${formatAmount(p.max, currency)}`;
      break;
    }
    case 'bands':
      text = `${(p.bands ?? []).length} bands on ${baseName} (${p.period === 'annual' ? 'annual' : 'monthly'})`;
      break;
    case 'formula':
      text = p.expr || 'No formula yet';
      break;
    case 'variable':
      if (p.source === 'allowance') {
        const label = ALLOWANCE_TYPES.find((a) => a.value === p.allowanceType)?.label;
        text = label
          ? `From the employee's ${label.toLowerCase()} allowance`
          : 'From employee allowances';
      } else if (p.source === 'loans') {
        text = "From the employee's loans and deductions";
      } else {
        text = 'Entered each payroll run';
      }
      break;
  }
  if (c.kind === 'deduction' && c.tags.deductedFromPay === false) text += ', not deducted from pay';
  if (c.kind === 'credit') {
    const target = all.find((x) => x.id === c.reduces)?.name;
    text += target ? `, reduces ${target}` : ', no deduction chosen';
  }
  return text;
}
