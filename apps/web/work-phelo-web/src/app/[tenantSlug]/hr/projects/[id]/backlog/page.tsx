'use client';

import { use } from 'react';
import { ProjectBacklog } from '@/components/organisms/hr/projects/ProjectBacklog';

// The backlog is where tasks and sprints are managed: sprints on top, each a collapsible list of its
// tasks, then the tasks not in any sprint.
export default function ProjectBacklogPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { id } = use(params);
  return <ProjectBacklog projectId={id} />;
}
