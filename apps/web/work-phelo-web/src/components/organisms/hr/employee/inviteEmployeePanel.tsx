'use client';

import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useToast } from '@/hooks/useToast';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { extractError } from '@/lib/extractError';
import { Employee, CreateEmployeePayload } from '@/types/hr';
import { useCreateEmployee } from '@/hooks/hr/useEmployees';
import { useDepartmentOptions } from '@/hooks/hr/useDepartments';
import { useBranchOptions } from '@/hooks/hr/useBranches';
import { useCompanyPoliciesSettings } from '@/hooks';
import { MonthPicker } from '@/components/atoms/endDatePicker';
import { Toggle } from '@/components/atoms/Toggle';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import { NumberField } from '@/components/atoms/NumberField';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import type { EmployeeCompensationType } from '@/types/hr';

/* ── Types ── */

interface InviteForm {
  firstName: string;
  lastName: string;
  email: string;
  grantSystemAccess: boolean;
  phone?: string;
  gender?: string;
  jobTitle: string;
  departmentId?: string;
  branchId?: string;
  managerId?: string;
  employmentType: string;
  hireDate: string;
  probationEndsAt?: string;
  contractEndDate?: string;
  basicSalary?: number;
  compensationType?: EmployeeCompensationType;
  recruitmentCandidateId?: string;
}

/** Values to start the form with, e.g. when onboarding a hired candidate. */
export type InviteEmployeeDefaults = Partial<
  Pick<
    InviteForm,
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'phone'
    | 'jobTitle'
    | 'departmentId'
    | 'branchId'
    | 'employmentType'
    | 'recruitmentCandidateId'
  >
>;

interface InviteEmployeePanelProps {
  initialValues?: InviteEmployeeDefaults;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (fullName: string) => void;
  employees: Employee[];
}

