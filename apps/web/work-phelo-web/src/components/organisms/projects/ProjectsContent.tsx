'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ClipboardList, CheckCircle, Layers } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { FilterSelect } from '@/components/molecules/shared/FilterSelect';
import { ProjectCard } from '@/components/molecules/ProjectCard';
import { CreateProjectPanel } from '@/components/organisms/projects/CreateProjectPanel';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { Project, CreateProjectDto } from '@/types/hr';
import { StatCard } from '@/components/molecules/shared/StatCard';

const projects: Project[] = [];

interface Props {
  tenantSlug: string;
}

export function ProjectsContent({ tenantSlug }: Props) {
  const router = useRouter();
  // const canCreateProject = usePermission(Permission.CREATE_PROJECT);
  // const canUpdateProject = usePermission(Permission.UPDATE_PROJECT);
  // const canAssignProject = usePermission(Permission.ASSIGN_PROJECT);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: employees = [] } = useEmployeeOptions();

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
  }, [search, statusFilter]);

  const metrics = useMemo(() => {
    const all = projects;
    return {
      total: all.length,
      active: all.filter((p) => p.status === 'ACTIVE').length,
      completed: all.filter((p) => p.status === 'COMPLETED').length,
      planning: all.filter((p) => p.status === 'PLANNING').length,
    };
  }, []);

  const hasFilters = !!(search || statusFilter);

  const handleCreate = (data: CreateProjectDto) => {
    // TODO: POST /hr/projects
    console.log('Create project:', data);
    setPanelOpen(false);
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Projects & Tasks</h1>
        </div>
        <Button onClick={() => setPanelOpen(true)}>+ New Project</Button>
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
            className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
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

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
          <p className="text-sm font-medium text-gray-900">No projects found</p>
          <p className="text-xs text-gray-400">
            {hasFilters ? 'Try adjusting your filters' : 'Create your first project to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto items-start">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => router.push(`/${tenantSlug}/hr/projects/${project.id}`)}
              onDelete={() => console.log('Delete project', project.id)}
            />
          ))}
        </div>
      )}

      <CreateProjectPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        employees={employees}
        onSubmit={handleCreate}
      />
    </>
  );
}
