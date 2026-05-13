'use client';

import { ProjectDetailsCard } from '@/components/molecules/projects/ProjectDetailsCard';
import { ProjectMembersTable } from '@/components/organisms/projects/ProjectMembersTable';
import { Project } from '@/types/hr';

export default function ProjectDetailsPage() {
  const project = undefined as Project | undefined;
  if (!project) return null;

  return (
    <div className="flex flex-col gap-6">
      <ProjectDetailsCard project={project} />
      <ProjectMembersTable />
    </div>
  );
}
