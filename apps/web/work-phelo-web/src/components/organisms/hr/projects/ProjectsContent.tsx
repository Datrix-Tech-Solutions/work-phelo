'use client';

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { ProjectCard } from '@/components/molecules/hr/projects/ProjectCard';
import { ProjectStatsRow } from '@/components/molecules/hr/projects/ProjectStatsRow';
import { ProjectFilterBar } from '@/components/molecules/hr/projects/ProjectFilterBar';
import { SelectProjectTemplateModal } from '@/components/organisms/hr/projects/SelectProjectTemplateModal';
import { CreateProjectPanel } from '@/components/organisms/hr/projects/CreateProjectPanel';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import {
  useProjects,
  useMyProjects,
  useCreateProject,
  useArchiveProject,
  usePermission,
} from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import {
  CreateProjectDto,
  ProjectConfig,
  ProjectFeature,
  ProjectPricing,
  ProjectTemplate,
  ProjectType,
} from '@/types/hr';
import { extractError } from '@/lib/extractError';
import { seedProjectFromTemplate } from '@/lib/seedProjectFromTemplate';
import { useToastStore } from '@/store/toast.store';
import { useProjectLabels } from '@/hooks/useModuleLabels';

const PAGE_SIZE = 12;

interface Props {
  tenantSlug: string;
}

function ConfirmDeleteModal({
  singular,
  projectName,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  singular: string;
  projectName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Delete {singular}</p>
            <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-900">{projectName}</span>?
        </p>
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            isLoading={isDeleting}
            loadingText="Deleting…"
            className="bg-red-600 hover:bg-red-700 text-white border-red-600"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProjectsContent({ tenantSlug }: Props) {
  const router = useRouter();
  const toast = useToastStore((s) => s.addToast);
  const labels = useProjectLabels();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  // Chosen in the template pop-up (null is the blank slate); the create form is prefilled from it.
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  // Bumped on every pick so the form remounts and is prefilled from it afresh.
  const [panelKey, setPanelKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const canViewAll = usePermission(Permission.READ_PROJECTS);
  const canManageProjects = usePermission(Permission.CREATE_PROJECT);

  const { data: allProjectsData = [], isLoading: allLoading } = useProjects();
  const { data: myProjectsData = [], isLoading: myLoading } = useMyProjects();
  const projects = canViewAll ? allProjectsData : myProjectsData;
  const isLoading = canViewAll ? allLoading : myLoading;

  const { data: employees = [] } = useEmployeeOptions();
  const createProject = useCreateProject();
  const archiveProject = useArchiveProject();

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.managerName?.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [projects, search, statusFilter]);

  const metrics = useMemo(
    () => ({
      total: projects.length,
      active: projects.filter((p) => p.status === 'ACTIVE').length,
      completed: projects.filter((p) => p.status === 'COMPLETED').length,
      planning: projects.filter((p) => p.status === 'PLANNING').length,
    }),
    [projects],
  );

  const hasFilters = !!(search || statusFilter);
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedProjects = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const queryClient = useQueryClient();
  // What the chosen template adds beyond its set-up: view names, objectives and sprints.
  const templateContent = selectedTemplate?.content;

  /** The template's view names, for the views the project actually has. */
  const withFeatureLabels = (config: ProjectConfig): ProjectConfig => {
    const labels = Object.fromEntries(
      Object.entries(templateContent?.featureLabels ?? {}).filter(([f]) =>
        config.features.includes(f as ProjectFeature),
      ),
    );
    return Object.keys(labels).length ? { ...config, featureLabels: labels } : config;
  };

  const handleCreate = async (
    base: Omit<CreateProjectDto, 'kind' | 'config'>,
    projectType: ProjectType,
    config: ProjectConfig,
    clientInfo?: {
      billable: boolean;
      pricing?: ProjectPricing;
      client?: { id: string; name: string };
    },
  ) => {
    try {
      const pricing = clientInfo?.pricing;
      const data: CreateProjectDto = {
        ...base,
        kind: projectType,
        config: withFeatureLabels(config),
        ...(selectedTemplate ? { templateName: selectedTemplate.name } : {}),
        ...(clientInfo?.client
          ? { clientId: clientInfo.client.id, clientName: clientInfo.client.name }
          : {}),
        ...(clientInfo ? { billable: clientInfo.billable } : {}),
        ...(pricing
          ? {
              pricing:
                pricing.type === 'MILESTONE'
                  ? {
                      type: 'MILESTONE',
                      milestones: pricing.milestones.map(({ name, amount, dueDate }) => ({
                        name,
                        amount,
                        ...(dueDate ? { dueDate } : {}),
                      })),
                    }
                  : pricing,
            }
          : {}),
      };
      const created = await createProject.mutateAsync(data);
      setPanelOpen(false);
      if (templateContent) {
        try {
          await seedProjectFromTemplate(created.id, templateContent, base.startDate);
          queryClient.invalidateQueries({ queryKey: ['projects', created.id] });
        } catch (err) {
          toast({
            message: `The project was created, but its starter content wasn't added: ${extractError(err)}`,
            type: 'error',
          });
        }
      }
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await archiveProject.mutateAsync(deleteTarget.id);
      toast({ message: `"${deleteTarget.name}" has been deleted.`, type: 'success' });
      setDeleteTarget(null);
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  return (
    <>
      <ProjectStatsRow isLoading={isLoading} {...metrics} labels={labels} />

      <DataCardGrid
        data={pagedProjects}
        isLoading={isLoading}
        skeletonCount={8}
        renderSkeleton={() => (
          <div className="w-full h-52 rounded-card bg-gray-100 animate-pulse" />
        )}
        searchPlaceholder={`Search by ${labels.singularLower} name or manager…`}
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={
          canManageProjects
            ? { label: `New ${labels.singular}`, onClick: () => setTemplateModalOpen(true) }
            : undefined
        }
        extraFilters={
          <ProjectFilterBar
            statusFilter={statusFilter}
            onStatusChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            showClear={hasFilters}
            onClear={clearFilters}
          />
        }
        emptyMessage={`No ${labels.pluralLower} found`}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        renderCard={(project) => (
          <ProjectCard
            project={project}
            onOpen={() => router.push(`/${tenantSlug}/hr/projects/${project.id}`)}
            onDelete={
              canManageProjects
                ? () => setDeleteTarget({ id: project.id, name: project.name })
                : undefined
            }
          />
        )}
      />

      {canManageProjects && (
        <SelectProjectTemplateModal
          isOpen={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          onSelect={(template) => {
            setSelectedTemplate(template);
            setPanelKey((k) => k + 1);
            setTemplateModalOpen(false);
            setPanelOpen(true);
          }}
        />
      )}

      {canManageProjects && (
        <CreateProjectPanel
          key={panelKey}
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          employees={employees}
          onSubmit={handleCreate}
          isSubmitting={createProject.isPending}
          template={selectedTemplate}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          singular={labels.singular}
          projectName={deleteTarget.name}
          isDeleting={archiveProject.isPending}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
