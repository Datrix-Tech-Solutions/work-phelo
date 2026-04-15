'use client';

import { useState, useMemo } from 'react';
import { Search, ClipboardList, CheckCircle, Layers } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { FilterSelect } from '@/components/molecules/shared/FilterSelect';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { ProjectCard } from '@/components/molecules/ProjectCard';
import { CreateProjectPanel } from '@/components/organisms/projects/CreateProjectPanel';
import { useEmployees } from '@/hooks/useEmployees';
import { Project, CreateProjectDto } from '@/types/hr';

// TODO: replace with useProjects() hook when endpoint is ready
const DUMMY_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Website Redesign',
    description: 'Full redesign of the company website with new brand identity.',
    status: 'ACTIVE',
    startDate: '2026-01-15',
    endDate: '2026-06-30',
    budget: 45000,
    managerName: 'Kwame Mensah',
    assignedCount: 5,
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: '2',
    name: 'ERP Integration',
    description: 'Connect legacy ERP system to new cloud infrastructure.',
    status: 'PLANNING',
    startDate: '2026-03-01',
    endDate: '2026-12-31',
    budget: 120000,
    managerName: 'Ama Owusu',
    assignedCount: 3,
    createdAt: '2026-02-20T00:00:00Z',
  },
  {
    id: '3',
    name: 'Q1 Marketing Campaign',
    description: 'Social media and digital campaign for Q1 product launch.',
    status: 'COMPLETED',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    budget: 18000,
    managerName: 'Efua Asante',
    assignedCount: 2,
    createdAt: '2025-12-15T00:00:00Z',
  },
  {
    id: '4',
    name: 'Office Renovation',
    status: 'ON_HOLD',
    startDate: '2026-02-01',
    budget: 75000,
    assignedCount: 1,
    createdAt: '2026-01-28T00:00:00Z',
  },
];

interface Props {
  tenantSlug: string;
}

export function ProjectsContent({ tenantSlug }: Props) {
  void tenantSlug;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: empData } = useEmployees();
  const employees = empData?.data ?? [];

  const filtered = useMemo(() => {
    return DUMMY_PROJECTS.filter((p) => {
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
    const all = DUMMY_PROJECTS;
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
          <p className="text-sm text-gray-400 mt-0.5">
            {filtered.length} project{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setPanelOpen(true)}>+ New Project</Button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <MetricCard
          title="Total Projects"
          value={metrics.total}
          icon={Layers}
          variant="highlight"
        />
        <MetricCard
          title="Active Projects"
          value={metrics.active}
          icon={ClipboardList}
          variant="success"
        />
        <MetricCard
          title="Completed"
          value={metrics.completed}
          icon={CheckCircle}
          variant="default"
        />
        <MetricCard
          title="In Planning"
          value={metrics.planning}
          icon={ClipboardList}
          variant="warning"
        />
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-52">
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
              onAddTasks={() => console.log('Add tasks', project.id)}
              onAssignEmployees={() => console.log('Assign employees', project.id)}
              onDelete={() => console.log('Delete', project.id)}
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
