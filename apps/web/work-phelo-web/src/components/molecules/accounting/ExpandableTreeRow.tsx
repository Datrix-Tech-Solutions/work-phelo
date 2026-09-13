'use client';

import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TreeRowHoverOverlay } from '@/components/atoms/TreeRowHoverOverlay';
import { getSelectedRowTint } from '@/lib/accounting/treeRowColor';

interface ExpandableTreeRowProps {
  open: boolean;
  onToggle: () => void;
  onSelect: () => void;
  isSelected: boolean;
  color: string;
  code: string;
  label: string;
  count?: number;
  size?: 'sm' | 'md';
}

/** A tree row that expands/collapses via its chevron but scopes the detail panel via the
 *  rest of the row. The two hit zones are independent: the chevron never changes the panel,
 *  and the label zone never leaves the row's expanded state untouched. */
export function ExpandableTreeRow({
  open,
  onToggle,
  onSelect,
  isSelected,
  color,
  code,
  label,
  count,
  size = 'sm',
}: ExpandableTreeRowProps) {
  const FolderIcon = open ? FolderOpen : Folder;
  return (
    <div
      className={cn(
        'relative group/row flex items-center rounded-lg',
        isSelected && getSelectedRowTint(color),
      )}
    >
      <TreeRowHoverOverlay />
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? 'Collapse' : 'Expand'}
        className="relative shrink-0 flex items-center justify-center w-8 h-8 text-gray-400"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'relative flex-1 flex items-center gap-2 py-2 pr-3 rounded-lg text-left text-sm text-gray-600',
          size === 'md' && 'py-3 font-medium text-gray-700',
        )}
      >
        <FolderIcon className={cn(size === 'md' ? 'w-5 h-5' : 'w-4 h-4', 'shrink-0', color)} />
        <span className="text-xs font-semibold text-gray-400 shrink-0">{code}</span>
        <span className="truncate">{label}</span>
        {count !== undefined && <span className="ml-auto text-xs text-gray-400">{count}</span>}
      </button>
    </div>
  );
}
