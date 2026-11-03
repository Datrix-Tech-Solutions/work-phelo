'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/atoms/icons';
import { useGoals } from '@/hooks/hr/useGoalAppraisals';
import { useAuthStore } from '@/store/auth.store';
import { useHrManagementAccess } from '@/hooks/hr/useHrManagementAccess';
import { GoalObjectivesContent } from '@/components/organisms/hr/appraisal/GoalObjectivesContent';
import { pageBreadcrumb, pageContent } from '@/lib/layout';

export default function GoalObjectivesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; goalId: string }>;
}) {
  const { tenantSlug, goalId } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { canConfigureAppraisal } = useHrManagementAccess();
  const { goals } = useGoals();
  const goal = goals.find((g) => g.id === goalId);

  useEffect(() => {
    if (user !== null && !canConfigureAppraisal) router.replace(`/${tenantSlug}/hr`);
  }, [canConfigureAppraisal, router, tenantSlug, user]);

  if (user !== null && !canConfigureAppraisal) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/hr/appraisal/settings/goals`}
            className="hover:text-gray-700 transition-colors"
          >
            Goals
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{goal?.name ?? '—'}</span>
        </nav>
      </div>

      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto`}>
        <GoalObjectivesContent goalId={goalId} />
      </div>
    </div>
  );
}
