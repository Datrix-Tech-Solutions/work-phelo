import { Users, UserCheck, Clock, CalendarOff } from 'lucide-react';
import { StatCard } from '@/components/molecules/shared/StatCard';

interface EmployeeStatsRowProps {
  isLoading: boolean;
  total: number;
  permanent: number;
  probation: number;
  onLeave: number;
}

export function EmployeeStatsRow({
  isLoading,
  total,
  permanent,
  probation,
  onLeave,
}: EmployeeStatsRowProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
      <StatCard
        title="Total Employees"
        value={isLoading ? null : total}
        icon={<Users className="w-4.5 h-4.5 text-gray-600" />}
        iconBg="bg-gray-100"
      />
      <StatCard
        title="Permanent Staff"
        value={isLoading ? null : permanent}
        icon={<UserCheck className="w-4.5 h-4.5 text-green-600" />}
        iconBg="bg-green-50"
      />
      <StatCard
        title="On Probation"
        value={isLoading ? null : probation}
        icon={<Clock className="w-4.5 h-4.5 text-yellow-600" />}
        iconBg="bg-yellow-50"
      />
      <StatCard
        title="On Leave"
        value={isLoading ? null : onLeave}
        icon={<CalendarOff className="w-4.5 h-4.5 text-blue-600" />}
        iconBg="bg-blue-50"
      />
    </div>
  );
}
