'use client';

import { use } from 'react';
import { ProjectsContent } from '@/components/organisms/projects/ProjectsContent';

export default function ProjectsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <ProjectsContent tenantSlug={tenantSlug} />
    </div>
  );
}
