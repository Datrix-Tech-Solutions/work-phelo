import { Package, UserCheck, CheckCircle, Wrench, Archive } from 'lucide-react';
import { StatCard } from '@/components/molecules/shared/StatCard';

interface AssetStatsRowProps {
  isLoading: boolean;
  total: number;
  assigned: number;
  available: number;
  maintenance: number;
  retired: number;
}

export function AssetStatsRow({
  isLoading,
  total,
  assigned,
  available,
  maintenance,
  retired,
}: AssetStatsRowProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
      <StatCard
        title="Total Assets"
        value={isLoading ? null : total}
        icon={<Package className="w-4.5 h-4.5 text-gray-600" />}
        iconBg="bg-gray-100"
      />
      <StatCard
        title="Assigned"
        value={isLoading ? null : assigned}
        icon={<UserCheck className="w-4.5 h-4.5 text-blue-600" />}
        iconBg="bg-blue-50"
      />
      <StatCard
        title="Available"
        value={isLoading ? null : available}
        icon={<CheckCircle className="w-4.5 h-4.5 text-green-600" />}
        iconBg="bg-green-50"
      />
      <StatCard
        title="Under Maintenance"
        value={isLoading ? null : maintenance}
        icon={<Wrench className="w-4.5 h-4.5 text-yellow-600" />}
        iconBg="bg-yellow-50"
      />
      <StatCard
        title="Retired"
        value={isLoading ? null : retired}
        icon={<Archive className="w-4.5 h-4.5 text-red-500" />}
        iconBg="bg-red-50"
      />
    </div>
  );
}
