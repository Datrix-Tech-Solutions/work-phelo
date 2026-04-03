'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Pagination } from '@/components/molecules/Pagination';

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
  // Empty state
  emptyMessage?: string;
  emptyImage?: React.ReactNode;
  // Toolbar
  searchPlaceholder?: string;
  onSearch?: (q: string) => void;
  filterOptions?: { value: string; label: string }[];
  onFilter?: (value: string) => void;
  onExport?: () => void;
  actionButton?: { label: string; onClick: () => void };
  // Row actions
  rowActions?: (row: T) => RowAction[];
  // Pagination
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function ThreeDotMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 min-w-35 bg-white border border-gray-100 rounded-xl shadow-lg py-1 overflow-hidden">
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
  onSearch,
  filterOptions,
  onFilter,
  onExport,
  actionButton,
  rowActions,
  currentPage,
  totalPages,
  onPageChange,
}: DataTableProps<T>) {
  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        {onSearch && (
          <div className="relative flex-1 min-w-55 max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder={searchPlaceholder}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
        )}

        {/* Filter */}
        {filterOptions && onFilter && (
          <div className="relative">
            <select
              onChange={(e) => onFilter(e.target.value)}
              className="appearance-none pl-8 pr-8 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
            >
              <option value="">Status</option>
              {filterOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
            <svg
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        )}

        <div className="flex-1" />

        {/* Export */}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Export
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
        )}

        {/* Action button */}
        {actionButton && (
          <button
            onClick={actionButton.onClick}
            className="flex items-center gap-2 px-4 py-2 bg-[#0D2244] text-white rounded-xl text-sm font-medium hover:bg-[#162d56] transition-colors"
          >
            {actionButton.label}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        {/* Header */}
        <div
          className="grid text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 px-4 py-3"
          style={{
            gridTemplateColumns: [
              ...columns.map((c) => c.width ?? '1fr'),
              ...(rowActions ? ['48px'] : []),
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

        {/* Rows */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            Loading...
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            {emptyImage ?? (
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-300">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
            )}
            <p className="text-sm text-gray-400">{emptyMessage}</p>
          </div>
        ) : (
          data.map((row, rowIndex) => (
            <div
              key={row.id}
              className={cn(
                'grid px-4 py-3.5 items-center text-sm text-gray-700',
                rowIndex !== data.length - 1 && 'border-b border-gray-100',
                'hover:bg-gray-50 transition-colors',
              )}
              style={{
                gridTemplateColumns: [
                  ...columns.map((c) => c.width ?? '1fr'),
                  ...(rowActions ? ['48px'] : []),
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
              {rowActions && (
                <div className="flex justify-end">
                  <ThreeDotMenu actions={rowActions(row)} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      )}
    </div>
  );
}
