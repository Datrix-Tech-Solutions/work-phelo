'use client';

import { use } from 'react';
import { ProjectObjectives } from '@/components/organisms/hr/projects/ProjectObjectives';

export default function ProjectObjectivesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { id } = use(params);
  return <ProjectObjectives projectId={id} />;
}
