'use client';

import { useForm, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Employee, Department, Branch, CreateEmployeePayload } from '@/types/hr';
import { useCreateEmployee } from '@/hooks/hr/useEmployees';

/* ── Types ── */

interface InviteForm {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle: string;
  departmentId?: string;
  branchId?: string;
  managerId?: string;
  employmentType: string;
  hireDate: string;
  dateOfBirth?: string;
  probationEndDate?: string;
  contractEndDate?: string;
}

interface InviteEmployeePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (fullName: string) => void;
  departments: Department[];
  branches: Branch[];
  employees: Employee[];
}

/* ── Component ── */

export function InviteEmployeePanel({
  isOpen,
  onClose,
  onSuccess,
  departments,
  branches,
  employees,
}: InviteEmployeePanelProps) {
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<InviteForm>({
    defaultValues: { employmentType: 'FULL_TIME' },
  });

  const phoneValue = useWatch({ control, name: 'phone' });
  const hireDateValue = useWatch({ control, name: 'hireDate' });
  const dobValue = useWatch({ control, name: 'dateOfBirth' });
  // const probationDateValue = useWatch({ control, name: 'probationEndDate' });
  // const contractDateValue = useWatch({ control, name: 'contractEndDate' });
  const deptFormValue = useWatch({ control, name: 'departmentId' });
  const branchFormValue = useWatch({ control, name: 'branchId' });
  const managerValue = useWatch({ control, name: 'managerId' });
  const employmentTypeValue = useWatch({ control, name: 'employmentType' });

  const { mutate: createEmployee, isPending } = useCreateEmployee();

  const handleClose = () => {
    onClose();
    reset();
  };

  const onSubmit = (d: InviteForm) => {
    const payload = Object.fromEntries(
      Object.entries(d).filter(([, v]) => v !== '' && v !== undefined && v !== null),
    ) as unknown as CreateEmployeePayload;

    createEmployee(payload, {
      onSuccess: () => {
        const name = `${d.firstName} ${d.lastName}`;
        reset();
        onClose();
        onSuccess(name);
      },
      onError: (err: unknown) => toast.error(extractError(err, 'Failed to invite employee')),
    });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Employee"
      description="Add a new employee to onboard them onto WorkPhelo."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
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
        <DatePicker
          label="Date of Birth"
          value={dobValue}
          onChange={(v) => setValue('dateOfBirth', v)}
          disableFuture
        />
      </div>

      {/* Job Information */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Job Information
        </p>
        <SearchSelect
          label="Department"
          placeholder="Select department"
          value={deptFormValue}
          onChange={(v) => setValue('departmentId', v)}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
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
          placeholder="Select manager"
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
        {/* <DatePicker
          label="Probation End Date"
          value={probationDateValue}
          onChange={(v) => setValue('probationEndDate', v)}
        /> */}
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

        {/* {employmentTypeValue === 'CONTRACT' && (
          <DatePicker
            label="Contract End Date"
            value={contractDateValue}
            onChange={(v) => setValue('contractEndDate', v)}
            // Optional: make it required when contract is selected
            error={errors.contractEndDate?.message}
            disablePast
          />
        )} */}
      </div>
    </SidePanel>
  );
}
