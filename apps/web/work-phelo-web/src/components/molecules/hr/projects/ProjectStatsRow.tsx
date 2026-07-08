import { ClipboardList, CheckCircle, Layers } from 'lucide-react';
import { StatCard } from '@/components/molecules/shared/StatCard';

interface ProjectStatsRowProps {
  isLoading: boolean;
  total: number;
  active: number;
  completed: number;
  planning: number;
}

export function ProjectStatsRow({
  isLoading,
  total,
  active,
  completed,
  planning,
}: ProjectStatsRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
      <StatCard
        title="Total Projects"
        value={isLoading ? null : total}
        icon={<Layers className="w-4.5 h-4.5 text-green-600" />}
        iconBg="bg-green-50"
      />
      <StatCard
        title="Active Projects"
        value={isLoading ? null : active}
        icon={<ClipboardList className="w-4.5 h-4.5 text-blue-600" />}
        iconBg="bg-blue-50"
      />
      <StatCard
        title="Completed"
        value={isLoading ? null : completed}
        icon={<CheckCircle className="w-4.5 h-4.5 text-purple-600" />}
        iconBg="bg-purple-50"
      />
      <StatCard
        title="In Planning"
        value={isLoading ? null : planning}
        icon={<ClipboardList className="w-4.5 h-4.5 text-yellow-600" />}
        iconBg="bg-yellow-50"
      />
    </div>
  );
}
