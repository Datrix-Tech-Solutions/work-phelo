'use client';

import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import { CollapsibleSection } from '@/components/organisms/hr/payroll/payroll-groups/PayrollGroupFields';
import { useDepartmentOptions } from '@/hooks/hr/useDepartments';
import { useGoals } from '@/hooks/hr/useGoalAppraisals';
import type { Employee, EmploymentType } from '@/types/hr';
import type { Goal, GoalInput } from '@/types/appraisal';

interface FormValues {
  name: string;
  selfAssessmentWeight: number | '';
  managerAssessmentWeight: number | '';
}

const EMPLOYMENT_TYPE_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERN', label: 'Intern' },
];

/** '' is nothing chosen yet; 'all' is the explicit "All ..." choice, which doesn't narrow. */
const narrows = (filter: string) => filter !== '' && filter !== 'all';

/** Only employees who can be appraised can be given a goal. */
export function eligibleEmployees(employees: Employee[]) {
  return employees.filter(
    (e) => e.employmentStatus === 'ACTIVE' || e.employmentStatus === 'PROBATION',
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onSave: (goal: GoalInput) => void;
  /** The goal being edited; leave out to create one. Remount (key) when it changes. */
  goal?: Goal;
}

export function CreateGoalModal({ isOpen, onClose, employees, onSave, goal }: Props) {
  const otherGoals = useGoals().goals.filter((g) => g.id !== goal?.id);
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: goal?.name ?? '',
      selfAssessmentWeight: goal?.selfAssessmentWeight ?? '',
      managerAssessmentWeight: goal?.managerAssessmentWeight ?? '',
    },
  });
  const selfWeightRaw = useWatch({ control, name: 'selfAssessmentWeight' });

  const { data: departments = [] } = useDepartmentOptions();
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>(goal?.employeeIds ?? []);

  const eligible = eligibleEmployees(employees);
  const matching = (dept: string, type: string) =>
    eligible.filter(
      (e) =>
        (!narrows(dept) || e.departmentId === dept) &&
        (!narrows(type) || e.employmentType === type),
    );
  // Choosing a department or type picks everyone it covers; the list below then adjusts it.
  const pick = (dept: string, type: string) => {
    setDepartment(dept);
    setEmploymentType(type);
    if (dept === '' && type === '') return;
    const picked = matching(dept, type).map((e) => e.id);
    setMemberIds((prev) => [...new Set([...prev, ...picked])]);
  };
  const validMembers = memberIds.filter((id) => eligible.some((e) => e.id === id));

  const handleClose = () => {
    reset();
    onClose();
  };

  // Manager weight is derived from the self weight so the two always add up to 100%.
  useEffect(() => {
    if (selfWeightRaw === '' || selfWeightRaw == null) {
      setValue('managerAssessmentWeight', '', { shouldValidate: true });
      return;
    }
    const clamped = Math.min(100, Math.max(0, Number(selfWeightRaw)));
    setValue('managerAssessmentWeight', 100 - clamped, { shouldValidate: true });
  }, [selfWeightRaw, setValue]);

  const submit = handleSubmit((values) => {
    onSave({
      name: values.name.trim(),
      selfAssessmentWeight: Number(values.selfAssessmentWeight),
      managerAssessmentWeight: Number(values.managerAssessmentWeight),
      employeeIds: validMembers,
    });
    handleClose();
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={goal ? 'Edit Goal' : 'Create Goal'}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{goal ? 'Save Changes' : 'Create Goal'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 mt-4">
        <FormField
          label="Goal Name"
          registration={register('name', {
            required: 'Goal name is required',
            validate: (v) =>
              !otherGoals.some((g) => g.name.trim().toLowerCase() === v.trim().toLowerCase()) ||
              'A goal with this name already exists',
          })}
          error={errors.name}
          placeholder="eg; Improve customer response time"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Controller
            name="selfAssessmentWeight"
            control={control}
            rules={{
              required: 'Required',
              min: { value: 0, message: 'Min 0' },
              max: { value: 100, message: 'Max 100' },
            }}
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Self Assessment Weight (%)
                </label>
                <Input
                  type="number"
                  placeholder="40"
                  error={errors.selfAssessmentWeight?.message}
                  {...field}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </div>
            )}
          />

          <Controller
            name="managerAssessmentWeight"
            control={control}
            rules={{ required: 'Set the self assessment weight first' }}
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Manager Assessment Weight ({field.value === '' ? '—' : field.value}%)
                </label>
                <Input
                  type="number"
                  placeholder="60"
                  readOnly
                  disabled
                  error={errors.managerAssessmentWeight?.message}
                  value={field.value}
                  className="bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400">
                  Automatically set to what&apos;s left of the 100% total.
                </p>
              </div>
            )}
          />
        </div>

        <CollapsibleSection
          title="Employees"
          summary={validMembers.length === 0 ? 'None selected' : `${validMembers.length} selected`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchSelect
              label="Department"
              placeholder="Select a department"
              options={[
                { value: 'all', label: 'All departments' },
                ...departments
                  .filter((d) => eligible.some((e) => e.departmentId === d.id))
                  .map((d) => ({ value: d.id, label: d.name })),
              ]}
              value={department}
              onChange={(v) => pick(v, employmentType)}
            />
            <SearchSelect
              label="Employee type"
              placeholder="Select a type"
              options={[{ value: 'all', label: 'All types' }, ...EMPLOYMENT_TYPE_OPTIONS]}
              value={employmentType}
              onChange={(v) => pick(department, v)}
            />
          </div>
          <MultiSelect
            placeholder="Add employees to this goal"
            hideChips
            options={eligible
              .filter(
                (e) =>
                  validMembers.includes(e.id) ||
                  ((!narrows(department) || e.departmentId === department) &&
                    (!narrows(employmentType) || e.employmentType === employmentType)),
              )
              .map((e) => ({
                value: e.id,
                label: `${e.firstName} ${e.lastName}`,
                sublabel: e.jobTitle,
              }))}
            value={validMembers}
            onChange={setMemberIds}
          />
          {validMembers.length > 0 && (
            <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200">
              {validMembers.map((id) => {
                const employee = employees.find((e) => e.id === id);
                if (!employee) return null;
                return (
                  <li key={id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </span>
                      <span className="truncate text-xs text-gray-500">{employee.jobTitle}</span>
                    </span>
                    <button
                      type="button"
                      className="text-xs font-medium text-red-500 hover:text-red-600"
                      onClick={() => setMemberIds(validMembers.filter((m) => m !== id))}
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CollapsibleSection>
      </div>
    </Modal>
  );
}