function InviteEmployeeForm({
  isOpen,
  onClose,
  onSuccess,
  employees,
  initialValues,
}: InviteEmployeePanelProps) {
  const toast = useToast();
  const { data: departments = [] } = useDepartmentOptions(true);
  const { data: branches = [] } = useBranchOptions(true);
  const { data: policiesSettings } = useCompanyPoliciesSettings();
  const { currency: tenantCurrency } = useTenantConfig();
  // Only people who can create users may give an employee a login.
  const canGrantAccess = usePermission(Permission.INVITE_USER);
  // One key per form submission: a retry after a lost response replays the same create.
  const idempotencyKey = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InviteForm>({
    defaultValues: {
      employmentType: 'FULL_TIME',
      phone: '',
      compensationType: 'SALARY',
      grantSystemAccess: false,
    },
  });

  useEffect(() => {
    register('hireDate', { required: 'Please select the date this employee was hired.' });
  }, [register]);

  useEffect(() => {
    if (isOpen && initialValues) {
      reset({
        employmentType: 'FULL_TIME',
        phone: '',
        compensationType: 'SALARY',
        grantSystemAccess: false,
        ...initialValues,
      });
    }
  }, [isOpen, initialValues, reset]);

  const phoneValue = useWatch({ control, name: 'phone' });
  const hireDateValue = useWatch({ control, name: 'hireDate' });
  const probationDateValue = useWatch({ control, name: 'probationEndsAt' });
  const contractDateValue = useWatch({ control, name: 'contractEndDate' });
  const deptFormValue = useWatch({ control, name: 'departmentId' });
  const branchFormValue = useWatch({ control, name: 'branchId' });
  const managerValue = useWatch({ control, name: 'managerId' });
  const employmentTypeValue = useWatch({ control, name: 'employmentType' });
  const genderValue = useWatch({ control, name: 'gender' });
  const basicSalaryValue = useWatch({ control, name: 'basicSalary' });
  const grantAccessValue = useWatch({ control, name: 'grantSystemAccess' }) && canGrantAccess;
  const compensationTypeValue = useWatch({ control, name: 'compensationType' }) ?? 'SALARY';

  useEffect(() => {
    if (
      employmentTypeValue === 'CONTRACT' ||
      employmentTypeValue === 'INTERN' ||
      !hireDateValue ||
      policiesSettings === undefined
    ) {
      return;
    }

    const probationMonths = policiesSettings.defaultProbationPeriodMonths ?? 3;
    if (!probationMonths) return;

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

  const entry = useMultiEntryPanel({ isOpen, onStop: onClose, onContinue: () => {} });

  const onSubmit = async (d: InviteForm) => {
    const { grantSystemAccess: _ignored, ...rest } = d;
    void _ignored;
    const normalized = { ...rest };
    if (normalized.probationEndsAt?.length === 7) normalized.probationEndsAt += '-01';
    if (normalized.contractEndDate?.length === 7) normalized.contractEndDate += '-01';

    const payload = Object.fromEntries(
      Object.entries(normalized).filter(([, v]) => v !== '' && v !== undefined && v !== null),
    ) as unknown as CreateEmployeePayload;

    try {
      idempotencyKey.current ??= crypto.randomUUID();
      await createEmployee({
        payload: { ...payload, grantSystemAccess: grantAccessValue },
        idempotencyKey: idempotencyKey.current,
      });
      idempotencyKey.current = null;
      // The form is cleared as soon as the invite goes out, so Stop and Continue both
      // start from a blank form.
      reset({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        gender: undefined,
        jobTitle: '',
        departmentId: undefined,
        branchId: undefined,
        managerId: undefined,
        employmentType: 'FULL_TIME',
        hireDate: undefined,
        probationEndsAt: undefined,
        contractEndDate: undefined,
        basicSalary: undefined,
        compensationType: 'SALARY',
        grantSystemAccess: false,
        recruitmentCandidateId: undefined,
      });
      const fullName = `${d.firstName} ${d.lastName}`;
      // A candidate is onboarded once, so there is no next entry to continue to.
      if (d.recruitmentCandidateId) {
        onClose();
        onSuccess(fullName);
        return;
      }
      // Locked: the panel's Continue / Stop prompt replaces the directory's success modal.
      entry.finishSave(
        grantAccessValue
          ? {
              title: 'Employee Added!',
              message: `${fullName} has been added and an invite is being sent. They will receive an email to set up their account.`,
            }
          : {
              title: 'Employee Added!',
              message: `${fullName} has been added as an employee record. They do not have system access.`,
            },
        () => {
          onClose();
          onSuccess(fullName);
        },
      );
    } catch (err) {
      toast.error(extractError(err, 'Failed to add employee'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      {...(initialValues?.recruitmentCandidateId ? {} : entry.panelProps)}
      title="Add New Employee"
      description="Add a new employee. Choose whether they also get a WorkPhelo login."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={isPending}
            loadingText={grantAccessValue ? 'Sending invite…' : 'Saving…'}
            onClick={handleSubmit(onSubmit)}
          >
            {grantAccessValue ? 'Add & Send Invite' : 'Add Employee'}
          </Button>
        </div>
      }
    >
      {canGrantAccess && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Give this employee system access</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {grantAccessValue
                ? 'An invite will be sent to their work email so they can log in.'
                : 'Off: this is an employee record only. They will not be able to log in.'}
            </p>
          </div>
          <Toggle
            enabled={grantAccessValue}
            onChange={(v) => setValue('grantSystemAccess', v, { shouldValidate: true })}
          />
        </div>
      )}

      {/* Personal Information */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Personal Information
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Last Name"
            registration={register('lastName', { required: 'Required' })}
            error={errors.lastName}
            placeholder="eg; Boateng"
          />
          <FormField
            label="First Name"
            registration={register('firstName', { required: 'Required' })}
            error={errors.firstName}
            placeholder="eg; Kofi"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            label={grantAccessValue ? 'Work Email' : 'Work Email (optional)'}
            registration={register('email', {
              required: grantAccessValue ? 'Required to send an invite' : false,
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
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
        </div>
      </div>

      {/* Job Information */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Job Information
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          {departments.length > 0 && (
            <SearchSelect
              label="Department"
              placeholder="Select department"
              value={deptFormValue}
              onChange={(v) => setValue('departmentId', v)}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
          )}
          <FormField
            label="Job Title"
            registration={register('jobTitle', { required: 'Required' })}
            error={errors.jobTitle}
            placeholder="eg; UI/UX Engineer"
          />
        </div>
        {branches.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SearchSelect
              label="Branch"
              placeholder="Select branch (optional)"
              value={branchFormValue}
              onChange={(v) => setValue('branchId', v)}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <DatePicker
            label="Date Hired"
            value={hireDateValue}
            onChange={(v) => setValue('hireDate', v, { shouldValidate: true })}
            error={errors.hireDate?.message}
            disableFuture
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
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Payroll Profile
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SearchSelect
            label="Compensation Type"
            placeholder="Select compensation type"
            value={compensationTypeValue}
            onChange={(v) => setValue('compensationType', v as EmployeeCompensationType)}
            options={[
              { value: 'SALARY', label: 'Salary' },
              { value: 'COMMISSION', label: 'Commission' },
              { value: 'SALARY_PLUS_COMMISSION', label: 'Salary + Commission' },
            ]}
          />
          {(compensationTypeValue === 'SALARY' ||
            compensationTypeValue === 'SALARY_PLUS_COMMISSION') && (
            <NumberField
              label={`Basic Salary (${tenantCurrency})`}
              value={basicSalaryValue ?? 0}
              onChange={(n) => setValue('basicSalary', n === 0 ? undefined : n)}
              placeholder="0.00"
            />
          )}
        </div>
      </div>
    </SidePanel>
  );
}

export function InviteEmployeePanel(props: InviteEmployeePanelProps) {
  return <InviteEmployeeForm {...props} />;
}
