import { FolderKanban } from 'lucide-react';
import { NavGroup } from '@/components/organisms/shared/Sidebar';
import { useProjectLabels } from '@/hooks/useModuleLabels';

const ProjectsIcon = () => <FolderKanban className="w-5 h-5" />;

/**
 * Project Management's own sidebar, same pattern as Payroll/Leave. It has a single page for now (the
 * project list, with each project's details/tasks/board nested under it), so the entry uses the
 * tenant's own label for projects.
 */
export function useProjectsSidebarGroups(tenantSlug: string): { groups: NavGroup[] } {
  const labels = useProjectLabels();

  const groups: NavGroup[] = [
    {
      label: 'Project Management',
      items: [
        {
          key: 'projects',
          label: labels.plural,
          icon: <ProjectsIcon />,
          href: `/${tenantSlug}/hr/projects`,
          enabled: true,
          active: true,
        },
      ],
    },
  ];

  return { groups };
}
