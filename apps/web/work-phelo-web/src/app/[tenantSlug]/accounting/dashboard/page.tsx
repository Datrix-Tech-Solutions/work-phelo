'use client';

import { useMemo } from 'react';
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
    </DashboardShell>
  );
}
