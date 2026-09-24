'use client';

import { UseFormReturn } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { EmployeeOption } from '@/types/hr';
import { BranchOption } from '@/hooks/hr/useBranches';

export interface DeptForm {
  name: string;
  description?: string;
  managerId?: string;
  branchId?: string;
}

interface DepartmentFormFieldsProps {
  form: UseFormReturn<DeptForm>;
  employees: EmployeeOption[];
  branches: BranchOption[];
}

export function DepartmentFormFields({ form, employees, branches }: DepartmentFormFieldsProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const selectedManagerId = watch('managerId');
  const selectedBranchId = watch('branchId');

  const managerOptions = employees.map((emp) => ({
    value: emp.id,
    label: `${emp.firstName} ${emp.lastName}`,
    sublabel: emp.jobTitle || undefined,
  }));

  return (
    <>
      <FormField
        label="Department Name"
        registration={register('name', { required: 'Department name is required' })}
        error={errors.name}
        placeholder="e.g. Human Resources"
      />

      <FormField
        label="Description"
        registration={register('description')}
        placeholder="Brief description of the department (optional)"
      />

      <SearchSelect
        label="Department Head"
        placeholder="Select Department Head"
        value={selectedManagerId || ''}
        onChange={(value) => setValue('managerId', value)}
        options={managerOptions}
      />

      <SearchSelect
        label="Branch"
        placeholder="Select branch (defaults to head office)"
        value={selectedBranchId || ''}
        onChange={(value) => setValue('branchId', value)}
        options={branches.map((b) => ({ value: b.id, label: b.name }))}
      />

      {employees.length === 0 && (
        <p className="text-xs text-amber-600 mt-1">
          No employees available yet. Please add some employees first before selecting a department
          head.
        </p>
      )}
    </>
  );
}
