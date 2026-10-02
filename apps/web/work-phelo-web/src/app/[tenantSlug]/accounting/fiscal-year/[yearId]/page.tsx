'use client';

import { use } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { Badge } from '@/components/atoms/Badge';
import { Skeleton } from '@/components/atoms/Skeleton';
import { FiscalPeriodsTable } from '@/components/organisms/accounting/tables/FiscalPeriodsTable';
import { useFiscalYear } from '@/hooks';
import { cardClass } from '@/lib/utils';
import { formatDateRange } from '@/lib/formatters';
import { FISCAL_STATUS_LABEL, FISCAL_STATUS_VARIANT } from '@/lib/accounting/fiscalPeriodStatus';

export default function FiscalYearDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; yearId: string }>;
}) {
  const { tenantSlug, yearId } = use(params);
  const base = `/${tenantSlug}/accounting/fiscal-year`;
  const { data: year, isLoading } = useFiscalYear(yearId);

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Fiscal Years
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">{year?.name ?? 'Fiscal Year'}</span>
      </nav>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !year ? (
        <div
          className={cardClass('flex flex-col items-center justify-center gap-1 py-16 text-center')}
        >
          <p className="text-sm font-medium text-gray-700">Fiscal year not found</p>
          <p className="text-xs text-gray-400">
            It may have been removed, or the link is incorrect.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{year.name}</h1>
              <Badge
                label={FISCAL_STATUS_LABEL[year.status]}
                variant={FISCAL_STATUS_VARIANT[year.status]}
              />
            </div>
            <p className="text-sm text-gray-500">
              {formatDateRange(year.startDate, year.endDate)} · {year.closedPeriodCount} of{' '}
              {year.periodCount} periods closed
            </p>
          </div>

          <FiscalPeriodsTable periods={year.periods} />
        </>
      )}
    </div>
  );
}
