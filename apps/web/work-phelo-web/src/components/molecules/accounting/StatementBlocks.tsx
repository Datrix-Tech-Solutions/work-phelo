'use client';

import { Fragment } from 'react';
import {
  formatCents,
  formatPercent,
  variancePercent,
  type StatementClassification,
} from '@/lib/accounting/profitAndLoss';
import type { ExtraRow } from '@/lib/accounting/statementExport';
import { cn } from '@/lib/utils';

export const singleGrid = 'grid grid-cols-[minmax(0,1fr)_180px] gap-4 px-6';
/** Narrower single-column grid for a statement laid out in two half-width columns. */
export const halfGrid = 'grid grid-cols-[minmax(0,1fr)_130px] gap-3 px-4';
export const compareGrid = 'grid grid-cols-[minmax(0,1fr)_140px_140px_140px_90px] gap-4 px-6';

/** The numeric cells of a row: one column normally, four when comparing. */
export function Figures({
  current,
  previous,
  compare,
  className,
}: {
  current: number;
  previous: number;
  compare: boolean;
  className?: string;
}) {
  const cell = cn('text-right tabular-nums', className);
  if (!compare) return <span className={cell}>{formatCents(current)}</span>;
  return (
    <>
      <span className={cell}>{formatCents(current)}</span>
      <span className={cell}>{formatCents(previous)}</span>
      <span className={cell}>{formatCents(current - previous)}</span>
      <span className={cell}>{formatPercent(variancePercent(current, previous))}</span>
    </>
  );
}

const headingClass = 'text-right text-xs font-semibold tracking-wider text-gray-500 uppercase';

/** One statement section: classification → group → account rows with subtotals and a total. */
export function SectionBlock({
  title,
  classifications,
  totalLabel,
  totals,
  extraRows = [],
  compare,
  currency,
  columnLabels,
  emptyText,
  emphasizeTotal = false,
  compact = false,
  fill = false,
}: {
  title: string;
  classifications: StatementClassification[];
  totalLabel: string;
  totals: { current: number; previous: number };
  /** Plain lines shown after the classifications, before the section total. */
  extraRows?: ExtraRow[];
  compare: boolean;
  currency: string;
  /** Headings for the two amount columns when comparing. */
  columnLabels: { current: string; previous: string };
  emptyText: string;
  /** Gives the section total the same weight as a statement's closing line. */
  emphasizeTotal?: boolean;
  /** Uses the narrower grid, for a section shown in a half-width column. */
  compact?: boolean;
  /** Stretches to fill its column and pins the total to the bottom, so totals in
   *  neighbouring columns line up. */
  fill?: boolean;
}) {
  const grid = compare ? compareGrid : compact ? halfGrid : singleGrid;
  return (
    <div className={cn('flex flex-col', fill && 'flex-1')}>
      <div className={cn(grid, 'py-2 bg-gray-50 border-y border-gray-200')}>
        <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
          {title}
        </span>
        {compare ? (
          <>
            <span className={headingClass}>{columnLabels.current}</span>
            <span className={headingClass}>{columnLabels.previous}</span>
            <span className={headingClass}>Variance</span>
            <span className={headingClass}>Var %</span>
          </>
        ) : (
          <span className={headingClass}>{currency}</span>
        )}
      </div>

      {classifications.length === 0 && extraRows.length === 0 && (
        <p className="px-6 py-4 text-sm text-gray-400">{emptyText}</p>
      )}

      {classifications.map((classification) => (
        <Fragment key={classification.key}>
          <div className={cn(grid, 'pt-4 pb-1')}>
            <span className="col-span-full text-sm font-semibold text-gray-900">
              {classification.name}
            </span>
          </div>

          {classification.groups.map((group) => (
            <Fragment key={group.key}>
              <div className={cn(grid, 'pt-2')}>
                <span className="col-span-full pl-4 text-sm font-medium text-gray-700">
                  {group.name}
                </span>
              </div>
              {group.lines.map((line) => (
                <div key={line.account.id} className={cn(grid, 'py-1 hover:bg-gray-50')}>
                  <span className="pl-9 text-sm text-gray-700">
                    <span className="mr-3 text-gray-400 tabular-nums">{line.account.code}</span>
                    {line.account.name}
                  </span>
                  <Figures
                    current={line.current}
                    previous={line.previous}
                    compare={compare}
                    className="text-sm text-gray-900"
                  />
                </div>
              ))}
              <div className={cn(grid, 'py-1')}>
                <span className="pl-4 text-sm text-gray-500">Total {group.name}</span>
                <Figures
                  current={group.current}
                  previous={group.previous}
                  compare={compare}
                  className="text-sm text-gray-700"
                />
              </div>
            </Fragment>
          ))}

          <div className={cn(grid, 'py-1.5 border-t border-gray-200 mt-1')}>
            <span className="text-sm font-semibold text-gray-800">Total {classification.name}</span>
            <Figures
              current={classification.current}
              previous={classification.previous}
              compare={compare}
              className="text-sm font-semibold"
            />
          </div>
        </Fragment>
      ))}

      {extraRows.map((row) => (
        <div key={row.label} className={cn(grid, 'pt-4 pb-1')}>
          <span className="text-sm font-semibold text-gray-900">{row.label}</span>
          <Figures
            current={row.current}
            previous={row.previous}
            compare={compare}
            className="text-sm font-semibold text-gray-900"
          />
        </div>
      ))}

      <div className={cn(fill && 'mt-auto pt-6')}>
        <div
          className={cn(
            grid,
            emphasizeTotal
              ? 'py-4 border-y-2 border-gray-900'
              : 'py-3 border-y-2 border-gray-300 bg-gray-50',
            !fill && (emphasizeTotal ? 'mt-6' : 'mt-2'),
          )}
        >
          <span className="text-sm font-bold text-gray-900 uppercase">{totalLabel}</span>
          <Figures
            current={totals.current}
            previous={totals.previous}
            compare={compare}
            className={cn('font-bold text-gray-900', emphasizeTotal ? 'text-base' : 'text-sm')}
          />
        </div>
      </div>
    </div>
  );
}

/** The bold closing line of a statement (net profit, total liabilities and equity). */
export function ClosingRow({
  label,
  current,
  previous,
  compare,
  tone,
  compact = false,
  alignBottom = false,
}: {
  label: string;
  current: number;
  previous: number;
  compare: boolean;
  tone: 'positive' | 'negative' | 'neutral';
  compact?: boolean;
  /** Pins the row to the bottom of a stretched column so it lines up with its neighbour. */
  alignBottom?: boolean;
}) {
  return (
    <div className={cn(alignBottom ? 'mt-auto pt-6' : 'mt-6')}>
      <div
        className={cn(
          compare ? compareGrid : compact ? halfGrid : singleGrid,
          'py-4 border-y-2 border-gray-900',
          tone === 'positive' && 'text-emerald-700',
          tone === 'negative' && 'text-red-700',
          tone === 'neutral' && 'text-gray-900',
        )}
      >
        <span className="text-sm font-bold uppercase">{label}</span>
        <Figures
          current={current}
          previous={previous}
          compare={compare}
          className="text-base font-bold"
        />
      </div>
    </div>
  );
}

export function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </span>
  );
}
