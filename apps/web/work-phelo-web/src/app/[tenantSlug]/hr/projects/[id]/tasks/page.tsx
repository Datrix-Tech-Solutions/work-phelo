'use client';

import { use } from 'react';
import { ProjectBacklog } from '@/components/organisms/hr/projects/ProjectBacklog';

// The List tab: the backlog's rows as one flat list, with created, updated and due dates.
export default function ProjectTaskPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { id } = use(params);
  return <ProjectBacklog projectId={id} layout="list" />;
}
