'use client';

import { useMemo } from 'react';
import { AgingChart } from '@/components/molecules/accounting/AgingChart';
import { CashFlowTrendChart } from '@/components/molecules/accounting/CashFlowTrendChart';
import { MarginRatioChart } from '@/components/molecules/accounting/MarginRatioChart';
import { RevenueExpenseChart } from '@/components/molecules/accounting/RevenueExpenseChart';
import { AccountingDashboardKpis } from '@/components/organisms/accounting/AccountingDashboardKpis';
import { AwaitingPostingCard } from '@/components/organisms/accounting/AwaitingPostingCard';
import { DueRecurringJournalsCard } from '@/components/organisms/accounting/DueRecurringJournalsCard';
import { QuickActionsCard } from '@/components/organisms/accounting/QuickActionsCard';
import { DashboardShell } from '@/components/organisms/shared/DashboardShell';
import { useAccountingCurrencies } from '@/hooks';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';

export default function AccountingDashboardPage() {
  const filters = useDashboardFilters();
  const { data: currencies = [] } = useAccountingCurrencies();

  const currencyOptions = useMemo(
    () => currencies.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` })),
    [currencies],
  );

  return (
    <DashboardShell
      filters={filters}
      fields={[{ key: 'currency', placeholder: 'Currency', options: currencyOptions }]}
    >
      <AccountingDashboardKpis
        period={filters.period}
        year={filters.year}
        currency={filters.fieldValues.currency ?? ''}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_14rem] gap-3">
        <RevenueExpenseChart period={filters.period} />
        <CashFlowTrendChart period={filters.period} />
        <QuickActionsCard fillCell className="h-60 lg:h-auto" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <MarginRatioChart period={filters.period} />
        <AgingChart currency={filters.fieldValues.currency ?? ''} />
        <AwaitingPostingCard />
        <DueRecurringJournalsCard />
      </div>
    </DashboardShell>
  );
}
