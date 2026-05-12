'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/useHrManagementAccess';
import { BranchesTable } from '@/components/organisms/branches/BranchesTable';

export default function BranchesPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const user = useAuthStore((s) => s.user);
  const { canReadBranches } = useHrManagementAccess();

  useEffect(() => {
    if (user !== null && !canReadBranches) {
      router.replace(`/${params.tenantSlug}/hr`);
    }
  }, [canReadBranches, router, user, params.tenantSlug]);

  if (user !== null && !canReadBranches) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <BranchesTable />
    </div>
  );
}
