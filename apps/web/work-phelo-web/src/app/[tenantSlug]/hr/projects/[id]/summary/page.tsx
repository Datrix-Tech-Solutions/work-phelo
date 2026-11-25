'use client';

import { use } from 'react';
import { ProjectSummary } from '@/components/organisms/hr/projects/ProjectSummary';

export default function ProjectSummaryPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { id } = use(params);

  return <ProjectSummary projectId={id} />;
}
