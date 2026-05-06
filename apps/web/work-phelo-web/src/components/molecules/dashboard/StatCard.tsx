import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value?: number | null;
  icon: React.ReactNode;
  iconBg?: string;
  className?: string;
}

export function StatCard({ title, value, icon, iconBg, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-card border border-gray-200 shadow-sm p-5 flex flex-col gap-0',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm text-gray-500 font-medium">{title}</span>
        <div className={cn('p-2 rounded-lg', iconBg ?? 'bg-gray-100 text-brand')}>{icon}</div>
      </div>
      <span className="text-xl font-medium text-gray-800">
        {value == null || value === 0 ? '—' : value}
      </span>
    </div>
  );
}
