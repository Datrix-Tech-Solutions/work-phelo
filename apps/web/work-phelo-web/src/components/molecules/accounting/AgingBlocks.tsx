'use client';

import { Fragment } from 'react';
import { Icons } from '@/components/atoms/icons';
import {
  AGING_BUCKET_KEYS,
  AGING_BUCKET_LABELS,
  bucketShare,
  type AgingCurrencyBlock,
} from '@/lib/accounting/aging';
import { formatCents, formatDate, formatPercent, toCents } from '@/lib/accounting/profitAndLoss';
import { cn } from '@/lib/utils';

const agingGrid = 'grid grid-cols-[minmax(0,1fr)_repeat(5,112px)_128px] gap-4 px-6';
const headingClass = 'text-right text-xs font-semibold tracking-wider text-gray-500 uppercase';

/** Key identifying one expandable party row; the same party can appear once per currency. */
export const agingRowKey = (currency: string, partyId: string) => `${currency}|${partyId}`;

const isoDate = (value: string) => formatDate(value.slice(0, 10));

/** An aging amount: an em dash for nothing, red when it is old debt (over 90 days). */
function Cell({
  cents,
  overdue = false,
  className,
}: {
  cents: number;
  overdue?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'text-right tabular-nums',
        cents === 0 && 'text-gray-300',
        overdue && cents > 0 && 'font-medium text-red-700',
        className,
      )}
    >
      {cents === 0 ? '—' : formatCents(cents)}
    </span>
  );
}

/**
 * One block per currency: a row per customer or vendor across the aging buckets, which expands
 * into the open documents behind it (each amount sits in the bucket it falls in).
 */
export function AgingBlocks({
  blocks,
  partyLabel,
  expanded,
  onToggle,
}: {
  blocks: AgingCurrencyBlock[];
  partyLabel: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-8 pb-6 min-w-[1000px]">
      {blocks.map((block) => (
        <div key={block.currency} className="flex flex-col">
          <div className={cn(agingGrid, 'py-2 bg-gray-50 border-y border-gray-200')}>
            <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
              {partyLabel} · {block.currency}
            </span>
            {AGING_BUCKET_KEYS.map((key) => (
              <span key={key} className={headingClass}>
                {AGING_BUCKET_LABELS[key]}
              </span>
            ))}
            <span className={headingClass}>Total</span>
          </div>

          {block.parties.map((row) => {
            const key = agingRowKey(block.currency, row.id);
            const isOpen = expanded.has(key);
            return (
              <Fragment key={key}>
                <button
                  type="button"
                  onClick={() => onToggle(key)}
                  aria-expanded={isOpen}
                  className={cn(agingGrid, 'w-full items-center py-2 text-left hover:bg-gray-50')}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icons.ChevronRight
                      className={cn(
                        'w-4 h-4 shrink-0 text-gray-400 transition-transform',
                        isOpen && 'rotate-90',
                      )}
                    />
                    <span className="truncate text-sm text-gray-900">
                      <span className="mr-2 text-gray-400 tabular-nums">{row.code}</span>
                      {row.name}
                    </span>
                  </span>
                  {AGING_BUCKET_KEYS.map((bucket) => (
                    <Cell
                      key={bucket}
                      cents={row.buckets[bucket]}
                      overdue={bucket === 'OVER_90'}
                      className="text-sm text-gray-900"
                    />
                  ))}
                  <Cell cents={row.total} className="text-sm font-semibold text-gray-900" />
                </button>

                {isOpen &&
                  row.documents.map((document) => {
                    const outstanding = toCents(document.outstandingAmount);
                    return (
                      <div key={document.id} className={cn(agingGrid, 'py-1 bg-gray-50/60')}>
                        <span className="pl-9 text-xs text-gray-500">
                          <span className="font-medium text-gray-800">
                            {document.documentNumber}
                          </span>
                          {` · Dated ${isoDate(document.documentDate)} · `}
                          {document.dueDate ? `Due ${isoDate(document.dueDate)}` : 'No due date'}
                          {document.daysOverdue > 0 && ` · ${document.daysOverdue} days overdue`}
                        </span>
                        {AGING_BUCKET_KEYS.map((bucket) => (
                          <span
                            key={bucket}
                            className={cn(
                              'text-right text-xs tabular-nums text-gray-700',
                              bucket === 'OVER_90' && 'text-red-700',
                            )}
                          >
                            {document.bucket === bucket ? formatCents(outstanding) : ''}
                          </span>
                        ))}
                        <span className="text-right text-xs tabular-nums text-gray-800">
                          {formatCents(outstanding)}
                        </span>
                      </div>
                    );
                  })}
              </Fragment>
            );
          })}

          <div className={cn(agingGrid, 'mt-2 py-3 border-y-2 border-gray-900')}>
            <span className="text-sm font-bold text-gray-900 uppercase">
              Total {block.currency}
            </span>
            {AGING_BUCKET_KEYS.map((bucket) => (
              <Cell
                key={bucket}
                cents={block.totals.buckets[bucket]}
                overdue={bucket === 'OVER_90'}
                className="text-sm font-bold text-gray-900"
              />
            ))}
            <Cell cents={block.totals.total} className="text-sm font-bold text-gray-900" />
          </div>
          <div className={cn(agingGrid, 'py-1.5')}>
            <span className="text-xs text-gray-500">% of total</span>
            {AGING_BUCKET_KEYS.map((bucket) => (
              <span key={bucket} className="text-right text-xs tabular-nums text-gray-500">
                {formatPercent(bucketShare(block.totals.buckets[bucket], block.totals.total))}
              </span>
            ))}
            <span className="text-right text-xs tabular-nums text-gray-500">
              {block.totals.total === 0 ? '—' : '100.0%'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
