'use client';

import { use } from 'react';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { JobOpeningWizard } from '@/components/organisms/hr/recruitment/JobOpeningWizard';
import { usePermission } from '@/hooks/hr/usePermission';
import { useRedirectWhenDenied } from '@/hooks/hr/useRedirectWhenDenied';
import { useCreateJobOpening } from '@/hooks/hr/useRecruitment';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { toVacancyPayload } from '@/lib/hr/jobOpeningMapper';
import { Permission } from '@/lib/permissionMap';

export default function NewJobOpeningPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const toast = useToast();
  const canCreate = usePermission(Permission.CREATE_RECRUITMENT_VACANCY);
  const { mutate: createJobOpening, isPending } = useCreateJobOpening();
  const listPath = `/${tenantSlug}/hr/recruitment/job-openings`;

  useRedirectWhenDenied(canCreate === false, listPath);

  if (!canCreate) return null;

  return (
    <JobOpeningWizard
      tenantSlug={tenantSlug}
      isSubmitting={isPending}
      onSubmit={(values, status) =>
        createJobOpening(toVacancyPayload(values, status), {
          onSuccess: () => {
            toast.success(status === 'OPEN' ? 'Job opening published' : 'Job opening saved');
            router.push(listPath);
          },
          onError: (err) => toast.error(extractError(err, 'Failed to save job opening')),
        })
      }
      onCancel={() => router.push(listPath)}
    />
  );
}
