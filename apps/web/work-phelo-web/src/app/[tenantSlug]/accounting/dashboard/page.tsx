'use client';

import { useMemo } from 'react';
import { RevenueExpenseChart } from '@/components/molecules/accounting/RevenueExpenseChart';
import { AccountingDashboardKpis } from '@/components/organisms/accounting/AccountingDashboardKpis';
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <RevenueExpenseChart period={filters.period} />
      </div>
    </DashboardShell>
  );
}
