'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Employee } from '@/types/hr';

interface OffboardForm {
  employeeId: string;
  reason: string;
  offboardedAt: string;
  assetReturn: boolean;
  hrClearance: boolean;
  financeClearance: boolean;
  managerApproval: boolean;
  exitNotes: string;
}

interface OffboardEmployeePanelProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  allHrEmployees: Employee[];
  onOffboard: (data: OffboardForm) => void;
  isOffboarding: boolean;
}

export function OffboardEmployeePanel({
  isOpen,
  onClose,
  employee,
  allHrEmployees,
  onOffboard,
  isOffboarding,
}: OffboardEmployeePanelProps) {
  const offboardForm = useForm<OffboardForm>({
    defaultValues: {
      employeeId: '',
      reason: '',
      offboardedAt: '',
      assetReturn: false,
      hrClearance: false,
      financeClearance: false,
      managerApproval: false,
      exitNotes: '',
    },
  });

  const { reset } = offboardForm;

  useEffect(() => {
    if (!employee) return;
    reset({
      employeeId: employee.id,
      reason: '',
      offboardedAt: '',
      assetReturn: false,
      hrClearance: false,
      financeClearance: false,
      managerApproval: false,
      exitNotes: '',
    });
  }, [employee, reset]);

  const offboardDateValue = useWatch({ control: offboardForm.control, name: 'offboardedAt' });
  const offboardEmployeeId = useWatch({ control: offboardForm.control, name: 'employeeId' });

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Offboard Employee"
      description="Process the employee's departure from the organisation."
      width="w-[500px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() =>
              reset({
                employeeId: employee.id,
                reason: '',
                offboardedAt: '',
                assetReturn: false,
                hrClearance: false,
                financeClearance: false,
                managerApproval: false,
                exitNotes: '',
              })
            }
          >
            Reset
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Save to Draft
            </Button>
            <Button
              isLoading={isOffboarding}
              loadingText="Processing…"
              onClick={offboardForm.handleSubmit(onOffboard)}
            >
              Process Offboarding
            </Button>
          </div>
        </div>
      }
    >
      {/* Employee Selector */}
      <SearchSelect
        label="Employee"
        placeholder="Select employee"
        value={offboardEmployeeId}
        onChange={(v) => offboardForm.setValue('employeeId', v)}
        options={allHrEmployees.map((e) => ({
          value: e.id,
          label: `${e.firstName} ${e.lastName}`,
          sublabel: e.jobTitle,
        }))}
      />

      {/* Reason */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Reason</label>
        <select
          {...offboardForm.register('reason', { required: 'Reason is required' })}
          className="w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#0D2244]/20 focus:border-[#0D2244]"
        >
          <option value="">Select reason</option>
          <option value="RESIGNATION">Resignation</option>
          <option value="TERMINATION">Termination</option>
          <option value="CONTRACT_END">Contract End</option>
          <option value="RETIREMENT">Retirement</option>
        </select>
        {offboardForm.formState.errors.reason && (
          <p className="text-xs text-red-500">{offboardForm.formState.errors.reason.message}</p>
        )}
      </div>

      {/* Last Working Day */}
      <DatePicker
        label="Last Working Day"
        value={offboardDateValue}
        onChange={(v) => offboardForm.setValue('offboardedAt', v)}
        error={offboardForm.formState.errors.offboardedAt?.message}
      />

      {/* Clearance Checklist */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Clearance Checklist
        </p>
        {[
          { field: 'assetReturn' as const, label: 'Asset return completed' },
          { field: 'hrClearance' as const, label: 'HR clearance' },
          { field: 'financeClearance' as const, label: 'Finance clearance' },
          { field: 'managerApproval' as const, label: 'Manager approval' },
        ].map(({ field, label }) => (
          <label key={field} className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              {...offboardForm.register(field)}
              className="w-4 h-4 rounded accent-[#0D2244] shrink-0"
            />
            <span className="text-sm text-gray-700">{label}</span>
          </label>
        ))}
      </div>

      {/* Exit Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-bold text-gray-900">Exit Interview Notes</label>
        <textarea
          {...offboardForm.register('exitNotes')}
          rows={4}
          placeholder="Add any notes from the exit interview…"
          className="w-full border border-gray-300 rounded-input px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-[#0D2244]/20 focus:border-[#0D2244] resize-none"
        />
      </div>
    </SidePanel>
  );
}
