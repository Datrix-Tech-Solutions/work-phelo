'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import {
  Employee,
  UpdateEmployeePayload,
  EmploymentType,
  EmploymentStatus,
  Gender,
} from '@/types/hr';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { MonthPicker } from '@/components/atoms/endDatePicker';
import { useDepartmentOptions } from '@/hooks/useDepartments';
import { useBranchOptions } from '@/hooks/useBranches';

interface EditEmployeePanelProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  employees?: Employee[];
  name: string;
  onSave: (data: UpdateEmployeePayload) => void;
  isUpdating: boolean;
}

export function EditEmployeePanel({
  isOpen,
  onClose,
  employee,
  employees = [],
  name,
  onSave,
  isUpdating,
}: EditEmployeePanelProps) {
  const editForm = useForm<UpdateEmployeePayload>();
  const { reset } = editForm;
  const { data: departments = [] } = useDepartmentOptions(isOpen);
  const { data: branches = [] } = useBranchOptions(isOpen);

  const [salaryCurrency, setSalaryCurrency] = useState('GHS');

  // Watch values for controlled components
  const editDobValue = useWatch({ control: editForm.control, name: 'dateOfBirth' });
  const editDeptValue = useWatch({ control: editForm.control, name: 'departmentId' });
  const editBranchValue = useWatch({ control: editForm.control, name: 'branchId' });
  const editManagerValue = useWatch({ control: editForm.control, name: 'managerId' });
  const editTypeValue = useWatch({ control: editForm.control, name: 'employmentType' });
  const editStatusValue = useWatch({ control: editForm.control, name: 'employmentStatus' });
  const editGenderValue = useWatch({ control: editForm.control, name: 'gender' });
  const basicSalaryValue = useWatch({ control: editForm.control, name: 'basicSalary' });
  const probationValue = useWatch({ control: editForm.control, name: 'probationEndsAt' });
  const contractEndValue = useWatch({ control: editForm.control, name: 'contractEndDate' });

  // Reset form when employee data changes
  useEffect(() => {
    if (!employee) return;
    reset({
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone ?? '',
      jobTitle: employee.jobTitle,
      departmentId: employee.departmentId ?? '',
      branchId: employee.branchId ?? '',
      managerId: employee.managerId ?? '',
      employmentType: employee.employmentType,
      employmentStatus: employee.employmentStatus,
      dateOfBirth: employee.dateOfBirth ?? '',
      gender: employee.gender ?? undefined,
      maritalStatus: employee.maritalStatus ?? undefined,
      nationality: employee.nationality ?? '',
      nationalId: employee.nationalId ?? '',
      address: employee.address ?? '',
      city: employee.city ?? '',
      region: employee.region ?? '',
      emergencyName: employee.emergencyName ?? '',
      emergencyPhone: employee.emergencyPhone ?? '',
      emergencyRelation: employee.emergencyRelation ?? '',
      basicSalary: employee.basicSalary,
      bankName: employee.bankName ?? '',
      bankAccountNumber: employee.bankAccountNumber ?? '',
      bankBranch: employee.bankBranch ?? '',
      ssnit: employee.ssnit ?? '',
      tinNumber: employee.tinNumber ?? '',
      probationEndsAt: employee.probationEndsAt ?? '',
      contractEndDate: employee.contractEndDate ?? '',
    });
  }, [employee, reset]);

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Employee"
      description={`Editing ${name}`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={isUpdating}
            loadingText="Saving…"
            onClick={editForm.handleSubmit((data) => {
              const dateFields = ['dateOfBirth'] as const;
              for (const field of dateFields) {
                if (!data[field]) data[field] = undefined;
              }
              const monthFields = ['probationEndsAt', 'contractEndDate'] as const;
              for (const field of monthFields) {
                if (!data[field]) {
                  data[field] = undefined;
                } else if (data[field]!.length === 7) {
                  data[field] = `${data[field]}-01`;
                }
              }
              const relationFields = ['departmentId', 'branchId', 'managerId'] as const;
              for (const field of relationFields) {
                if (!data[field]) data[field] = undefined;
              }
              onSave(data);
            })}
          >
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Personal Information
        </p>
        <FormField
          label="First Name"
          registration={editForm.register('firstName', { required: 'Required' })}
          error={editForm.formState.errors.firstName}
          placeholder="eg; Kofi"
        />
        <FormField
          label="Last Name"
          registration={editForm.register('lastName', { required: 'Required' })}
          error={editForm.formState.errors.lastName}
          placeholder="eg; Boateng"
        />

        <DatePicker
          label="Date of Birth"
          value={editDobValue}
          onChange={(v) => editForm.setValue('dateOfBirth', v)}
          disableFuture
        />
        <SearchSelect
          label="Gender"
          placeholder="Select gender"
          value={editGenderValue}
          onChange={(v) => editForm.setValue('gender', v as Gender)}
          options={[
            { value: 'MALE', label: 'Male' },
            { value: 'FEMALE', label: 'Female' },
          ]}
        />
        <FormField
          label="Address"
          registration={editForm.register('address')}
          placeholder="eg; 12 Accra Road"
        />
        <FormField label="City" registration={editForm.register('city')} placeholder="eg; Accra" />
        <FormField
          label="Region"
          registration={editForm.register('region')}
          placeholder="eg; Greater Accra"
        />
      </div>
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Job Information
        </p>
        <FormField
          label="Job Title"
          registration={editForm.register('jobTitle', { required: 'Required' })}
          error={editForm.formState.errors.jobTitle}
          placeholder="eg; UI/UX Engineer"
        />
        <SearchSelect
          label="Department"
          placeholder="Select department"
          value={editDeptValue}
          onChange={(v) => editForm.setValue('departmentId', v)}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
        {branches.length > 0 && (
          <SearchSelect
            label="Branch"
            placeholder="Select branch (optional)"
            value={editBranchValue}
            onChange={(v) => editForm.setValue('branchId', v)}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
        {employees.length > 0 && (
          <SearchSelect
            label="Reporting Manager"
            placeholder="Select manager (optional)"
            value={editManagerValue}
            onChange={(v) => editForm.setValue('managerId', v)}
            options={employees
              .filter((e) => e.id !== employee.id)
              .map((e) => ({
                value: e.id,
                label: `${e.firstName} ${e.lastName}`,
                sublabel: e.jobTitle,
              }))}
          />
        )}
        <SearchSelect
          label="Employment Type"
          placeholder="Select type"
          value={editTypeValue}
          onChange={(v) => editForm.setValue('employmentType', v as EmploymentType)}
          options={[
            { value: 'FULL_TIME', label: 'Full Time' },
            { value: 'PART_TIME', label: 'Part Time' },
            { value: 'CONTRACT', label: 'Contract' },
            { value: 'INTERN', label: 'Intern' },
          ]}
        />
        <SearchSelect
          label="Employment Status"
          placeholder="Select status"
          value={editStatusValue}
          onChange={(v) => editForm.setValue('employmentStatus', v as EmploymentStatus)}
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'PROBATION', label: 'Probation' },
            { value: 'SUSPENDED', label: 'Suspended' },
          ]}
        />
        {editTypeValue !== 'CONTRACT' && (
          <MonthPicker
            label="Probation End Date"
            value={probationValue}
            onChange={(v) => editForm.setValue('probationEndsAt', v)}
            disablePast={true}
          />
        )}
        {editTypeValue === 'CONTRACT' && (
          <MonthPicker
            label="Contract End Date"
            value={contractEndValue}
            onChange={(v) => editForm.setValue('contractEndDate', v)}
            disablePast={true}
          />
        )}
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Banking & Compliance
        </p>
        <CurrencyInput
          label="Basic Salary"
          value={basicSalaryValue}
          currency={salaryCurrency}
          onValueChange={(v) => editForm.setValue('basicSalary', parseFloat(v) || undefined)}
          onCurrencyChange={setSalaryCurrency}
          placeholder="0.00"
        />
      </div>
    </SidePanel>
  );
}
