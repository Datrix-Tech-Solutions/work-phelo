'use client';

import { cn } from '@/lib/utils';

interface ReportStat {
  label: string;
  value: string;
}

interface ReportCardProps {
  icon: React.ReactNode;
  iconClassName?: string;
  title: string;
  description: string;
  stats: ReportStat[];
  generatedAt: string;
  onClick: () => void;
  className?: string;
}

export function ReportCard({
  icon,
  iconClassName,
  title,
  description,
  stats,
  generatedAt,
  onClick,
  className,
}: ReportCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full text-left bg-white rounded-2xl border border-blue-100 p-7 flex flex-col gap-5',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-1 hover:shadow-lg hover:shadow-white-200/80',
        className,
      )}
    >
      {/* Icon + Title */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <div
            className={cn(
              'w-10 h-10 rounded-3xl flex items-center justify-center shrink-0',
              iconClassName ?? 'bg-gray-100 text-gray-700',
            )}
          >
            {icon}
          </div>
        </div>
        <p className="text-sm text-gray-500">{description}</p>
      </div>

      {/* Stats row */}
      <div
        className="w-full bg-gray-50 rounded-xl px-4 py-3 grid gap-4"
        style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">{stat.label}</span>
            <span className="text-sm font-semibold text-gray-900">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
        <span>Generated {generatedAt}</span>
      </div>
    </button>
  );
}
