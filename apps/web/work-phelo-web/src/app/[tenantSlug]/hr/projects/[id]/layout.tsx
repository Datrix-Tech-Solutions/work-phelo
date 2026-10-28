'use client';

import { use } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pageBreadcrumb, pagePx } from '@/lib/layout';
import { ProjectBanner } from '@/components/molecules/hr/projects/ProjectBanner';
import {
  useProject,
  useProjectSetup,
  useUpdateProject,
  useMyProfile,
  usePermission,
} from '@/hooks';
import { useSaveWithToast } from '@/hooks/hr/useProjectWork';
import { Permission } from '@/lib/permissionMap';
import { AddProjectTabMenu } from '@/components/molecules/hr/projects/AddProjectTabMenu';
import {
  PROJECT_FEATURE_LABELS,
  PROJECT_FEATURE_OPTIONS,
  PROJECT_FEATURE_TAB_SEGMENTS,
} from '@/lib/projectFeatures';
import type { ProjectFeature } from '@/types/hr';
import { BLANK_PROJECT_CONFIG } from '@/lib/defaultProjectTemplates';
import { useProjectLabels } from '@/hooks/useModuleLabels';

const TAB_ACTIVE =
  'relative text-brand font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand after:rounded-t-full';
const TAB_IDLE = 'text-gray-500 hover:text-gray-800';

export default function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const pathname = usePathname();
  const labels = useProjectLabels();
  const base = `/${tenantSlug}/hr/projects`;
  const root = `${base}/${id}`;

  const { data: project, isLoading } = useProject(id);
  // The project's own features (from its template or blank-slate setup) decide its tabs.
  const setup = useProjectSetup(id);
  const features = setup?.config?.features;
  const isBillable = !!setup?.billable && !!setup.pricing;
  const updateProject = useUpdateProject();
  const save = useSaveWithToast();
  // Turns a tab on for this project only, leaving its template alone. A project made before set-ups
  // existed starts from the Tasks and Board tabs it was already showing.
  const addFeature = (feature: ProjectFeature) =>
    save(
      updateProject.mutateAsync({
        id,
        data: {
          config: {
            ...BLANK_PROJECT_CONFIG,
            ...setup?.config,
            ...(setup?.config ? {} : { workflow: ['To Do', 'In Progress', 'On Hold', 'Done'] }),
            features: [...(features ?? ['LIST', 'BOARD']), feature],
          },
        },
      }),
    );
  const router = useRouter();
  const { data: myProfile } = useMyProfile();
  const canManageProjects = usePermission(Permission.CREATE_PROJECT);
  const canAddTabs =
    canManageProjects || !!(project?.managerId && project.managerId === myProfile?.id);

  if (isLoading) {
    return (
      <div className={cn(pageBreadcrumb, 'flex flex-col gap-6 flex-1 min-h-0 animate-pulse')}>
        <div className="h-4 w-48 bg-gray-200 rounded" />
        <div className="h-24 bg-gray-200 rounded-card" />
        <div className="h-10 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className={cn(pageBreadcrumb, 'text-sm text-gray-500')}>
        {labels.singular} not found.
      </div>
    );
  }

  // Summary is always there. Projects with no saved setup (made before templates) keep Tasks and Board.
  const featureTabs = features
    ? features.map((f) => ({
        // A name the template gave the view stands alone; the usual names follow the project's name.
        label:
          setup?.config?.featureLabels?.[f] ??
          `${labels.singular} ${f === 'LIST' ? 'Tasks' : PROJECT_FEATURE_LABELS[f]}`,
        href: `${root}/${PROJECT_FEATURE_TAB_SEGMENTS[f]}`,
      }))
    : [
        { label: `${labels.singular} Tasks`, href: `${root}/tasks` },
        { label: `${labels.singular} Board`, href: `${root}/board` },
      ];
  // The tabs a project doesn't have yet. A project with no saved setup shows Tasks and Board.
  const activeFeatures: ProjectFeature[] = features ?? ['LIST', 'BOARD'];
  const unusedTabs = PROJECT_FEATURE_OPTIONS.filter((o) => !activeFeatures.includes(o.value));

  // A billable project also gets a billing tab, for raising invoices and looking back over them.
  const billingTabs = isBillable
    ? [{ label: `${labels.singular} Billing`, href: `${root}/billing` }]
    : [];

  const tabs = [
    { label: `${labels.singular} Summary`, href: `${root}/summary` },
    ...featureTabs,
    ...billingTabs,
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Fixed breadcrumb */}
      <div className={`${pageBreadcrumb} shrink-0`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={base} className="hover:text-gray-700 transition-colors">
            {labels.plural}
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-700 font-medium">{project.name}</span>
        </nav>
      </div>

      {/* Scroll container — not a flex container so children grow to full natural height */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={cn(pagePx, 'flex flex-col gap-6 pt-4 pb-8')}>
          {/* The bar and the tabs sit closer together than the rest of the page. */}
          <div className="flex flex-col gap-2">
            <ProjectBanner project={project} />

            {/* Tabs */}
            <div className="flex items-end gap-1 border-b border-gray-200">
              {tabs.map((tab) => {
                const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      'relative px-6 py-3 text-sm transition-colors whitespace-nowrap',
                      isActive ? TAB_ACTIVE : TAB_IDLE,
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
              {canAddTabs && (
                <AddProjectTabMenu
                  options={unusedTabs.map((o) => ({
                    value: o.value,
                    label: o.value === 'LIST' ? 'Tasks' : o.label,
                  }))}
                  onPick={(value) => {
                    addFeature(value as ProjectFeature);
                    router.push(`${root}/${PROJECT_FEATURE_TAB_SEGMENTS[value as ProjectFeature]}`);
                  }}
                />
              )}
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
