import { ReactNode } from 'react';

interface DetailFieldProps {
  label: string;
  value: ReactNode;
}

export function DetailField({ label, value }: DetailFieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value ?? '—'}</span>
    </div>
  );
}
