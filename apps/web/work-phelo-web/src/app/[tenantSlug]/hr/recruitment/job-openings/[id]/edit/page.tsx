'use client';

import { use } from 'react';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { JobOpeningWizard } from '@/components/organisms/hr/recruitment/JobOpeningWizard';
import { Skeleton } from '@/components/atoms/Skeleton';
import { usePermission } from '@/hooks/hr/usePermission';
import { useRedirectWhenDenied } from '@/hooks/hr/useRedirectWhenDenied';
import { useJobOpening, useUpdateJobOpening } from '@/hooks/hr/useRecruitment';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { toFormValues, toVacancyPayload } from '@/lib/hr/jobOpeningMapper';
import { pagePx } from '@/lib/layout';
import { Permission } from '@/lib/permissionMap';

export default function EditJobOpeningPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const canUpdate = usePermission(Permission.UPDATE_RECRUITMENT_VACANCY);
  const { data: vacancy, isLoading, isError } = useJobOpening(id);
  const { mutate: updateJobOpening, isPending } = useUpdateJobOpening();
  const listPath = `/${tenantSlug}/hr/recruitment/job-openings`;

  useRedirectWhenDenied(canUpdate === false || isError, listPath);

  if (!canUpdate) return null;

  if (isLoading || !vacancy) {
    return (
      <div className={`${pagePx} pt-4 flex flex-col gap-4`}>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <JobOpeningWizard
      tenantSlug={tenantSlug}
      initialValues={toFormValues(vacancy)}
      status={vacancy.status}
      isSubmitting={isPending}
      onSubmit={(values, status) =>
        updateJobOpening(
          { id, ...toVacancyPayload(values, status) },
          {
            onSuccess: () => {
              toast.success(status === 'OPEN' ? 'Job opening published' : 'Job opening updated');
              router.push(listPath);
            },
            onError: (err) => toast.error(extractError(err, 'Failed to update job opening')),
          },
        )
      }
      onCancel={() => router.push(listPath)}
    />
  );
}
