'use client';

import { useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { ConfirmModal } from '@/components/organisms/hr/payroll/pay-components/ConfirmModal';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { useToast } from '@/hooks/useToast';
import {
  CreateGoalModal,
  eligibleEmployees,
} from '@/components/organisms/hr/appraisal/CreateGoalModal';
import { useDeleteGoal, useGoals, useSaveGoal } from '@/hooks/hr/useGoalAppraisals';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { SetGoalObjectivePanel } from '@/components/organisms/hr/appraisal/SetGoalObjectivePanel';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import type { Goal, GoalInput, GoalObjectiveDraft } from '@/types/appraisal';

export function GoalsContent() {
  const toast = useToast();
  const { data: employeeData } = useAllEmployees();
  const employees = useMemo(() => employeeData?.data ?? [], [employeeData]);

  const { goals } = useGoals();
  const saveGoal = useSaveGoal();
  const deleteGoal = useDeleteGoal();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ goal?: Goal } | null>(null);
  const canCreateObjectives = usePermission(Permission.CREATE_OBJECTIVE_FOR_OTHERS);
  const [objectivesFor, setObjectivesFor] = useState<{ goal: Goal; key: number } | null>(null);
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [deleting, setDeleting] = useState<Goal | null>(null);

  const rows = useMemo(
    () => goals.filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase())),
    [goals, search],
  );

  const columns: Column<Goal>[] = [
    {
      key: 'name',
      label: 'Goal',
      render: (g) => <span className="font-medium text-gray-900">{g.name}</span>,
    },
    {
      key: 'self',
      label: 'Self assessment',
      render: (g) => <span className="tabular-nums">{g.selfAssessmentWeight}%</span>,
    },
    {
      key: 'manager',
      label: 'Manager assessment',
      render: (g) => <span className="tabular-nums">{g.managerAssessmentWeight}%</span>,
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
  ];

  const save = (input: GoalInput, objectives: GoalObjectiveDraft[]) => {
    const editing = modal?.goal;
    saveGoal.mutate(
      { id: editing?.id, input, objectives },
      {
        onSuccess: () => toast.success(`${editing ? 'Saved' : 'Created'} "${input.name}"`),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    deleteGoal.mutate(target.id, {
      onSuccess: () => toast.success(`Deleted "${target.name}"`),
    });
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search goals..."
        searchValue={search}
        onSearch={setSearch}
        actionButton={{ label: 'Create goal', onClick: () => setModal({}) }}
        onRowClick={(g) => setModal({ goal: g })}
        rowActions={(g) => [
          {
            label: 'View objectives',
            onClick: () => router.push(`/${tenantSlug}/hr/appraisal/settings/goals/${g.id}`),
          },
          ...(canCreateObjectives
            ? [
                {
                  label: 'Create objectives',
                  onClick: () =>
                    g.employeeIds.length === 0
                      ? toast.error('Add employees to this goal first')
                      : setObjectivesFor((prev) => ({ goal: g, key: (prev?.key ?? 0) + 1 })),
                },
              ]
            : []),
          { label: 'Edit', onClick: () => setModal({ goal: g }) },
          {
            label: 'Delete',
            onClick: () =>
              g.inCycle
                ? toast.error('This goal is part of a cycle and cannot be deleted')
                : setDeleting(g),
            danger: true,
          },
        ]}
        emptyMessage="No goals yet. Create one to choose who it applies to."
        currentPage={1}
        totalPages={1}
        onPageChange={() => undefined}
        noInternalScroll
      />

      {modal && (
        <CreateGoalModal
          key={modal.goal?.id ?? 'new'}
          isOpen
          onClose={() => setModal(null)}
          employees={employees}
          goal={modal.goal}
          onSave={save}
        />
      )}

      {objectivesFor && (
        <SetGoalObjectivePanel
          key={objectivesFor.key}
          isOpen
          onClose={() => setObjectivesFor(null)}
          goalId={objectivesFor.goal.id}
          goalName={objectivesFor.goal.name}
          members={eligibleEmployees(employees).filter((e) =>
            objectivesFor.goal.employeeIds.includes(e.id),
          )}
        />
      )}

      <ConfirmModal
        isOpen={deleting !== null}
        title="Delete goal"
        description={`Delete "${deleting?.name ?? ''}"? Objectives written under it are kept but no longer belong to a goal.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
