'use client';

import { AccountingCurrenciesTable } from '@/components/organisms/accounting/tables/AccountingCurrenciesTable';
import { ExchangeRatesTable } from '@/components/organisms/accounting/tables/ExchangeRatesTable';

export default function CurrencyPage() {
  return (
    <div className="flex flex-col gap-8">
      <AccountingCurrenciesTable />
      <ExchangeRatesTable />
    </div>
  );
}
