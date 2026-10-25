'use client';

import { use } from 'react';
import { ProjectBilling } from '@/components/organisms/hr/projects/ProjectBilling';

export default function ProjectBillingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { id } = use(params);
  return <ProjectBilling projectId={id} />;
}
