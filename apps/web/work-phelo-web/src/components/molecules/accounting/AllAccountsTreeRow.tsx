'use client';

import { ChevronsDownUp, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TreeRowHoverOverlay } from '@/components/atoms/TreeRowHoverOverlay';

interface AllAccountsTreeRowProps {
  isSelected: boolean;
  onSelect: () => void;

  onCollapseAll?: () => void;
}

export function AllAccountsTreeRow({
  isSelected,
  onSelect,
  onCollapseAll,
}: AllAccountsTreeRowProps) {
  return (
    <div
      className={cn('relative group/row flex items-center rounded-lg', isSelected && 'bg-gray-100')}
    >
      <TreeRowHoverOverlay />
      <button
        type="button"
        onClick={onSelect}
        className="relative flex-1 flex items-center gap-2 px-3 py-3 rounded-lg text-left text-sm font-medium text-gray-700"
      >
        <Layers className="w-5 h-5 shrink-0 text-gray-400" />
        <span>All Accounts</span>
      </button>
      {onCollapseAll && (
        <button
          type="button"
          onClick={onCollapseAll}
          title="Collapse all"
          aria-label="Collapse all"
          className="relative shrink-0 flex items-center justify-center w-8 h-8 text-gray-400 hover:text-(--text-hover-muted,var(--color-gray-900)) hover:[&>svg]:stroke-[4.5] transition-colors"
        >
          <ChevronsDownUp className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
