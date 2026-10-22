'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { TypeChip } from '@/components/atoms/TypeChip';
import { ConfirmModal } from '@/components/organisms/hr/payroll/pay-components/ConfirmModal';
import { usePayrollGroups } from '@/hooks/hr/usePayrollGroups';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import {
  payrollConfigurationError,
  usePayrollConfigurations,
} from '@/hooks/hr/usePayrollConfigurations';
import { useToast } from '@/hooks/useToast';
import {
  FREQUENCY_LABELS,
  describePayday,
  describeReminder,
  type PayrollGroup,
  toGroupInput,
  type GroupSettings,
} from '@/lib/payroll-groups';
import { PAYSLIP_TYPES, versionInForce } from '@/lib/payroll-engine';
import { isOnPayroll } from '@/components/organisms/hr/payroll/run-payroll/runRows';
import { PayrollGroupMembersPanel } from './PayrollGroupMembersPanel';
import { PayrollGroupScheduleModal } from './PayrollGroupScheduleModal';

export function PayrollGroupsContent() {
  const toast = useToast();
  const store = usePayrollGroups();
  const configStore = usePayrollConfigurations();
  const { data: employeeData } = useAllEmployees();
  const employees = employeeData?.data ?? [];

  const [search, setSearch] = useState('');
  const [managing, setManaging] = useState<{
    group: PayrollGroup;
    kind: 'members' | 'reminders';
  } | null>(null);
  const [deleting, setDeleting] = useState<PayrollGroup | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // People on payroll with no group can't be paid, so they are named here, where groups are made.
  const withoutGroup = employees.filter((e) => isOnPayroll(e) && !e.payrollGroupId);

  const rows = useMemo(
    () => store.groups.filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase())),
    [store.groups, search],
  );

  const columns: Column<PayrollGroup>[] = [
    {
      key: 'name',
      label: 'Group',
      render: (g) => <span className="font-medium text-gray-900">{g.name}</span>,
    },
    { key: 'frequency', label: 'Pay frequency', render: (g) => FREQUENCY_LABELS[g.frequency] },
    { key: 'payday', label: 'Payday', render: (g) => describePayday(g.payday) },
    {
      key: 'employees',
      label: 'Employees',
      render: (g) => <span className="tabular-nums">{g.employeeCount}</span>,
    },
    {
      key: 'configuration',
      label: 'Configuration',
      render: (g) => {
        const configuration = configStore.configurations.find((c) => c.id === g.configurationId);
        if (!configuration) {
          return <TypeChip label={configStore.isLoading ? 'Loading' : 'Not found'} color="amber" />;
        }
        const inForce = versionInForce(configuration);
        return (
          <span className="flex flex-col gap-1">
            <span className="text-sm text-gray-900">{configuration.name}</span>
            <span className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {configuration.payslipType && (
                <TypeChip label={PAYSLIP_TYPES[configuration.payslipType].label} color="blue" />
              )}
              {inForce ? `Version ${inForce.version} in force` : 'Not in force yet'}
            </span>
          </span>
        );
      },
    },
    { key: 'reminder', label: 'Payday reminder', render: (g) => describeReminder(g.reminder) },
  ];

  const saveMembers = async (group: PayrollGroup, employeeIds: string[]) => {
    setSaveError(null);
    try {
      await store.setEmployees(group.id, employeeIds);
      setManaging(null);
      toast.success(`Saved the members of "${group.name}"`);
    } catch (e) {
      setSaveError(payrollConfigurationError(e, 'Could not save the members'));
    }
  };

  const saveSchedule = async (
    group: PayrollGroup,
    schedule: Pick<GroupSettings, 'frequency' | 'payday' | 'reminder'>,
  ) => {
    setSaveError(null);
    try {
      await store.save({ ...toGroupInput(group), ...schedule });
      setManaging(null);
      toast.success(`Saved the reminders of "${group.name}"`);
    } catch (e) {
      setSaveError(payrollConfigurationError(e, 'Could not save the reminders'));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    try {
      await store.remove(target.id);
      toast.success(`Deleted "${target.name}"`);
    } catch (e) {
      toast.error(payrollConfigurationError(e, 'Could not delete the group'));
    }
  };

  return (
    <>
      {withoutGroup.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {withoutGroup.length} {withoutGroup.length === 1 ? 'employee has' : 'employees have'} no
            payroll group (
            {withoutGroup
              .slice(0, 6)
              .map((e) => `${e.firstName} ${e.lastName}`)
              .join(', ')}
            {withoutGroup.length > 6 ? `, and ${withoutGroup.length - 6} more` : ''}). Use Manage
            members on a group to add them, so nobody is left out of payroll.
          </p>
        </div>
      )}
      <DataTable
        columns={columns}
        data={rows}
        isLoading={store.isLoading}
        searchPlaceholder="Search groups..."
        searchValue={search}
        onSearch={setSearch}
        onRowClick={(g) => setManaging({ group: g, kind: 'members' })}
        rowActions={(g) => [
          { label: 'Manage members', onClick: () => setManaging({ group: g, kind: 'members' }) },
          {
            label: 'Manage reminders',
            onClick: () => setManaging({ group: g, kind: 'reminders' }),
          },
          { label: 'Delete', onClick: () => setDeleting(g), danger: true },
        ]}
        emptyMessage="No payroll groups yet. Saving a configuration under Pay Components creates one."
        currentPage={1}
        totalPages={1}
        onPageChange={() => undefined}
        noInternalScroll
      />

      {managing?.kind === 'members' && (
        <PayrollGroupMembersPanel
          key={managing.group.id}
          group={managing.group}
          groups={store.groups}
          configurations={configStore.configurations}
          employees={employees}
          onClose={() => {
            setManaging(null);
            setSaveError(null);
          }}
          isSaving={store.isSaving}
          error={saveError}
          onSave={(ids) => saveMembers(managing.group, ids)}
        />
      )}

      {managing?.kind === 'reminders' && (
        <PayrollGroupScheduleModal
          key={managing.group.id}
          group={managing.group}
          onClose={() => {
            setManaging(null);
            setSaveError(null);
          }}
          isSaving={store.isSaving}
          error={saveError}
          onSave={(schedule) => saveSchedule(managing.group, schedule)}
        />
      )}

      <ConfirmModal
        isOpen={deleting !== null}
        title="Delete payroll group"
        description={`Delete "${deleting?.name ?? ''}"? ${deleting && deleting.employeeCount > 0 ? `${deleting.employeeCount} ${deleting.employeeCount === 1 ? 'employee' : 'employees'} in it will be left without a group. ` : ''}Payroll can't include employees who have no group.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
