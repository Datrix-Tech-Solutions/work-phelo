'use client';

import { use } from 'react';
import { LeaveTypesList } from '@/components/organisms/leave/LeaveTypesList';

export default function LeaveTypesPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Leave Types</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage different types of leave and their entitlement rules
        </p>
      </div>
      <LeaveTypesList tenantSlug={tenantSlug} />
    </div>
  );
}
