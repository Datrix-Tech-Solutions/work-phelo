import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
}

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-gray-200 bg-white p-5">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}
