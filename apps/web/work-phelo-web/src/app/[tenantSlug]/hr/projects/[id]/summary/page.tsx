'use client';

import { use } from 'react';
import { ProjectInfoBar, ProjectSummary } from '@/components/organisms/hr/projects/ProjectSummary';

export default function ProjectSummaryPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="flex flex-col gap-6">
      <ProjectInfoBar projectId={id} />
      <ProjectSummary projectId={id} />
    </div>
  );
}
