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
import { useAppraisalGoalsStore, type Goal, type GoalInput } from '@/store/appraisalGoals.store';

export function GoalsContent() {
  const toast = useToast();
  const { data: employeeData } = useAllEmployees();
  const employees = useMemo(() => employeeData?.data ?? [], [employeeData]);

  const goals = useAppraisalGoalsStore((s) => s.goals);
  const addGoal = useAppraisalGoalsStore((s) => s.addGoal);
  const updateGoal = useAppraisalGoalsStore((s) => s.updateGoal);
  const removeGoal = useAppraisalGoalsStore((s) => s.removeGoal);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ goal?: Goal } | null>(null);
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

  const save = (input: GoalInput) => {
    if (modal?.goal) {
      updateGoal(modal.goal.id, input);
      toast.success(`Saved "${input.name}"`);
    } else {
      addGoal(input);
      toast.success(`Created "${input.name}"`);
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    removeGoal(target.id);
    toast.success(`Deleted "${target.name}"`);
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
          { label: 'Edit', onClick: () => setModal({ goal: g }) },
          { label: 'Delete', onClick: () => setDeleting(g), danger: true },
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

      <ConfirmModal
        isOpen={deleting !== null}
        title="Delete goal"
        description={`Delete "${deleting?.name ?? ''}"? Employees will no longer be appraised on it.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
