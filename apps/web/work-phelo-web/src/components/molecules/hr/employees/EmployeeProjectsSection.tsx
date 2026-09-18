'use client';

import { useParams, useRouter } from 'next/navigation';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { TableButton } from '@/components/atoms/TableButton';
import { ProjectCard } from '@/components/molecules/hr/employees/ProjectCard';
import { useEmployeeProjects } from '@/hooks/hr/useProjects';

export function EmployeeProjectsSection({
  employeeId,
  canOpenProjects,
}: {
  employeeId: string;
  canOpenProjects: boolean;
}) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const { data: projects = [], isLoading } = useEmployeeProjects(employeeId);

  if (isLoading) return null;

  return (
    <SectionCard
      title="Projects"
      scrollX
      headerAction={
        canOpenProjects ? (
          <TableButton variant="blue" onClick={() => router.push(`/${tenantSlug}/hr/projects`)}>
            Manage
          </TableButton>
        ) : undefined
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
            disabled={!canOpenProjects}
            onSelect={() => router.push(`/${tenantSlug}/hr/projects/${project.id}`)}
          />
        ))
      )}
    </SectionCard>
  );
}
