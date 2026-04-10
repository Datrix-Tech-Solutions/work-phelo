import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value?: number | null;
  icon: React.ReactNode;
  className?: string;
}

export function StatCard({ title, value, icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-input border border-gray-100 shadow-sm p-5 flex flex-col gap-4',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm text-gray-500 font-medium">{title}</span>
        <div className="p-2 bg-gray-100 rounded-input text-[#0D2244]">{icon}</div>
      </div>
      <span className="text-xl font-medium text-gray-800">
        {value == null || value === 0 ? '—' : value}
      </span>
    </div>
  );
}
