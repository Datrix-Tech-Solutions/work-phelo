'use client';

import { FiscalPeriodsTable } from '@/components/organisms/accounting/tables/FiscalPeriodsTable';

export default function FiscalYearPage() {
  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <FiscalPeriodsTable />
    </div>
  );
}
