'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';
import { GoalsContent } from '@/components/organisms/hr/appraisal/GoalsContent';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

export default function AppraisalGoalsPage({
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
        <h2 className="text-base font-semibold text-gray-900">Goals</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          The goals a cycle can run. Employees rate themselves on the objectives they add under each
          goal
        </p>
      </div>
      <GoalsContent />
    </div>
  );
}
