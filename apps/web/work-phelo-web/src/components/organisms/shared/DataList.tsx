'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn, cardClass } from '@/lib/utils';
import { NoSearchLogo } from '@/components/atoms/NoSearchLogo';
import { Icons } from '@/components/atoms/icons';
import type { Column, RowAction } from './DataTable';

export type { Column, RowAction };

function ThreeDotMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, bottom: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setOpenUpward(window.innerHeight - rect.bottom < 200);
      setMenuPos({
        top: rect.bottom + 4,
        bottom: window.innerHeight - rect.top + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((v) => !v);
  };

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="p-1.5 rounded-lg text-gray-400 hover:text-(--text-hover-muted,var(--color-gray-600)) hover:bg-(--surface-hover,var(--color-gray-100)) transition-colors"
      >
        <Icons.EllipsisVertical />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            />
            <div
              style={{
                position: 'fixed',
                right: menuPos.right,
                ...(openUpward ? { bottom: menuPos.bottom } : { top: menuPos.top }),
                minWidth: 140,
              }}
              className="z-50 bg-white border border-gray-100 rounded-input shadow-lg py-1 overflow-hidden"
            >
              {actions.map((action) => (
                <button
                  key={action.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm hover:bg-(--surface-hover-subtle,var(--color-gray-50)) transition-colors',
                    action.danger ? 'text-red-600' : 'text-gray-700',
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

interface DataListProps<T extends { id: string | number }> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  rowActions?: (row: T) => RowAction[];
  onRowClick?: (row: T) => void;
  /** Wrap the list in the outer card background/border/shadow — off by default since every current
   * consumer already nests this inside its own card. */
  card?: boolean;
}

export function DataList<T extends { id: string | number }>({
  columns,
  data,
  isLoading,
  emptyMessage = 'No items found',
  rowActions,
  onRowClick,
  card,
}: DataListProps<T>) {
  return (
    <div className={card ? cardClass('overflow-hidden') : undefined}>
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-brand animate-spin" />
              <div className="absolute inset-1.5 rounded-full border-3 border-transparent border-b-brand-accent animate-[spin_.6s_linear_infinite_reverse]" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Loading...</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
          <NoSearchLogo className="w-20 h-20" />
          <p className="text-sm font-medium text-gray-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="p-1">
          {data.map((row) => (
            <div
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'group/row transition-[transform,box-shadow,background-color] duration-200 mb-2 last:mb-0',
                cardClass(
                  'shadow-[0_10px_20px_-12px_rgba(0,0,0,0.22),0_2px_6px_-2px_rgba(0,0,0,0.12),inset_0_1px_0_0_var(--glass-highlight,rgba(255,255,255,0.65))] hover:-translate-y-1 hover:shadow-[0_16px_28px_-16px_rgba(0,0,0,0.4),0_4px_10px_-2px_rgba(0,0,0,0.2),inset_0_1px_0_0_var(--glass-highlight,rgba(255,255,255,0.65))]',
                ),
                onRowClick && 'cursor-pointer',
              )}
            >
              <div className="flex items-center gap-x-4 px-4 py-4 text-sm text-gray-800">
                {columns.map((col) => {
                  const width = col.width ?? '1fr';
                  const flexible = width.endsWith('fr');
                  return (
                    <div
                      key={col.key}
                      className={cn(flexible ? 'flex-1 min-w-0' : 'shrink-0', col.className)}
                      style={flexible ? undefined : { width }}
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </div>
                  );
                })}

                {rowActions &&
                  (() => {
                    const actions = rowActions(row);
                    if (actions.length === 0) return null;
                    if (actions.length === 1) {
                      const action = actions[0];
                      return (
                        <div className="flex justify-center shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick();
                            }}
                            className={cn(
                              'text-sm font-medium px-2 py-1 rounded-lg transition-colors',
                              action.danger
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-brand hover:bg-brand/5',
                            )}
                          >
                            {action.label}
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="flex justify-end w-4 shrink-0">
                        <ThreeDotMenu actions={actions} />
                      </div>
                    );
                  })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
