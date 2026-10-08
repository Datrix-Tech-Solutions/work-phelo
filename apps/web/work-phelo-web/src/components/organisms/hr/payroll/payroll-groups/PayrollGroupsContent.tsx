'use client';

import { useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { TypeChip } from '@/components/atoms/TypeChip';
import { ConfirmModal } from '@/components/organisms/hr/payroll/pay-components/ConfirmModal';
import { usePayrollGroups } from '@/hooks/hr/usePayrollGroups';
import { usePayrollConfigurations } from '@/hooks/hr/usePayrollConfigurations';
import { useToast } from '@/hooks/useToast';
import {
  FREQUENCY_LABELS,
  describePayday,
  describeReminder,
  type PayrollGroup,
  type PayrollGroupInput,
} from '@/lib/payroll-groups';
import { PAYSLIP_TYPES, versionInForce } from '@/lib/payroll-engine';
import { PayrollGroupPanel } from './PayrollGroupPanel';

export function PayrollGroupsContent({ tenantSlug }: { tenantSlug: string }) {
  const toast = useToast();
  const store = usePayrollGroups(tenantSlug);
  const configStore = usePayrollConfigurations();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<PayrollGroup | 'new' | null>(null);
  const [deleting, setDeleting] = useState<PayrollGroup | null>(null);

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

  const save = (input: PayrollGroupInput) => {
    store.save(input);
    setEditing(null);
    toast.success(input.id ? `Saved "${input.name.trim()}"` : `Created "${input.name.trim()}"`);
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search groups..."
        searchValue={search}
        onSearch={setSearch}
        actionButton={{ label: 'New Payroll Group', onClick: () => setEditing('new') }}
        onRowClick={(g) => setEditing(g)}
        rowActions={(g) => [
          { label: 'Edit group', onClick: () => setEditing(g) },
          { label: 'Delete', onClick: () => setDeleting(g), danger: true },
        ]}
        emptyMessage="No payroll groups yet. Create one to say who is paid, how often and with which configuration."
        currentPage={1}
        totalPages={1}
        onPageChange={() => undefined}
        noInternalScroll
      />

      {editing && (
        <PayrollGroupPanel
          key={editing === 'new' ? 'new' : editing.id}
          group={editing === 'new' ? null : editing}
          groups={store.groups}
          configurations={configStore.configurations}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}

      <ConfirmModal
        isOpen={deleting !== null}
        title="Delete payroll group"
        description={`Delete "${deleting?.name ?? ''}"? Employees in it will need another group before payroll can include them.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) store.remove(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}
