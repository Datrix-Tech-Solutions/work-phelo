'use client';

import { BranchesTable } from '@/components/organisms/branches/BranchesTable';

export default function BranchesPage() {
  return (
    <div className="flex flex-col gap-6 h-full">
      <BranchesTable />
    </div>
  );
}
