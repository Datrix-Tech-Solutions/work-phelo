// EMPLOYEE DETAILS PAGE //

'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { SidePanel } from '@/components/organisms/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/FormField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { useToast } from '@/hooks/useToast';

/* ── Types ── */
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  employmentStatus: 'ACTIVE' | 'PROBATION' | 'SUSPENDED' | 'OFFBOARDED';
  employmentType: string;
  hireDate: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
  address?: string;
  city?: string;
  region?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  basicSalary?: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  ssnit?: string;
  tinNumber?: string;
  userId?: string | null;
  employeeNumber?: string;
  managerId?: string;
  departmentId?: string;
  department?: { id: string; name: string };
}

interface Department {
  id: string;
  name: string;
}

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

interface EditForm {
  firstName: string;
  lastName: string;
  phone?: string;
  jobTitle: string;
  departmentId?: string;
  employmentType: string;
  employmentStatus: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
  address?: string;
  city?: string;
  region?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  basicSalary?: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  ssnit?: string;
  tinNumber?: string;
}

/* ── Asset type ── */
type AssetType = 'LAPTOP' | 'PHONE' | 'MONITOR' | 'TABLET' | 'HEADPHONES' | 'OTHER';

interface Asset {
  id: string;
  name: string;
  type: AssetType;
  assignedAt: string;
}

/* ── Icons ── */
function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function OffboardIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" y1="11" x2="23" y2="11" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

/* ── Asset device icons ── */
function AssetIcon({ type }: { type: AssetType }) {
  const cls = 'w-10 h-10 text-[#0D2244]';
  if (type === 'LAPTOP')
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M0 21h24" />
        <path d="M8 21h8" />
      </svg>
    );
  if (type === 'PHONE')
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5" />
      </svg>
    );
  if (type === 'MONITOR')
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    );
  if (type === 'TABLET')
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5" />
      </svg>
    );
  if (type === 'HEADPHONES')
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
        <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </svg>
    );
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <path d="M12 8v4l3 3" />
    </svg>
  );
}

/* ── Detail field ── */
function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value || '—'}</span>
    </div>
  );
}

/* ── Section card ── */
function SectionCard({
  title,
  children,
  scrollX,
}: {
  title: string;
  children: React.ReactNode;
  scrollX?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {scrollX ? (
        <div className="overflow-x-auto">
          <div className="flex gap-4 px-6 py-5" style={{ width: 'max-content', minWidth: '100%' }}>
            {children}
          </div>
        </div>
      ) : (
        <div className="px-6 py-5">{children}</div>
      )}
    </div>
  );
}

/* ── Asset card ── */
function AssetCard({ asset }: { asset: Asset }) {
  const formatted = new Date(asset.assignedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <div className="w-44 shrink-0 border border-gray-200 rounded-card overflow-hidden bg-white">
      <div className="h-32 bg-[#EEF1F8] flex items-center justify-center">
        <AssetIcon type={asset.type} />
      </div>
      <div className="px-4 py-3 flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-gray-900 truncate">{asset.name}</span>
        <span className="text-xs text-gray-400">{formatted}</span>
      </div>
    </div>
  );
}

