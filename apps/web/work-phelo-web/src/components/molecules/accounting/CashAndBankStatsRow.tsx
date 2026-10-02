import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { Icons } from '@/components/atoms/icons';

interface CashAndBankStatsRowProps {
  isLoading: boolean;
  totalCashPosition: string;
  cashInflowYtd: string;
  cashOutflowYtd: string;
}

export function CashAndBankStatsRow({
  isLoading,
  totalCashPosition,
  cashInflowYtd,
  cashOutflowYtd,
}: CashAndBankStatsRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
      <KpiCard
        label="Net Cash Position (Posted)"
        value={totalCashPosition}
        icon={Icons.CircleDollarSign}
        iconColor="var(--module-accounting, #2a78d6)"
        isLoading={isLoading}
      />
      <KpiCard
        label="Cash Inflow (YTD)"
        value={cashInflowYtd}
        icon={Icons.TrendingUp}
        iconColor="#1baf7a"
        isLoading={isLoading}
      />
      <KpiCard
        label="Cash Outflow (YTD)"
        value={cashOutflowYtd}
        icon={Icons.TrendingDown}
        iconColor="#e34948"
        isLoading={isLoading}
      />
    </div>
  );
}
