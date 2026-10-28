'use client';

import { useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

interface Props<T> {
  items: T[];
  onChange: (items: T[]) => void;
  /** The left part of a row, e.g. an icon and a name box. */
  renderItem: (item: T, index: number, update: (next: T) => void) => React.ReactNode;
  addLabel: string;
  onAdd: () => void;
  /** Show a handle to drag rows into a new order. */
  reorderable?: boolean;
  /** Shown under the rows, e.g. a validation message. */
  error?: string;
}

/** A column of editable rows, each with a delete button and optionally a drag handle, ending in an add button. */
export function EditableRows<T>({
  items,
  onChange,
  renderItem,
  addLabel,
  onAdd,
  reorderable,
  error,
}: Props<T>) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const drop = (to: number) => {
    if (dragFrom === null || dragFrom === to) return;
    const next = [...items];
    const [moved] = next.splice(dragFrom, 1);
    next.splice(to, 0, moved);
    onChange(next);
    setDragFrom(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-center gap-2"
            onDragOver={reorderable ? (e) => e.preventDefault() : undefined}
            onDrop={reorderable ? () => drop(i) : undefined}
          >
            {reorderable && (
              <span
                draggable
                aria-label="Drag to reorder"
                onDragStart={(e) => {
                  setDragFrom(i);
                  const row = (e.currentTarget as HTMLElement).closest('li');
                  if (row) e.dataTransfer.setDragImage(row, 0, 0);
                }}
                onDragEnd={() => setDragFrom(null)}
                className="shrink-0 cursor-grab text-gray-400 hover:text-gray-700 active:cursor-grabbing"
              >
                <GripVertical className="w-5 h-5" />
              </span>
            )}
            <div className="flex flex-1 min-w-0 items-center gap-2">
              {renderItem(item, i, (next) => onChange(items.map((x, j) => (j === i ? next : x))))}
            </div>
            <button
              type="button"
              aria-label="Remove"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-input border border-gray-300 text-gray-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex w-fit items-center gap-2 rounded-input px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <Plus className="w-4 h-4" />
        {addLabel}
      </button>
    </div>
  );
}
