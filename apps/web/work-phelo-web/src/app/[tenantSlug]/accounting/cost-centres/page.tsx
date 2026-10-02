'use client';

import { CostCentresTable } from '@/components/organisms/accounting/tables/CostCentresTable';

export default function CostCentresPage() {
  return (
    <div className="flex flex-col gap-6 py-6 pr-6 pl-(--page-pl) min-h-0 overflow-y-auto flex-1">
      <CostCentresTable />
    </div>
  );
}
