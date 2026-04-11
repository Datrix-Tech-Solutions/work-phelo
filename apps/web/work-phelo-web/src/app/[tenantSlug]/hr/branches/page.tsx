'use client';

import { BranchesTable } from '@/components/organisms/branches/BranchesTable';

export default function BranchesPage() {
  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Branches</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage your company&apos;s office locations and branch members
        </p>
      </div>
      <div className="flex flex-col flex-1 min-h-0">
        <BranchesTable />
      </div>
    </div>
  );
}
