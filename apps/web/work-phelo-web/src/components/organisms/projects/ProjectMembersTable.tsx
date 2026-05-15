'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { AssignProjectMemberPanel } from '@/components/organisms/projects/AssignProjectMemberPanel';
import {
  useProjectMembers,
  useAddProjectMember,
  useRemoveProjectMember,
  useProject,
  useMyProfile,
  usePermission,
} from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import type { ProjectMember } from '@/types/hr';

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Project Lead',
  MEMBER: 'Member',
};

interface Props {
  projectId: string;
}

export function ProjectMembersTable({ projectId }: Props) {
  const toast = useToastStore((s) => s.addToast);

  const [panelOpen, setPanelOpen] = useState(false);
  const [search, setSearch] = useState('');

  const canManageProjects = usePermission(Permission.ASSIGN_PROJECT);
  const { data: myProfile } = useMyProfile();
  const { data: project } = useProject(projectId);
  const isProjectManager = !!(
    project?.managerId &&
    myProfile?.id &&
    project.managerId === myProfile.id
  );
  const canAssign = canManageProjects || isProjectManager;

  const { data: members = [], isLoading } = useProjectMembers(projectId);
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();

  const assignedIds = useMemo(() => new Set(members.map((m) => m.employeeId)), [members]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
        m.jobTitle?.toLowerCase().includes(q),
    );
  }, [members, search]);

  const handleAssign = async (employeeIds: string[]) => {
    try {
      await Promise.all(
        employeeIds.map((employeeId) => addMember.mutateAsync({ projectId, data: { employeeId } })),
      );
      setPanelOpen(false);
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const handleRemove = async (employeeId: string) => {
    try {
      await removeMember.mutateAsync({ projectId, employeeId });
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const COLUMNS: Column<ProjectMember>[] = [
    {
      key: 'name',
      label: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-brand">{getInitials(row.name)}</span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{row.name}</p>
            {row.jobTitle && <p className="text-xs text-gray-400">{row.jobTitle}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      label: 'Department',
      width: '180px',
      render: (row) => <span>{row.department ?? '—'}</span>,
    },
    {
      key: 'role',
      label: 'Role',
      width: '120px',
      render: (row) => (
        <span className="text-sm font-medium text-gray-700">
          {ROLE_LABELS[row.role] ?? row.role}
        </span>
      ),
    },
    ...(canAssign
      ? [
          {
            key: 'employeeId' as keyof ProjectMember,
            label: '',
            width: '80px',
            render: (row: ProjectMember) => {
              if (row.role === 'OWNER') return null;
              const isLead = row.role === 'MANAGER';
              return (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isLead) handleRemove(row.employeeId);
                  }}
                  disabled={isLead || removeMember.isPending}
                  className={
                    isLead
                      ? 'text-xs text-red-400 font-medium opacity-30 cursor-not-allowed'
                      : 'text-xs text-red-500 hover:text-red-700 font-medium'
                  }
                >
                  Remove
                </button>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={filtered}
        isLoading={isLoading}
        searchPlaceholder="Search members…"
        searchValue={search}
        onSearch={setSearch}
        actionButton={
          canAssign ? { label: '+ Assign Members', onClick: () => setPanelOpen(true) } : undefined
        }
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        emptyMessage="No members found"
      />

      {canAssign && (
        <AssignProjectMemberPanel
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          assignedIds={assignedIds}
          onAssign={handleAssign}
          isAssigning={addMember.isPending}
        />
      )}
    </>
  );
}
