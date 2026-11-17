'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';
import { PerformanceGroupsContent } from '@/components/organisms/hr/appraisal/PerformanceGroupsContent';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

export default function PerformanceGroupsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { canConfigureAppraisal } = useHrManagementAccess();

  useEffect(() => {
    if (user !== null && !canConfigureAppraisal) {
      router.replace(`/${tenantSlug}/hr`);
    }
  }, [canConfigureAppraisal, router, tenantSlug, user]);

  if (user !== null && !canConfigureAppraisal) {
    return null;
  }

  return (
    <div className={cn(pageContent, 'flex flex-col gap-6')}>
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Performance groups</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Who is scored together and how much each goal counts for them. A cycle runs groups
        </p>
      </div>
      <PerformanceGroupsContent />
    </div>
  );
}
