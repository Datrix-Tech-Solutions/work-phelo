'use client';

import { cn } from '@/lib/utils';

export type DashboardView = 'detailed' | 'general';

const VIEWS: { label: string; value: DashboardView }[] = [
  { label: 'General Dashboard', value: 'general' },
  { label: 'Detailed Dashboard', value: 'detailed' },
];

interface DashboardViewToggleProps {
  value: DashboardView;
  onChange: (value: DashboardView) => void;
}

export function DashboardViewToggle({ value, onChange }: DashboardViewToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-input border border-gray-200 bg-white p-1">
      {VIEWS.map(({ label, value: v }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            'px-4 py-1.5 text-sm font-medium rounded-input transition-colors',
            value === v ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
