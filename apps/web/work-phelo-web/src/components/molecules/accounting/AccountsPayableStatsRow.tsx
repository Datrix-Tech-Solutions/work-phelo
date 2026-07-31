import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { Icons } from '@/components/atoms/icons';

interface AccountsPayableStatsRowProps {
  isLoading: boolean;
  totalPayables: string;
  overdueInvoices: number;
  dueThisWeek: number;
  pendingApproval: number;
}

export function AccountsPayableStatsRow({
  isLoading,
  totalPayables,
  overdueInvoices,
  dueThisWeek,
  pendingApproval,
}: AccountsPayableStatsRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
      <KpiCard
        label="Total Payables"
        value={totalPayables}
        icon={Icons.CircleDollarSign}
        iconColor="var(--module-accounting, #2a78d6)"
        isLoading={isLoading}
      />
      <KpiCard
        label="Overdue Invoices"
        value={overdueInvoices}
        icon={Icons.FileWarning}
        iconColor="#e34948"
        isLoading={isLoading}
      />
      <KpiCard
        label="Due This Week"
        value={dueThisWeek}
        icon={Icons.CalendarRange}
        iconColor="#eda100"
        isLoading={isLoading}
      />
      <KpiCard
        label="Pending Approval"
        value={pendingApproval}
        icon={Icons.Clock}
        iconColor="#4a3aa7"
        isLoading={isLoading}
      />
    </div>
  );
}
