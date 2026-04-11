'use client';

import { use } from 'react';
import { PublicHolidaysList } from '@/components/organisms/leave/PublicHolidaysList';

export default function PublicHolidaysPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Public Holidays</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage public holidays — these days are automatically excluded from leave calculations
        </p>
      </div>
      <PublicHolidaysList tenantSlug={tenantSlug} />
    </div>
  );
}
