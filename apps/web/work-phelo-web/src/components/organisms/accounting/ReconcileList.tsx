'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { cardClass, cn, inputClass } from '@/lib/utils';

export interface ReconcileItem {
  id: string;
  /** ISO date. */
  date: string;
  /** Shown under the date, e.g. the journal ID. */
  reference: string;
  description: string;
  currency: string;
  /** Money in is shown plain, money out in brackets. */
  debit: number;
  credit: number;
}

function formatMoney(value: number, currency: string) {
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Amount({ item }: { item: ReconcileItem }) {
  if (item.credit && !item.debit) {
    return <span className="text-red-600">({formatMoney(item.credit, item.currency)})</span>;
  }
  return <span>{formatMoney(item.debit - item.credit, item.currency)}</span>;
}

interface Props {
  title: string;
  items: ReconcileItem[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  isLoading?: boolean;
  emptyMessage: string;
}

/** One side of the reconciliation: a tickable list of ledger entries or bank statement lines. */
export function ReconcileList({
  title,
  items,
  selectedIds,
  onSelectionChange,
  isLoading,
  emptyMessage,
}: Props) {
  const [search, setSearch] = useState('');
  // Ticked rows the user has taken out of view with Remove reconciled.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (removedIds.has(item.id)) return false;
      if (!term) return true;
      const amount = (item.debit || item.credit).toFixed(2);
      return [
        item.description,
        item.reference,
        amount,
        new Date(item.date).toLocaleDateString('en-GB'),
      ]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [items, removedIds, search]);

  const ticked = visible.filter((item) => selectedIds.has(item.id));
  const allSelected = visible.length > 0 && ticked.length === visible.length;

  const removeReconciled = () => {
    setRemovedIds(new Set([...removedIds, ...ticked.map((item) => item.id)]));
    const next = new Set(selectedIds);
    ticked.forEach((item) => next.delete(item.id));
    onSelectionChange(next);
  };

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  return (
    <div className={cardClass('flex flex-col min-w-0')}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <input
          type="checkbox"
          aria-label={`Select all ${title}`}
          checked={allSelected}
          disabled={items.length === 0}
          onChange={() =>
            onSelectionChange(allSelected ? new Set() : new Set(items.map((i) => i.id)))
          }
          className="w-4 h-4 accent-orange-500"
        />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <span className="ml-auto text-xs text-gray-400">
          {ticked.length} of {visible.length} selected
        </span>
      </div>

      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100">
        <div className="relative flex-1 min-w-0">
          <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass(undefined, 'pl-9 pr-4 py-1.5')}
          />
        </div>
        {removedIds.size > 0 && (
          <button
            type="button"
            onClick={() => setRemovedIds(new Set())}
            className="shrink-0 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            Show {removedIds.size} removed
          </button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={removeReconciled}
          disabled={ticked.length === 0}
        >
          Remove reconciled
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 text-sm text-gray-400">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="flex items-center justify-center h-32 px-4 text-center text-sm text-gray-400">
          {items.length === 0 ? emptyMessage : 'No transactions to show'}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visible.map((item) => (
            <li key={item.id}>
              <label
                className={cn(
                  'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors',
                  selectedIds.has(item.id) && 'bg-gray-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-orange-500"
                />
                <div className="w-24 shrink-0">
                  <p className="text-sm text-gray-900">
                    {new Date(item.date).toLocaleDateString('en-GB')}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{item.reference}</p>
                </div>
                <p className="flex-1 min-w-0 text-sm text-gray-700 break-words">
                  {item.description}
                </p>
                <p className="shrink-0 text-sm font-medium text-gray-900 text-right">
                  <Amount item={item} />
                </p>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
