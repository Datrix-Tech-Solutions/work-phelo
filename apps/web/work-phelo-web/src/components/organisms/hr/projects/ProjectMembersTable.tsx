'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { TableButton } from '@/components/atoms/TableButton';
import { Avatar } from '@/components/atoms/Avatar';
import { AssignProjectMemberPanel } from '@/components/organisms/hr/projects/AssignProjectMemberPanel';
import {
  useProjectMembers,
  useAddProjectMember,
  useUpdateProjectMemberRate,
  useRemoveProjectMember,
} from '@/hooks';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { useCanManageProjectTeam } from '@/hooks/hr/useCanManageProjectTeam';
import { useProjectTime } from '@/hooks/hr/useProjectTime';
import { formatHoursMinutes } from '@/lib/taskTime';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { NumberField } from '@/components/atoms/NumberField';
import type { ProjectMember } from '@/types/hr';
import { useProjectLabels } from '@/hooks/useModuleLabels';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  MEMBER: 'Member',
};

interface Props {
  projectId: string;
}

export function ProjectMembersTable({ projectId }: Props) {
  const labels = useProjectLabels();
  const toast = useToastStore((s) => s.addToast);

  const [panelOpen, setPanelOpen] = useState(false);
  const [search, setSearch] = useState('');

  const canAssign = useCanManageProjectTeam(projectId);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkRate, setBulkRate] = useState(0);
  const [removing, setRemoving] = useState<ProjectMember | null>(null);
  const { people } = useProjectTime(projectId);
  const loggedMs = (employeeId: string) => people.find((p) => p.personId === employeeId)?.ms ?? 0;

  const { data: members = [], isLoading } = useProjectMembers(projectId);
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  const updateRate = useUpdateProjectMemberRate();

  const assignedIds = useMemo(() => new Set(members.map((m) => m.employeeId)), [members]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.jobTitle?.toLowerCase().includes(q),
    );
  }, [members, search]);

  const handleAssign = async (assigned: { employeeId: string; hourlyRate?: number }[]) => {
    try {
      await Promise.all(assigned.map((data) => addMember.mutateAsync({ projectId, data })));
      setPanelOpen(false);
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const handleRate = async (employeeId: string, hourlyRate: number) => {
    try {
      await updateRate.mutateAsync({
        projectId,
        employeeId,
        hourlyRate: hourlyRate > 0 ? hourlyRate : null,
      });
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const handleRemove = async (employeeId: string) => {
    try {
      await removeMember.mutateAsync({ projectId, employeeId });
      setPicked((prev) => new Set([...prev].filter((id) => id !== employeeId)));
      setRemoving(null);
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const togglePicked = (employeeId: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  const allPicked = filtered.length > 0 && filtered.every((m) => picked.has(m.employeeId));

  const applyBulkRate = async () => {
    await Promise.all([...picked].map((employeeId) => handleRate(employeeId, bulkRate)));
    setPicked(new Set());
    setBulkRate(0);
  };

  const COLUMNS: Column<ProjectMember>[] = [
    ...(canAssign
      ? [
          {
            key: 'id' as keyof ProjectMember,
            label: '',
            width: '44px',
            render: (row: ProjectMember) => (
              <input
                type="checkbox"
                aria-label={`Select ${row.name}`}
                checked={picked.has(row.employeeId)}
                onChange={() => togglePicked(row.employeeId)}
                className="h-4 w-4 accent-brand"
              />
            ),
          },
        ]
      : []),
    {
      key: 'name',
      label: 'team member',
      width: 'minmax(200px, 1.5fr)',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} avatarUrl={row.avatarUrl} size="sm" />
          <div>
            <p className="font-medium text-gray-900">{row.name}</p>
            {row.jobTitle && <p className="text-xs text-gray-400">{row.jobTitle}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      width: '120px',
      render: (row) => (
        <span className="text-sm font-medium text-gray-700">
          {row.role === 'MANAGER' ? `${labels.singular} Lead` : (ROLE_LABELS[row.role] ?? row.role)}
        </span>
      ),
    },
    {
      key: 'hourlyRate' as keyof ProjectMember,
      label: 'Rate / hour (GHS)',
      width: '170px',
      render: (row: ProjectMember) =>
        canAssign ? (
          <div onClick={(e) => e.stopPropagation()}>
            <NumberField
              ariaLabel={`Hourly rate for ${row.name}`}
              value={row.hourlyRate ?? 0}
              onChange={() => {}}
              onBlur={(v) => {
                if (v !== (row.hourlyRate ?? 0)) handleRate(row.employeeId, v);
              }}
              placeholder="Set rate"
            />
          </div>
        ) : (
          <span className="text-sm text-gray-700">{row.hourlyRate ? row.hourlyRate : '—'}</span>
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
                <div onClick={(e) => e.stopPropagation()}>
                  <TableButton
                    variant="red"
                    onClick={() => {
                      // Their logged time would lose its rate, so ask first.
                      if (isLead) return;
                      if (loggedMs(row.employeeId) > 0) setRemoving(row);
                      else handleRemove(row.employeeId);
                    }}
                    disabled={isLead || removeMember.isPending}
                    tooltip={isLead ? `${labels.singular} lead can't be removed` : undefined}
                  >
                    Remove
                  </TableButton>
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <>
      {canAssign && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={allPicked}
              onChange={() =>
                setPicked(allPicked ? new Set() : new Set(filtered.map((m) => m.employeeId)))
              }
              className="h-4 w-4 accent-brand"
            />
            Select all
          </label>
          {picked.size > 0 && (
            <>
              <NumberField
                ariaLabel="Rate per hour for the selected members"
                placeholder="Rate / hour"
                value={bulkRate}
                onChange={setBulkRate}
              />
              <Button
                onClick={applyBulkRate}
                disabled={bulkRate <= 0}
                isLoading={updateRate.isPending}
                loadingText="Saving…"
              >
                Set rate for {picked.size}
              </Button>
            </>
          )}
        </div>
      )}

      <DataTable
        columns={COLUMNS}
        data={filtered}
        isLoading={isLoading}
        noInternalScroll
        searchPlaceholder="Search members…"
        searchValue={search}
        onSearch={setSearch}
        actionButton={
          canAssign ? { label: 'Assign Members', onClick: () => setPanelOpen(true) } : undefined
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

      {removing && (
        <Modal
          isOpen
          onClose={() => setRemoving(null)}
          title={`Remove ${removing.name}?`}
          description={`They have logged ${formatHoursMinutes(loggedMs(removing.employeeId))} on this ${labels.singularLower}. Once removed, that time has no rate: it can’t be billed or valued until they are added back with one.`}
          footer={
            <>
              <Button variant="outline" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleRemove(removing.employeeId)}
                isLoading={removeMember.isPending}
                loadingText="Removing…"
              >
                Remove
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