/* ── Helpers ── */
function formatDate(iso?: string) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatType(t?: string) {
  if (!t) return undefined;
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Page ── */
export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [offboardOpen, setOffboardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  /* ── Fetch employee ── */
  const { data: employee, isLoading } = useQuery<Employee>({
    queryKey: ['employee', id],
    queryFn: () => api.get(`/hr/employees/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  /* ── Fetch departments + all employees ── */
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/hr/departments').then((r) => r.data),
  });

  const { data: empData } = useQuery({
    queryKey: ['employees', '', '', '', ''],
    queryFn: () => api.get('/hr/employees', { params: { limit: 200 } }).then((r) => r.data),
  });
  const allEmployees: Employee[] = empData?.employees ?? empData ?? [];

  /* ── Offboard form ── */
  const offboardForm = useForm<OffboardForm>({
    defaultValues: {
      employeeId: id,
      reason: '',
      offboardedAt: '',
      assetReturn: false,
      hrClearance: false,
      financeClearance: false,
      managerApproval: false,
      exitNotes: '',
    },
  });

  const offboardDateValue = offboardForm.watch('offboardedAt');
  const offboardEmployeeId = offboardForm.watch('employeeId');

  const { mutate: processOffboard, isPending: isOffboarding } = useMutation({
    mutationFn: (data: OffboardForm) =>
      api.patch(`/hr/employees/${data.employeeId}/offboard`, {
        offboardedAt: data.offboardedAt,
        reason: data.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee offboarded successfully');
      setOffboardOpen(false);
      offboardForm.reset({ employeeId: id });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? 'Failed to offboard employee'),
  });

  /* ── Edit form ── */
  const editForm = useForm<EditForm>();

  const editDobValue = editForm.watch('dateOfBirth');
  const editDeptValue = editForm.watch('departmentId');
  const editTypeValue = editForm.watch('employmentType');
  const editStatusValue = editForm.watch('employmentStatus');

  const openEdit = () => {
    if (!employee) return;
    editForm.reset({
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone ?? '',
      jobTitle: employee.jobTitle,
      departmentId: employee.departmentId ?? '',
      employmentType: employee.employmentType,
      employmentStatus: employee.employmentStatus,
      dateOfBirth: employee.dateOfBirth ?? '',
      gender: employee.gender ?? '',
      maritalStatus: employee.maritalStatus ?? '',
      nationality: employee.nationality ?? '',
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
    });
    setEditOpen(true);
  };

  const { mutate: updateEmployee, isPending: isUpdating } = useMutation({
    mutationFn: (data: EditForm) => api.patch(`/hr/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      toast.success('Employee updated');
      setEditOpen(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to update employee'),
  });

  /* ── Resend invite (no endpoint yet) ── */
  const { mutate: resendInvite, isPending: isResending } = useMutation({
    mutationFn: () => Promise.reject(new Error('not_implemented')),
    onError: () => toast.error('Resend invite is not yet available'),
  });

  /* ── Loading / not found ── */
  if (isLoading) {
    return (
      <div className="p-8 flex flex-col gap-6">
        <div className="h-5 w-48 bg-gray-100 rounded-lg animate-pulse" />
        <div className="flex gap-6">
          <div className="w-72 h-64 bg-gray-100 rounded-card animate-pulse shrink-0" />
          <div className="flex-1 flex flex-col gap-4">
            <div className="h-40 bg-gray-100 rounded-card animate-pulse" />
            <div className="h-40 bg-gray-100 rounded-card animate-pulse" />
            <div className="h-40 bg-gray-100 rounded-card animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8 flex items-center justify-center flex-1">
        <p className="text-sm text-gray-400">Employee not found.</p>
      </div>
    );
  }

  const name = `${employee.firstName} ${employee.lastName}`;
  const initials = `${employee.firstName[0]}${employee.lastName[0]}`.toUpperCase();
  const isPending = !employee.userId;
  const isOffboarded = employee.employmentStatus === 'OFFBOARDED';

  /* resolve manager name */
  const manager = employee.managerId ? allEmployees.find((e) => e.id === employee.managerId) : null;
  const managerName = manager ? `${manager.firstName} ${manager.lastName}` : undefined;

  /* Assets */
  const assets: Asset[] = [
    { id: '1', name: 'MacBook Pro 14"', type: 'LAPTOP', assignedAt: '2024-02-01' },
    { id: '2', name: 'iPhone 15 Pro', type: 'PHONE', assignedAt: '2024-02-01' },
    { id: '3', name: 'Dell 27" Monitor', type: 'MONITOR', assignedAt: '2024-03-10' },
    { id: '4', name: 'iPad Pro 11"', type: 'TABLET', assignedAt: '2024-05-20' },
    { id: '5', name: 'Sony WH-1000XM5', type: 'HEADPHONES', assignedAt: '2024-06-15' },
  ];

  return (
    <div className="p-8 flex flex-col gap-6 overflow-y-auto overflow-x-hidden">
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between shrink-0">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link
            href={`/${tenantSlug}/hr/employees`}
            className="hover:text-gray-700 transition-colors"
          >
            Employees
          </Link>
          <ChevronIcon />
          <span className="text-gray-700 font-medium">{name}</span>
        </nav>

        <div className="flex items-center gap-3">
          {isPending ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => resendInvite()}
              isLoading={isResending}
              loadingText="Sending…"
            >
              Resend Invite
            </Button>
          ) : !isOffboarded ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                offboardForm.reset({
                  employeeId: id,
                  reason: '',
                  offboardedAt: '',
                  assetReturn: false,
                  hrClearance: false,
                  financeClearance: false,
                  managerApproval: false,
                  exitNotes: '',
                });
                setOffboardOpen(true);
              }}
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              Off-Board
              <OffboardIcon />
            </Button>
          ) : null}
          {!isOffboarded && (
            <Button variant="outline" size="sm" onClick={openEdit} className="gap-2">
              Edit
              <EditIcon />
            </Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-6 items-start">
        {/* ── Left profile card ── */}
        <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-card p-6 flex flex-col items-start gap-4">
          {/* Avatar */}
          {employee.avatarUrl ? (
            <Image
              src={employee.avatarUrl}
              alt={initials}
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : (
            //icon initials placement
            <div className="w-24 h-24 rounded-full bg-[#0D2244] flex items-center justify-center text-white text-2xl font-bold">
              {initials}
            </div>
          )}
          <div className="text-left">
            <p className="text-base font-bold text-gray-900">{name}</p>
            <p className="text-sm text-gray-400 mt-0.5">{employee.jobTitle}</p>
          </div>

          <div className="w-full border-t border-gray-100" />

          {/* Contact details */}
          <div className="w-full flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400">Email Address</span>
              <span className="text-sm font-medium text-gray-900 break-all">{employee.email}</span>
            </div>
            {employee.phone && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400">Phone Number</span>
                <span className="text-sm font-medium text-gray-900">{employee.phone}</span>
              </div>
            )}
            {employee.employeeNumber && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400">Employee No.</span>
                <span className="text-sm font-medium text-gray-900">{employee.employeeNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right sections ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Employment Details */}
          <SectionCard title="Employment Details">
            <div className="grid grid-cols-4 gap-x-6 gap-y-5">
              <DetailField label="Department" value={employee.department?.name} />
              <DetailField label="Job Title" value={employee.jobTitle} />
              <DetailField label="Reporting Manager" value={managerName} />
              <DetailField label="Date of Hire" value={formatDate(employee.hireDate)} />
              <DetailField label="Employment Type" value={formatType(employee.employmentType)} />
              {employee.dateOfBirth && (
                <DetailField label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
              )}
              {employee.nationality && (
                <DetailField label="Nationality" value={employee.nationality} />
              )}
              {employee.address && (
                <DetailField
                  label="Address"
                  value={[employee.address, employee.city, employee.region]
                    .filter(Boolean)
                    .join(', ')}
                />
              )}
            </div>
          </SectionCard>

          {/* Account Details */}
          <SectionCard title="Account Details">
            <div className="grid grid-cols-4 gap-x-6 gap-y-5">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400">Employment Status</span>
                <div className="mt-0.5">
                  <StatusBadge status={isPending ? 'PENDING' : employee.employmentStatus} />
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400">Invite Status</span>
                <div className="mt-0.5">
                  <StatusBadge status={isPending ? 'PENDING' : 'ACTIVE'} />
                </div>
              </div>
              {employee.bankName && <DetailField label="Bank" value={employee.bankName} />}
              {employee.bankAccountNumber && (
                <DetailField label="Account Number" value={employee.bankAccountNumber} />
              )}
              {employee.ssnit && <DetailField label="SSNIT" value={employee.ssnit} />}
              {employee.tinNumber && <DetailField label="TIN" value={employee.tinNumber} />}
              {employee.emergencyName && (
                <DetailField
                  label="Emergency Contact"
                  value={`${employee.emergencyName}${employee.emergencyRelation ? ` (${employee.emergencyRelation})` : ''}`}
                />
              )}
              {employee.emergencyPhone && (
                <DetailField label="Emergency Phone" value={employee.emergencyPhone} />
              )}
            </div>
          </SectionCard>

          {/* Assets */}
          {assets.length === 0 ? (
            <SectionCard title="Assets">
              <p className="text-sm text-gray-400 py-2">No assets assigned to this employee.</p>
            </SectionCard>
          ) : (
            <SectionCard title="Assets" scrollX>
              {assets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </SectionCard>
          )}
        </div>
      </div>

      {/* ── Offboard Side Panel ── */}
      <SidePanel
        isOpen={offboardOpen}
        onClose={() => setOffboardOpen(false)}
        title="Offboard Employee"
        description="Process the employee's departure from the organisation."
        width="w-[500px]"
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => offboardForm.reset({ employeeId: id })}>
              Reset
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setOffboardOpen(false)}>
                Save to Draft
              </Button>
              <Button
                isLoading={isOffboarding}
                loadingText="Processing…"
                onClick={offboardForm.handleSubmit((d) => processOffboard(d))}
              >
                Process Offboarding
              </Button>
            </div>
          </div>
        }
      >
        <SearchSelect
          label="Employee"
          placeholder="Select employee"
          value={offboardEmployeeId}
          onChange={(v) => offboardForm.setValue('employeeId', v)}
          options={allEmployees.map((e) => ({
            value: e.id,
            label: `${e.firstName} ${e.lastName}`,
            sublabel: e.jobTitle,
          }))}
        />

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

        <DatePicker
          label="Last Working Day"
          value={offboardDateValue}
          onChange={(v) => offboardForm.setValue('offboardedAt', v)}
          error={offboardForm.formState.errors.offboardedAt?.message}
        />

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

      {/* ── Edit Side Panel ── */}
      <SidePanel
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Employee"
        description={`Editing ${name}`}
        width="w-[500px]"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              isLoading={isUpdating}
              loadingText="Saving…"
              onClick={editForm.handleSubmit((d) => updateEmployee(d))}
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
          <FormField
            label="Phone"
            registration={editForm.register('phone')}
            placeholder="+233 24 000 0000"
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
            value={editForm.watch('gender')}
            onChange={(v) => editForm.setValue('gender', v)}
            options={[
              { value: 'MALE', label: 'Male' },
              { value: 'FEMALE', label: 'Female' },
            ]}
          />
          <SearchSelect
            label="Marital Status"
            placeholder="Select status"
            value={editForm.watch('maritalStatus')}
            onChange={(v) => editForm.setValue('maritalStatus', v)}
            options={[
              { value: 'SINGLE', label: 'Single' },
              { value: 'MARRIED', label: 'Married' },
              { value: 'DIVORCED', label: 'Divorced' },
              { value: 'WIDOWED', label: 'Widowed' },
            ]}
          />
          <FormField
            label="Nationality"
            registration={editForm.register('nationality')}
            placeholder="eg; Ghanaian"
          />
          <FormField
            label="Address"
            registration={editForm.register('address')}
            placeholder="eg; 12 Accra Road"
          />
          <FormField
            label="City"
            registration={editForm.register('city')}
            placeholder="eg; Accra"
          />
          <FormField
            label="Region"
            registration={editForm.register('region')}
            placeholder="eg; Greater Accra"
          />
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Emergency Contact
          </p>
          <FormField
            label="Full Name"
            registration={editForm.register('emergencyName')}
            placeholder="eg; Abena Boateng"
          />
          <FormField
            label="Phone"
            registration={editForm.register('emergencyPhone')}
            placeholder="+233 24 000 0000"
          />
          <FormField
            label="Relationship"
            registration={editForm.register('emergencyRelation')}
            placeholder="eg; Spouse"
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
          <SearchSelect
            label="Employment Type"
            placeholder="Select type"
            value={editTypeValue}
            onChange={(v) => editForm.setValue('employmentType', v)}
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
            onChange={(v) => editForm.setValue('employmentStatus', v)}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'PROBATION', label: 'Probation' },
              { value: 'SUSPENDED', label: 'Suspended' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Banking & Compliance
          </p>
          <FormField
            label="Basic Salary (GHS)"
            registration={editForm.register('basicSalary')}
            type="number"
            placeholder="5000"
          />
          <FormField
            label="Bank Name"
            registration={editForm.register('bankName')}
            placeholder="eg; GCB Bank"
          />
          <FormField
            label="Account Number"
            registration={editForm.register('bankAccountNumber')}
            placeholder="eg; 1234567890"
          />
          <FormField
            label="Bank Branch"
            registration={editForm.register('bankBranch')}
            placeholder="eg; Accra Main"
          />
          <FormField
            label="SSNIT Number"
            registration={editForm.register('ssnit')}
            placeholder="eg; P00123456"
          />
          <FormField
            label="TIN Number"
            registration={editForm.register('tinNumber')}
            placeholder="eg; P0012345678"
          />
        </div>
      </SidePanel>
    </div>
  );
}
