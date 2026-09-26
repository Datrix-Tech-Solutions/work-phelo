'use client';

import { useParams, useRouter } from 'next/navigation';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { TableButton } from '@/components/atoms/TableButton';
import { ProjectCard } from '@/components/molecules/hr/employees/ProjectCard';
import { useMyProjects } from '@/hooks/hr/useProjects';

export function ProfileProjectsSection() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const { data: projects = [], isLoading } = useMyProjects();

  if (isLoading) return null;

  return (
    <SectionCard
      title="My Projects"
      scrollX
      headerAction={
        <TableButton variant="blue" onClick={() => router.push(`/${tenantSlug}/hr/projects`)}>
          Manage
        </TableButton>
      }
    >
      {projects.length === 0 ? (
        <p className="w-60 shrink-0 self-center text-sm text-gray-400">
          Not assigned to any projects.
        </p>
      ) : (
        projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onSelect={() => router.push(`/${tenantSlug}/hr/projects/${project.id}`)}
          />
        ))
      )}
    </SectionCard>
  );
}
