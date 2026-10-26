'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { Badge, type BadgeProps } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Skeleton } from '@/components/atoms/Skeleton';
import { ScheduleInterviewPanel } from '@/components/organisms/hr/recruitment/ScheduleInterviewPanel';
import { JobOpeningPipeline } from '@/components/organisms/hr/recruitment/JobOpeningPipeline';
import { JobOpeningOverview } from '@/components/molecules/hr/recruitment/JobOpeningOverview';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { usePermission } from '@/hooks/hr/usePermission';
import { useRedirectWhenDenied } from '@/hooks/hr/useRedirectWhenDenied';
import { useCandidates, useJobOpening } from '@/hooks/hr/useRecruitment';
import { pageBreadcrumb, pageContent, pagePx } from '@/lib/layout';
import { Permission } from '@/lib/permissionMap';
import type { JobOpeningStatus } from '@/types/recruitment';

const STATUS_BADGES: Record<JobOpeningStatus, { label: string; variant: BadgeProps['variant'] }> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  OPEN: { label: 'Open', variant: 'success' },
  CLOSED: { label: 'Closed', variant: 'danger' },
};

export default function JobOpeningDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const router = useRouter();
  const listPath = `/${tenantSlug}/hr/recruitment/job-openings`;

  const canView = usePermission(Permission.READ_RECRUITMENT_VACANCIES);
  const canUpdate = usePermission(Permission.UPDATE_RECRUITMENT_VACANCY);
  useRedirectWhenDenied(canView === false, `/${tenantSlug}/hr/recruitment`);

  const canSchedule = usePermission(Permission.SCHEDULE_RECRUITMENT_INTERVIEW);
  const canReadCandidates = usePermission(Permission.READ_RECRUITMENT_CANDIDATES);
  const [scheduling, setScheduling] = useState(false);

  const { data: vacancy, isLoading } = useJobOpening(canView ? id : '');
  const { data: candidatePage } = useCandidates({ vacancyId: id, limit: 100 });
  const candidates = canReadCandidates ? (candidatePage?.items ?? []) : [];

  if (!canView) return null;

  if (isLoading) {
    return (
      <div className={`${pagePx} pt-4 flex flex-col gap-4`}>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!vacancy) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center text-sm text-gray-400">
        Job opening not found.{' '}
        <Link href={listPath} className="text-gray-700 underline">
          Back to job openings
        </Link>
      </div>
    );
  }

  const { label, variant } = STATUS_BADGES[vacancy.status];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`${pageBreadcrumb} shrink-0`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={listPath} className="hover:text-gray-700 transition-colors">
            Job Openings
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{vacancy.title ?? 'Untitled'}</span>
        </nav>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={pageContent}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-lg font-bold text-gray-900 truncate">
                  {vacancy.title ?? 'Untitled'}
                </h1>
                <Badge label={label} variant={variant} />
              </div>
              <div className="flex items-center gap-2">
                {canSchedule && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={candidates.length === 0}
                    onClick={() => setScheduling(true)}
                  >
                    Schedule Interview
                  </Button>
                )}
                {canUpdate && (
                  <Button size="sm" onClick={() => router.push(`${listPath}/${vacancy.id}/edit`)}>
                    Edit
                  </Button>
                )}
              </div>
            </div>

            <JobOpeningOverview vacancy={vacancy} />
            <JobOpeningPipeline
              vacancyId={vacancy.id}
              requirements={vacancy.details}
              cutoffScore={vacancy.cutoffScore}
            />
          </div>
        </div>
      </div>

      <ScheduleInterviewPanel
        choices={candidates}
        open={scheduling}
        onClose={() => setScheduling(false)}
      />
    </div>
  );
}
