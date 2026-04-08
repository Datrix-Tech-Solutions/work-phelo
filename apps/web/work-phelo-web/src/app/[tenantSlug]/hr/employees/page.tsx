//EMPLOYEES PAGE //

'use client';

import { useState, use } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { EmployeeCard } from '@/components/molecules/EmployeeCard';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/FormField';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Employee, Department, CreateEmployeePayload } from '@/types/hr';
import { FilterSelect } from '@/components/molecules/FilterSelect';
import { useEmployees, useCreateEmployee } from '@/hooks/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';

/* ── Types ── */

interface InviteForm {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle: string;
  departmentId?: string;
  managerId?: string;
  employmentType: string;
  hireDate: string;
  dateOfBirth?: string;
}

/* ── Page ── */
export default function EmployeesPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [panelOpen, setPanelOpen] = useState(false);

  /* ── Fetch employees ── */
  const { data: empResult, isLoading } = useEmployees({
    search: search || undefined,
    status: statusFilter || undefined,
    departmentId: deptFilter || undefined,
    limit: 100,
  });
  const employees = empResult?.data ?? [];

  /* ── Fetch departments ── */
  const { data: departments = [] } = useDepartments();

  /* ── Invite form ── */
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
  const deptFormValue = useWatch({ control, name: 'departmentId' });
  const managerValue = useWatch({ control, name: 'managerId' });
  const employmentTypeValue = useWatch({ control, name: 'employmentType' });

  const { mutate: createEmployee, isPending } = useCreateEmployee();

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? '—' : `${employees.length} employee${employees.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => setPanelOpen(true)}>+ Invite Employee</Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, job title..."
            className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D2244]/20 focus:border-[#0D2244]"
          />
        </div>

        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="All Statuses"
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'PROBATION', label: 'Probation' },
            { value: 'SUSPENDED', label: 'Suspended' },
            { value: 'OFFBOARDED', label: 'Offboarded' },
          ]}
        />

        <FilterSelect
          value={deptFilter}
          onChange={setDeptFilter}
          placeholder="All Departments"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />

        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          placeholder="All Types"
          options={[
            { value: 'FULL_TIME', label: 'Full Time' },
            { value: 'PART_TIME', label: 'Part Time' },
            { value: 'CONTRACT', label: 'Contract' },
            { value: 'INTERN', label: 'Intern' },
          ]}
        />

        {(search || statusFilter || deptFilter || typeFilter) && (
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('');
              setDeptFilter('');
              setTypeFilter('');
            }}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-card animate-pulse" />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
          <div className="w-14 h-14 rounded-card bg-gray-100 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">No employees found</p>
          <p className="text-xs text-gray-400">
            {search || statusFilter || deptFilter || typeFilter
              ? 'Try adjusting your filters'
              : 'Invite your first employee to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto">
          {employees.map((emp) => (
            <EmployeeCard
              key={emp.id}
              firstName={emp.firstName}
              lastName={emp.lastName}
              jobTitle={emp.jobTitle}
              email={emp.email}
              phone={emp.phone}
              avatarUrl={emp.avatarUrl}
              status={emp.employmentStatus}
              department={emp.department?.name}
              hireDate={emp.hireDate}
              onClick={() => router.push(`/${tenantSlug}/hr/employees/${emp.id}`)}
            />
          ))}
        </div>
      )}

      {/* ── Invite Employee side panel ── */}
      <SidePanel
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          reset();
        }}
        title="Add New Employee"
        description="Add a new employee to onboard them onto WorkPhelo."
        width="w-[500px]"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setPanelOpen(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              isLoading={isPending}
              loadingText="Sending invite…"
              onClick={handleSubmit((d) => {
                const { managerId: _m, ...rest } = d;
                const payload = Object.fromEntries(
                  Object.entries(rest).filter(([, v]) => v !== '' && v !== undefined && v !== null),
                ) as unknown as CreateEmployeePayload;
                createEmployee(payload, {
                  onSuccess: () => {
                    toast.success('Employee invited successfully');
                    reset();
                    setPanelOpen(false);
                  },
                  onError: (err: unknown) =>
                    toast.error(extractError(err, 'Failed to invite employee')),
                });
              })}
            >
              Send Invite
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
        </div>
      </SidePanel>
    </div>
  );
}
