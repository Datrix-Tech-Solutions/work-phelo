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
  /** Skip the outer card background/border/shadow — use when already nested inside another card. */
  bare?: boolean;
}

export function DataList<T extends { id: string | number }>({
  columns,
  data,
  isLoading,
  emptyMessage = 'No items found',
  rowActions,
  onRowClick,
  bare,
}: DataListProps<T>) {
  const gridCols = [...columns.map((c) => c.width ?? '1fr'), ...(rowActions ? ['44px'] : [])].join(
    ' ',
  );

  return (
    <div className={bare ? 'overflow-hidden' : cardClass('overflow-hidden')}>
      <div className="overflow-x-auto">
        <div className="min-w-max">
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
            data.map((row) => (
              <div
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'relative group/row border-b border-gray-100 last:border-b-0',
                  onRowClick && 'cursor-pointer',
                )}
              >
                <div
                  className={cardClass(
                    'absolute inset-y-0.5 left-1 right-1 rounded-lg bg-(--table-header-bg,var(--color-gray-200)) opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 pointer-events-none',
                    'glass',
                  )}
                />
                <div
                  className="relative grid px-4 py-2 items-center text-sm text-gray-800"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  {columns.map((col) => (
                    <div key={col.key} className={col.className}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </div>
                  ))}

                  {rowActions &&
                    (() => {
                      const actions = rowActions(row);
                      if (actions.length === 0) return null;
                      if (actions.length === 1) {
                        const action = actions[0];
                        return (
                          <div className="flex justify-center">
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
                        <div className="flex justify-end w-4">
                          <ThreeDotMenu actions={actions} />
                        </div>
                      );
                    })()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
