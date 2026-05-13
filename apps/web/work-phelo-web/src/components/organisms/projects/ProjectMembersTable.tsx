'use client';

import { useState, useMemo } from 'react';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { AssignProjectMemberPanel } from '@/components/organisms/projects/AssignProjectMemberPanel';

interface ProjectMember {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  department?: string;
  taskCompletion: number;
}

const COLUMNS: Column<ProjectMember>[] = [
  {
    key: 'name',
    label: 'Employee Name',
    render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-brand">
            {row.firstName[0]}
            {row.lastName[0]}
          </span>
        </div>
        <div>
          <p className="font-medium text-gray-900">
            {row.firstName} {row.lastName}
          </p>
          {row.jobTitle && <p className="text-xs text-gray-400">{row.jobTitle}</p>}
        </div>
      </div>
    ),
  },
  {
    key: 'department',
    label: 'Department',
    width: '200px',
    render: (row) => <span>{row.department ?? '—'}</span>,
  },
  {
    key: 'taskCompletion',
    label: 'Task Completion',
    width: '240px',
    render: (row) => <ProgressBar value={row.taskCompletion} />,
  },
];

export function ProjectMembersTable() {
  const [members] = useState<ProjectMember[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [search, setSearch] = useState('');

  const assignedIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
        m.jobTitle?.toLowerCase().includes(q),
    );
  }, [members, search]);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={filtered}
        searchPlaceholder="Search members…"
        searchValue={search}
        onSearch={setSearch}
        actionButton={{ label: '+ Assign Members', onClick: () => setPanelOpen(true) }}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        emptyMessage="No members found"
      />

      <AssignProjectMemberPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        assignedIds={assignedIds}
        onAssign={(employeeIds) => {
          // TODO: POST /hr/projects/:id/members
          console.log('Assign members', employeeIds);
          setPanelOpen(false);
        }}
      />
    </>
  );
}
