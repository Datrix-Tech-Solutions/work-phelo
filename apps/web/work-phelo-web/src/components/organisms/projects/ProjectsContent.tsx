'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ClipboardList, CheckCircle, Layers, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { FilterSelect } from '@/components/molecules/shared/FilterSelect';
import { ProjectCard } from '@/components/molecules/ProjectCard';
import { CreateProjectPanel } from '@/components/organisms/projects/CreateProjectPanel';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import {
  useProjects,
  useMyProjects,
  useCreateProject,
  useArchiveProject,
  usePermission,
} from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import { CreateProjectDto } from '@/types/hr';
import { StatCard } from '@/components/molecules/shared/StatCard';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

interface Props {
  tenantSlug: string;
}

function ConfirmDeleteModal({
  projectName,
  isDeleting,
  onConfirm,
  onCancel,
}: {
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
            <p className="text-sm font-semibold text-gray-900">Delete Project</p>
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

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
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

  const handleCreate = async (data: CreateProjectDto) => {
    try {
      await createProject.mutateAsync(data);
      setPanelOpen(false);
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
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Projects & Tasks</h1>
        </div>
        {canManageProjects && <Button onClick={() => setPanelOpen(true)}>+ New Project</Button>}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <StatCard
          title="Total Projects"
          value={metrics.total}
          icon={<Layers className="w-4.5 h-4.5 text-green-600" />}
          iconBg="bg-green-50"
        />
        <StatCard
          title="Active Projects"
          value={metrics.active}
          icon={<ClipboardList className="w-4.5 h-4.5 text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Completed"
          value={metrics.completed}
          icon={<CheckCircle className="w-4.5 h-4.5 text-purple-600" />}
          iconBg="bg-purple-50"
        />
        <StatCard
          title="In Planning"
          value={metrics.planning}
          icon={<ClipboardList className="w-4.5 h-4.5 text-yellow-600" />}
          iconBg="bg-yellow-50"
        />
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by project name or manager…"
            className="w-full h-9 pl-9 pr-4 bg-white border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="All Statuses"
          options={[
            { value: 'PLANNING', label: 'Planning' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'ON_HOLD', label: 'On Hold' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
        {hasFilters && (
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('');
            }}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Grid or empty/loading state */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-52 bg-gray-100 rounded-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
          <p className="text-sm font-medium text-gray-900">No projects found</p>
          <p className="text-xs text-gray-400">
            {hasFilters ? 'Try adjusting your filters' : 'Create your first project to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => router.push(`/${tenantSlug}/hr/projects/${project.id}`)}
              onDelete={
                canManageProjects
                  ? () => setDeleteTarget({ id: project.id, name: project.name })
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {canManageProjects && (
        <CreateProjectPanel
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          employees={employees}
          onSubmit={handleCreate}
          isSubmitting={createProject.isPending}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          projectName={deleteTarget.name}
          isDeleting={archiveProject.isPending}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
