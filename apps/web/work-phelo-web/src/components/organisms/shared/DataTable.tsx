'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Pagination } from '@/components/molecules/shared/Pagination';
import { SearchIcon } from 'lucide-react';
import { NoSearchLogo } from '../../atoms/NoSearchLogo';
import { Icons } from '@/components/atoms/icons';

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
}

export interface RowAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface DataTableProps<T extends { id: string | number }> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyImage?: React.ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearch?: (q: string) => void;
  filterOptions?: { value: string; label: string }[];
  onFilter?: (value: string) => void;
  onExport?: () => void;
  actionButton?: { label: string; onClick: () => void };
  rowActions?: (row: T) => RowAction[];
  onRowClick?: (row: T) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function ThreeDotMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setOpenUpward(window.innerHeight - rect.bottom < 120);
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <Icons.EllipsisVertical />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={cn(
              'absolute right-0 z-20 min-w-35 bg-white border border-gray-100 rounded-input shadow-lg py-1 overflow-hidden',
              openUpward ? 'bottom-8' : 'top-8',
            )}
          >
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  action.onClick();
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors',
                  action.danger ? 'text-red-600' : 'text-gray-700',
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  isLoading,
  emptyMessage = 'No items found',
  emptyImage,
  searchPlaceholder = 'Search...',
  searchValue,
  onSearch,
  filterOptions,
  onFilter,
  onExport,
  actionButton,
  rowActions,
  onRowClick,
  currentPage,
  totalPages,
  onPageChange,
}: DataTableProps<T>) {
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        {onSearch && (
          <div className="relative flex-1 min-w-55 max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue ?? undefined}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
        )}

        {filterOptions && onFilter && (
          <div className="relative">
            <select
              onChange={(e) => onFilter(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2 border border-gray-200 rounded-input text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
            >
              <option value="">Status</option>
              {filterOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Icons.ListFilter className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none h-4 w-4" />
          </div>
        )}

        <div className="flex-1" />

        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-input text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Export
            <Icons.Upload className="w-5 h-5" />
          </button>
        )}

        {actionButton && (
          <button
            onClick={actionButton.onClick}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-input text-sm font-medium hover:bg-brand-hover transition-colors"
          >
            {actionButton.label}
            <Icons.Plus />
          </button>
        )}
      </div>

      {/* Table Container - This is the key part */}
      <div className="border border-gray-100 rounded-input overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div
          className="grid text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 px-4 py-3 shrink-0 "
          style={{
            gridTemplateColumns: [
              ...columns.map((c) => c.width ?? '1fr'),
              ...(rowActions ? ['auto'] : []),
            ].join(' '),
          }}
        >
          {columns.map((col) => (
            <span key={col.key} className={col.className}>
              {col.label}
            </span>
          ))}
          {rowActions && <span />}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            /* Loading State with spinning widget */
            <div className="h-full flex items-center justify-center ">
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-8 h-8">
                  <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-brand animate-spin" />
                  <div className="absolute inset-1.5 rounded-full border-3 border-transparent border-b-brand-accent animate-[spin_.6s_linear_infinite_reverse]" />
                </div>
                <p className="text-sm text-gray-500 font-medium">Loading...</p>
              </div>
            </div>
          ) : data.length === 0 ? (
            /* Empty State with logo */
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
              <div className="flex flex-col items-center gap-5 text-center px-6">
                {emptyImage ?? (
                  <div className="w-28 h-28 rounded-3xl flex items-center justify-center">
                    <NoSearchLogo className="w-25 h-25" />
                  </div>
                )}
                <div>
                  <p className="text-base font-medium text-gray-600 mb-1">{emptyMessage}</p>
                  {emptyMessage.toLowerCase().includes('found') && (
                    <p className="text-sm text-gray-400">Try adjusting your search or filters</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Actual Rows */
            data.map((row) => (
              <div
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'grid px-4 py-3.5 items-center text-sm text-gray-700 border-b border-gray-100 last:border-b-0',
                  'hover:bg-gray-50 transition-colors',
                  onRowClick && 'cursor-pointer',
                )}
                style={{
                  gridTemplateColumns: [
                    ...columns.map((c) => c.width ?? '1fr'),
                    ...(rowActions ? ['auto'] : []),
                  ].join(' '),
                }}
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
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="shrink-0">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
