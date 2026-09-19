'use client';

import { BudgetForecastTable } from '@/components/organisms/accounting/tables/BudgetForecastTable';

export default function BudgetForecastPage() {
  return (
    <div className="flex flex-col gap-6 py-6 pr-6 pl-(--page-pl) min-h-0 overflow-y-auto flex-1">
      <BudgetForecastTable />
    </div>
  );
}
