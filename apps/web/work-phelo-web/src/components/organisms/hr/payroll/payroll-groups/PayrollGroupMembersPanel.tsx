'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { type PayrollGroup } from '@/lib/payroll-groups';
import { type SavedConfiguration } from '@/lib/payroll-engine';
import type { Employee } from '@/types/hr';
import { PayrollGroupMemberFields, eligibleEmployees } from './PayrollGroupFields';

interface PayrollGroupMembersPanelProps {
  group: PayrollGroup;
  groups: PayrollGroup[];
  configurations: SavedConfiguration[];
  employees: Employee[];
  onClose: () => void;
  isSaving: boolean;
  /** Why the last save failed, from the server. */
  error: string | null;
  onSave: (employeeIds: string[]) => void;
}

/** Add or remove a payroll group's employees, and nothing else about the group. */
export function PayrollGroupMembersPanel({
  group,
  groups,
  configurations,
  employees,
  onClose,
  isSaving,
  error,
  onSave,
}: PayrollGroupMembersPanelProps) {
  const payslipType =
    configurations.find((c) => c.id === group.configurationId)?.payslipType ?? null;
  const [memberIds, setMemberIds] = useState<string[]>(() =>
    employees.filter((e) => e.payrollGroupId === group.id).map((e) => e.id),
  );

  const save = () => {
    const eligible = eligibleEmployees(employees, payslipType);
    onSave(memberIds.filter((id) => eligible.some((e) => e.id === id)));
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Manage members"
      description={`Who is paid in ${group.name}.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} isLoading={isSaving} loadingText="Saving…">
            Save members
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <PayrollGroupMemberFields
          settings={{
            frequency: group.frequency,
            payday: group.payday,
            reminder: group.reminder,
            memberIds,
          }}
          onChange={(next) => setMemberIds(next.memberIds)}
          payslipType={payslipType}
          employees={employees}
          groups={groups}
          groupId={group.id}
        />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {!payslipType && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This group&apos;s configuration has no payslip type, so no one can be added. Open the
            group and choose a configuration.
          </p>
        )}
      </div>
    </SidePanel>
  );
}
