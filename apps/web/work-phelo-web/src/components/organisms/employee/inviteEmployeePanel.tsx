'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Employee, CreateEmployeePayload } from '@/types/hr';
import { useCreateEmployee } from '@/hooks/hr/useEmployees';
import { useDepartmentOptions } from '@/hooks/useDepartments';
import { useBranchOptions } from '@/hooks/useBranches';
import { useCompanyPoliciesSettings } from '@/hooks';
import { MonthPicker } from '@/components/atoms/endDatePicker';
import { isAtLeastMinimumEmployeeAge, MIN_EMPLOYEE_AGE } from '@/lib/employeeAge';
import { usePermissionSets, useAssignPermissionSet } from '@/hooks/useRoles';

/* ── Types ── */

interface InviteForm {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: string;
  jobTitle: string;
  departmentId?: string;
  branchId?: string;
  managerId?: string;
  employmentType: string;
  hireDate: string;
  dateOfBirth: string;
  probationEndsAt?: string;
  contractEndDate?: string;
}

interface InviteEmployeePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (fullName: string) => void;
  employees: Employee[];
}

/* ── Inner form (mounts fresh each time the panel opens) ── */

function InviteEmployeeForm({
  onClose,
  onSuccess,
  employees,
}: Omit<InviteEmployeePanelProps, 'isOpen'>) {
  const toast = useToast();
  const { data: departments = [] } = useDepartmentOptions(true);
  const { data: branches = [] } = useBranchOptions(true);
  const { data: policiesSettings } = useCompanyPoliciesSettings();
  const { data: permissionSetsRaw = [] } = usePermissionSets();
  const { mutateAsync: assignPermissionSet } = useAssignPermissionSet();
  const [selectedPermissionSetId, setSelectedPermissionSetId] = useState('');

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<InviteForm>({
    defaultValues: { employmentType: 'FULL_TIME', phone: '', dateOfBirth: '' },
  });

  const phoneValue = useWatch({ control, name: 'phone' });
  const hireDateValue = useWatch({ control, name: 'hireDate' });
  const dobValue = useWatch({ control, name: 'dateOfBirth' });
  const probationDateValue = useWatch({ control, name: 'probationEndsAt' });
  const contractDateValue = useWatch({ control, name: 'contractEndDate' });
  const deptFormValue = useWatch({ control, name: 'departmentId' });
  const branchFormValue = useWatch({ control, name: 'branchId' });
  const managerValue = useWatch({ control, name: 'managerId' });
  const employmentTypeValue = useWatch({ control, name: 'employmentType' });
  const genderValue = useWatch({ control, name: 'gender' });

  useEffect(() => {
    const probationMonths = policiesSettings?.defaultProbationPeriodMonths;
    if (
      employmentTypeValue === 'CONTRACT' ||
      employmentTypeValue === 'INTERN' ||
      !hireDateValue ||
      !probationMonths
    ) {
      return;
    }

    const hireDate = new Date(hireDateValue);
    if (isNaN(hireDate.getTime())) return;

    const probationDate = new Date(
      hireDate.getFullYear(),
      hireDate.getMonth() + probationMonths,
      1,
    );
    const probationMonth = `${probationDate.getFullYear()}-${String(
      probationDate.getMonth() + 1,
    ).padStart(2, '0')}`;

    setValue('probationEndsAt', probationMonth);
  }, [employmentTypeValue, hireDateValue, policiesSettings, setValue]);

  const { mutateAsync: createEmployee, isPending } = useCreateEmployee();

  const onSubmit = async (d: InviteForm) => {
    if (!d.dateOfBirth) {
      setError('dateOfBirth', { type: 'required', message: 'Required' });
      return;
    }

    if (!isAtLeastMinimumEmployeeAge(d.dateOfBirth)) {
      setError('dateOfBirth', {
        type: 'validate',
        message: `Employee must be at least ${MIN_EMPLOYEE_AGE} years old`,
      });
      return;
    }

    clearErrors('dateOfBirth');

    const normalized = { ...d };
    if (normalized.probationEndsAt?.length === 7) normalized.probationEndsAt += '-01';
    if (normalized.contractEndDate?.length === 7) normalized.contractEndDate += '-01';

    const payload = Object.fromEntries(
      Object.entries(normalized).filter(([, v]) => v !== '' && v !== undefined && v !== null),
    ) as unknown as CreateEmployeePayload;

    try {
      const employee = await createEmployee(payload);
      if (selectedPermissionSetId && employee.userId) {
        await assignPermissionSet({
          userId: employee.userId,
          permissionSetId: selectedPermissionSetId,
        });
      }
      onClose();
      onSuccess(`${d.firstName} ${d.lastName}`);
    } catch (err) {
      toast.error(extractError(err, 'Failed to invite employee'));
    }
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title="Add New Employee"
      description="Add a new employee to onboard them onto WorkPhelo."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={isPending}
            loadingText="Sending invite…"
            onClick={handleSubmit(onSubmit)}
          >
            Send Invite
          </Button>
        </div>
      }
    >
      {/* Personal Information */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Personal Information
        </p>
        <FormField
          label="First Name"
          registration={register('firstName', { required: 'Required' })}
          error={errors.firstName}
          placeholder="eg; Kofi"
        />
        <FormField
          label="Last Name"
          registration={register('lastName', { required: 'Required' })}
          error={errors.lastName}
          placeholder="eg; Boateng"
        />
        <FormField
          label="Work Email"
          registration={register('email', {
            required: 'Required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
            onChange: (e: ChangeEvent<HTMLInputElement>) => {
              e.target.value = e.target.value.toLowerCase();
            },
          })}
          error={errors.email}
          type="email"
          placeholder="eg; kofi@acmecorp.com"
        />
        <PhoneInput
          label="Phone Number"
          placeholder="00 000 0000"
          value={phoneValue}
          onChange={(v) => setValue('phone', v)}
        />
        <SearchSelect
          label="Gender"
          placeholder="Select gender"
          value={genderValue}
          onChange={(v) => setValue('gender', v)}
          options={[
            { value: 'MALE', label: 'Male' },
            { value: 'FEMALE', label: 'Female' },
          ]}
        />
        <DatePicker
          label="Date of Birth"
          value={dobValue}
          onChange={(v) => {
            setValue('dateOfBirth', v);
            clearErrors('dateOfBirth');
          }}
          error={errors.dateOfBirth?.message}
          disableFuture
        />
      </div>

      {/* Job Information */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Job Information
        </p>
        {departments.length > 0 && (
          <SearchSelect
            label="Department"
            placeholder="Select department"
            value={deptFormValue}
            onChange={(v) => setValue('departmentId', v)}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />
        )}
        {branches.length > 0 && (
          <SearchSelect
            label="Branch"
            placeholder="Select branch (optional)"
            value={branchFormValue}
            onChange={(v) => setValue('branchId', v)}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
        <FormField
          label="Job Title"
          registration={register('jobTitle', { required: 'Required' })}
          error={errors.jobTitle}
          placeholder="eg; UI/UX Engineer"
        />
        <SearchSelect
          label="Reporting Manager"
          placeholder="Select manager (optional)"
          value={managerValue}
          onChange={(v) => setValue('managerId', v)}
          options={employees.map((e) => ({
            value: e.id,
            label: `${e.firstName} ${e.lastName}`,
            sublabel: e.jobTitle,
          }))}
        />
        <DatePicker
          label="Date Hired"
          value={hireDateValue}
          onChange={(v) => setValue('hireDate', v)}
          error={errors.hireDate?.message}
          disableFuture
        />
        <SearchSelect
          label="Employment Type"
          placeholder="Select employment type"
          value={employmentTypeValue}
          onChange={(v) => setValue('employmentType', v)}
          options={[
            { value: 'FULL_TIME', label: 'Full Time' },
            { value: 'PART_TIME', label: 'Part Time' },
            { value: 'CONTRACT', label: 'Contract' },
            { value: 'INTERN', label: 'Intern' },
          ]}
        />
        {employmentTypeValue !== 'CONTRACT' && employmentTypeValue !== 'INTERN' && (
          <MonthPicker
            label="Probation End Date"
            value={probationDateValue}
            onChange={(v) => setValue('probationEndsAt', v)}
            disablePast={true}
          />
        )}
        {(employmentTypeValue === 'CONTRACT' || employmentTypeValue === 'INTERN') && (
          <MonthPicker
            label={employmentTypeValue === 'INTERN' ? 'Internship End Date' : 'Contract End Date'}
            value={contractDateValue}
            onChange={(v) => setValue('contractEndDate', v)}
            disablePast={true}
          />
        )}
        {permissionSetsRaw.length > 0 && (
          <SearchSelect
            label="Roles"
            placeholder="Select roles"
            value={selectedPermissionSetId}
            onChange={setSelectedPermissionSetId}
            options={permissionSetsRaw.map((s) => ({ value: s.id, label: s.name }))}
          />
        )}
      </div>
    </SidePanel>
  );
}

/* ── Public wrapper ── */

export function InviteEmployeePanel({
  isOpen,
  onClose,
  onSuccess,
  employees,
}: InviteEmployeePanelProps) {
  if (!isOpen) {
    return (
      <SidePanel isOpen={false} onClose={onClose} title="">
        {null}
      </SidePanel>
    );
  }
  return <InviteEmployeeForm onClose={onClose} onSuccess={onSuccess} employees={employees} />;
}
