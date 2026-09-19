'use client';

import { Fragment } from 'react';
import { formatCents } from '@/lib/accounting/profitAndLoss';
import type { TrialCategory } from '@/lib/accounting/trialBalance';
import { cn } from '@/lib/utils';

const trialGrid = 'grid grid-cols-[minmax(0,1fr)_150px_150px] gap-4 px-6';
const headingClass = 'text-right text-xs font-semibold tracking-wider text-gray-500 uppercase';

/** A trial balance amount: an em dash for nothing, so the column reads as debit OR credit. */
function Amount({ cents, className }: { cents: number; className?: string }) {
  return (
    <span className={cn('text-right tabular-nums', cents === 0 && 'text-gray-300', className)}>
      {cents === 0 ? '—' : formatCents(cents)}
    </span>
  );
}

export function TrialTableHead({ currency }: { currency: string }) {
  return (
    <div className={cn(trialGrid, 'py-2 bg-gray-50 border-y border-gray-200')}>
      <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">Account</span>
      <span className={headingClass}>Debit{currency && ` (${currency})`}</span>
      <span className={headingClass}>Credit{currency && ` (${currency})`}</span>
    </div>
  );
}

export function TrialCategoryBlock({ category }: { category: TrialCategory }) {
  return (
    <div className="flex flex-col">
      <div className={cn(trialGrid, 'pt-6 pb-1')}>
        <span className="col-span-full text-sm font-bold tracking-wide text-gray-900 uppercase">
          {category.title}
        </span>
      </div>

      {category.groups.map((group) => (
        <Fragment key={group.key}>
          <div className={cn(trialGrid, 'pt-2')}>
            <span className="col-span-full pl-4 text-sm font-medium text-gray-700">
              {group.name}
            </span>
          </div>
          {group.lines.map((line) => (
            <div key={line.account.id} className={cn(trialGrid, 'py-1 hover:bg-gray-50')}>
              <span className="pl-9 text-sm text-gray-700">
                <span className="mr-3 text-gray-400 tabular-nums">{line.account.code}</span>
                {line.account.name}
              </span>
              <Amount cents={line.debit} className="text-sm text-gray-900" />
              <Amount cents={line.credit} className="text-sm text-gray-900" />
            </div>
          ))}
        </Fragment>
      ))}

      <div className={cn(trialGrid, 'py-1.5 mt-2 border-t border-gray-200')}>
        <span className="text-sm font-semibold text-gray-800">Total {category.title}</span>
        <Amount cents={category.debit} className="text-sm font-semibold text-gray-800" />
        <Amount cents={category.credit} className="text-sm font-semibold text-gray-800" />
      </div>
    </div>
  );
}

/** The closing line: the two column totals, which must be equal. */
export function TrialTotalRow({ debit, credit }: { debit: number; credit: number }) {
  return (
    <div className={cn(trialGrid, 'mt-6 py-4 border-y-2 border-gray-900 text-gray-900')}>
      <span className="text-sm font-bold uppercase">Total</span>
      <span className="text-right text-base font-bold tabular-nums">{formatCents(debit)}</span>
      <span className="text-right text-base font-bold tabular-nums">{formatCents(credit)}</span>
    </div>
  );
}
