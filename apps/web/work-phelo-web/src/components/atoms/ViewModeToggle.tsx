'use client';

import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'table' | 'grid';

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

const OPTIONS = [
  { value: 'table', label: 'Table view', icon: List },
  { value: 'grid', label: 'Grid view', icon: LayoutGrid },
] as const;

/** Icon switch between a table and a grid of cards, sized to sit in a table toolbar. */
export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
      {OPTIONS.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-label={label}
          aria-pressed={value === v}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            value === v ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600',
          )}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}
