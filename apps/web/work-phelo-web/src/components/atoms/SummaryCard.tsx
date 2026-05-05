import { LucideIcon } from 'lucide-react';

interface SummaryCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}

export function SummaryCard({ label, value, icon: Icon, iconColor, iconBg }: SummaryCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
