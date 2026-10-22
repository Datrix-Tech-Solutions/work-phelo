'use client';

import { use } from 'react';
import { ProjectCalendar } from '@/components/organisms/hr/projects/ProjectCalendar';

export default function ProjectCalendarPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { id } = use(params);
  return <ProjectCalendar projectId={id} />;
}
