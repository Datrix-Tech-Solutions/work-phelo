'use client';

import { use } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { KpiCard } from '@/components/molecules/reinsurance/stats/KpiCard';
import { CashAccountOverview } from '@/components/molecules/accounting/CashAccountOverview';
import { GLAccountLedger } from '@/components/organisms/accounting/GLAccountLedger';
import { useCashAccount, useCashAccountStats } from '@/hooks';

function formatTotals(totals: Record<string, number> | undefined) {
  const values = Object.entries(totals ?? {});
  if (values.length === 0) return '—';
  return values
    .sort(([first], [second]) => first.localeCompare(second))
    .map(
      ([currency, value]) =>
        `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    )
    .join(' · ');
}

export default function CashAccountDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; cashAccountId: string }>;
}) {
  const { tenantSlug, cashAccountId } = use(params);

  const { data: account, isLoading } = useCashAccount(cashAccountId);
  const { data: stats, isLoading: isLoadingStats } = useCashAccountStats(cashAccountId);
  const base = `/${tenantSlug}/accounting/cashandbank`;

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Cash and Bank
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">{account?.name ?? '—'}</span>
      </nav>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      ) : !account ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Account not found.
        </div>
      ) : (
        <>
          <CashAccountOverview account={account} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Net Movement"
              value={formatTotals(stats?.net)}
              icon={Icons.CircleDollarSign}
              iconColor="var(--module-accounting, #2a78d6)"
              isLoading={isLoadingStats}
            />
            <KpiCard
              label="Total Inflow"
              value={formatTotals(stats?.inflow)}
              icon={Icons.TrendingUp}
              iconColor="#1baf7a"
              isLoading={isLoadingStats}
            />
            <KpiCard
              label="Total Outflow"
              value={formatTotals(stats?.outflow)}
              icon={Icons.TrendingDown}
              iconColor="#e34948"
              isLoading={isLoadingStats}
            />
          </div>

          <GLAccountLedger accountId={account.glAccountId} />
        </>
      )}
    </div>
  );
}
