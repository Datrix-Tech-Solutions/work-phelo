'use client';

import { FacultativeTable } from '@/components/organisms/reinsurance/tables/FacultativeTable';

export default function FacultativePage() {
  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Facultative</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage individual risk placements and facultative certificates
        </p>
      </div>
      <FacultativeTable />
    </div>
  );
}
