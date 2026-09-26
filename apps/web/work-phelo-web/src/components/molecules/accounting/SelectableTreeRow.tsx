'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TreeRowHoverOverlay } from '@/components/atoms/TreeRowHoverOverlay';
import { getSelectedRowTint } from '@/lib/accounting/treeRowColor';

interface SelectableTreeRowProps {
  onSelect: () => void;
  isSelected: boolean;
  color: string;
  code: string;
  label: string;
  indent?: boolean;
  icon: LucideIcon;
}

export function SelectableTreeRow({
  onSelect,
  isSelected,
  color,
  code,
  label,
  indent = false,
  icon: Icon,
}: SelectableTreeRowProps) {
  return (
    <div className={cn('relative group/row rounded-lg', isSelected && getSelectedRowTint(color))}>
      <TreeRowHoverOverlay />
      <button
        type="button"
        onClick={onSelect}
        className="relative w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-gray-600"
      >
        {indent && <span className="w-4 h-4 shrink-0" />}
        <Icon className={cn('w-4 h-4 shrink-0', color)} />
        <span className="text-xs font-semibold text-gray-400 shrink-0">{code}</span>
        <span className="truncate">{label}</span>
      </button>
    </div>
  );
}
