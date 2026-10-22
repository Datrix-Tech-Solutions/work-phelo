import { FolderKanban, LayoutTemplate } from 'lucide-react';
import { NavGroup } from '@/components/organisms/shared/Sidebar';
import { useProjectLabels } from '@/hooks/useModuleLabels';

const ProjectsIcon = () => <FolderKanban className="w-5 h-5" />;
const TemplatesIcon = () => <LayoutTemplate className="w-5 h-5" />;

/**
 * Project Management's own sidebar, same pattern as Payroll/Leave. It has the project list (with each
 * project's details/tasks/board nested under it) and project templates; entries use the tenant's own
 * label for projects.
 */
export function useProjectsSidebarGroups(tenantSlug: string): { groups: NavGroup[] } {
  const labels = useProjectLabels();

  const groups: NavGroup[] = [
    {
      label: labels.management,
      items: [
        {
          key: 'projects',
          label: labels.plural,
          icon: <ProjectsIcon />,
          href: `/${tenantSlug}/hr/projects`,
          excludeHrefs: [`/${tenantSlug}/hr/projects/templates`],
          enabled: true,
          active: true,
        },
        {
          key: 'templates',
          label: `${labels.singular} Templates`,
          icon: <TemplatesIcon />,
          href: `/${tenantSlug}/hr/projects/templates`,
          enabled: true,
          active: true,
        },
      ],
    },
  ];

  return { groups };
}
