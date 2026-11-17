'use client';

import { useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { ConfirmModal } from '@/components/organisms/hr/payroll/pay-components/ConfirmModal';
import { PerformanceGroupModal } from '@/components/organisms/hr/appraisal/PerformanceGroupModal';
import { eligibleEmployees } from '@/components/organisms/hr/appraisal/CreateGoalModal';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { useGoals } from '@/hooks/hr/useGoalAppraisals';
import {
  useDeleteGroup,
  usePerformanceGroups,
  useSaveGroup,
} from '@/hooks/hr/usePerformanceGroups';
import { useToast } from '@/hooks/useToast';
import { groupProblems } from '@/lib/performanceGroups';
import type { PerformanceGroup, PerformanceGroupInput } from '@/types/appraisal';

export function PerformanceGroupsContent() {
  const toast = useToast();
  const { data: employeeData } = useAllEmployees();
  const employees = useMemo(() => employeeData?.data ?? [], [employeeData]);
  const { goals } = useGoals();
  const { groups } = usePerformanceGroups();
  const saveGroup = useSaveGroup();
  const removeGroup = useDeleteGroup();

  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ group?: PerformanceGroup } | null>(null);
  const [deleting, setDeleting] = useState<PerformanceGroup | null>(null);

  const rows = useMemo(
    () => groups.filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase())),
    [groups, search],
  );

  const columns: Column<PerformanceGroup>[] = [
    {
      key: 'name',
      label: 'Group',
      render: (g) => <span className="font-medium text-gray-900">{g.name}</span>,
    },
    {
      key: 'employees',
      label: 'Employees',
      render: (g) => (
        <span className="tabular-nums">
          {
            g.employeeIds.filter((id) => eligibleEmployees(employees).some((e) => e.id === id))
              .length
          }
        </span>
      ),
    },
    {
      key: 'goals',
      label: 'Goals and weights',
      render: (g) => (
        <span className="text-sm text-gray-700">
          {g.goals
            .map(
              (x) =>
                `${goals.find((goal) => goal.id === x.goalId)?.name ?? 'Deleted goal'} ${x.weight}%`,
            )
            .join(' · ')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (g) => {
        const problems = goals.length === 0 ? [] : groupProblems(g, goals);
        return problems.length === 0 ? (
          <span className="text-sm text-green-600">Ready</span>
        ) : (
          <span className="text-sm text-amber-600" title={problems.join('\n')}>
            {problems[0]}
            {problems.length > 1 ? ` (+${problems.length - 1})` : ''}
          </span>
        );
      },
    },
  ];

  const save = (input: PerformanceGroupInput) => {
    const editing = modal?.group;
    saveGroup.mutate(
      { id: editing?.id, input },
      { onSuccess: () => toast.success(`${editing ? 'Saved' : 'Created'} "${input.name}"`) },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    removeGroup.mutate(target.id, {
      onSuccess: () => toast.success(`Deleted "${target.name}"`),
    });
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search groups..."
        searchValue={search}
        onSearch={setSearch}
        actionButton={{ label: 'Create group', onClick: () => setModal({}) }}
        onRowClick={(g) => setModal({ group: g })}
        rowActions={(g) => [
          { label: 'Edit', onClick: () => setModal({ group: g }) },
          {
            label: 'Delete',
            onClick: () =>
              g.inCycle
                ? toast.error('This group is used by a cycle and cannot be deleted')
                : setDeleting(g),
            danger: true,
          },
        ]}
        emptyMessage="No groups yet. Create one to choose who is scored on which goals."
        currentPage={1}
        totalPages={1}
        onPageChange={() => undefined}
        noInternalScroll
      />

      {modal && (
        <PerformanceGroupModal
          key={modal.group?.id ?? 'new'}
          isOpen
          onClose={() => setModal(null)}
          employees={employees}
          goals={goals}
          groups={groups}
          group={modal.group}
          onSave={save}
        />
      )}

      <ConfirmModal
        isOpen={deleting !== null}
        title="Delete group"
        description={`Delete "${deleting?.name ?? ''}"? The goals and the employees are not affected.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
