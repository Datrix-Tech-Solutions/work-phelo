import { ReactNode } from 'react';

interface DetailFieldProps {
  label: string;
  value: ReactNode;
  horizontal?: boolean;
}

export function DetailField({ label, value, horizontal = false }: DetailFieldProps) {
  if (horizontal) {
    return (
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide shrink-0">
          {label}
        </span>
        <span className="text-sm font-medium text-gray-800 text-right">{value ?? '—'}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value ?? '—'}</span>
    </div>
  );
}
