//EMPLOYEES PAGE //

'use client';

import { useState, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, Clock, CalendarOff } from 'lucide-react';
import { StatCard } from '@/components/molecules/shared/StatCard';
import { EmployeeCard } from '@/components/molecules/employees/EmployeeCard';
import { Button } from '@/components/atoms/Button';
import { FilterSelect } from '@/components/molecules/shared/FilterSelect';
import { useEmployees, useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { useDepartmentOptions } from '@/hooks/useDepartments';
import { useLeaveRequests } from '@/hooks/useLeave';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { Modal } from '@/components/organisms/shared/Modal';
import { InviteEmployeePanel } from '@/components/organisms/employee/inviteEmployeePanel';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';
import { SearchIcon } from 'lucide-react';
import { NoSearchLogo } from '@/components/atoms/NoSearchLogo';

const RESTRICTED_STATUSES = ['SUSPENDED', 'OFFBOARDED'];
const TODAY = new Date();

export default function EmployeesPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const canInvite = usePermission(Permission.CREATE_EMPLOYEE);
  const canViewDetail = usePermission(Permission.READ_EMPLOYEES);
  const canViewAllStatuses = usePermission(Permission.READ_EMPLOYEES);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [panelOpen, setPanelOpen] = useState(false);
  const [noDeptWarning, setNoDeptWarning] = useState(false);
  const [successEmployee, setSuccessEmployee] = useState<string | null>(null);

  const handleInviteClick = () => {
    // deptsError means the user lacks READ_DEPARTMENTS — they can still invite,
    // the form just won't show the department picker.
    if (!deptsError && departments.length === 0) {
      setNoDeptWarning(true);
    } else {
      setPanelOpen(true);
    }
  };

  const { data: empResult, isLoading } = useEmployees({
    search: search || undefined,
    status: statusFilter || undefined,
    departmentId: deptFilter || undefined,
    limit: 100,
  });
  const { data: allStaff = [], isLoading: isStatsLoading } = useEmployeeOptions();

  const allEmployees = empResult?.data ?? [];
  // Advanced users can filter for restricted statuses explicitly, but they're hidden by default
  const employees = (
    canViewAllStatuses && statusFilter
      ? allEmployees
      : allEmployees.filter((e) => !RESTRICTED_STATUSES.includes(e.employmentStatus))
  ).filter((e) => !typeFilter || e.employmentType === typeFilter);

  const { data: departments = [], isError: deptsError } = useDepartmentOptions();

  const { data: approvedLeave = [] } = useLeaveRequests('APPROVED');
  const onLeaveEmployeeIds = useMemo(
    () =>
      new Set(
        approvedLeave
          .filter((r) => new Date(r.startDate) <= TODAY && new Date(r.endDate) >= TODAY)
          .map((r) => r.employeeId),
      ),
    [approvedLeave],
  );

  const summary = useMemo(
    () => ({
      total: allStaff.filter((e) => !RESTRICTED_STATUSES.includes(e.employmentStatus)).length,
      permanent: allStaff.filter((e) => e.employmentStatus === 'ACTIVE').length,
      probation: allStaff.filter((e) => e.employmentStatus === 'PROBATION').length,
      onLeave: allStaff.filter(
        (e) => e.employmentStatus === 'ON_LEAVE' || onLeaveEmployeeIds.has(e.id),
      ).length,
      offboarded: allStaff.filter((e) => e.employmentStatus === 'OFFBOARDED').length,
    }),
    [allStaff, onLeaveEmployeeIds],
  );

  return (
    <div className="p-8 flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employee Directory</h1>
        </div>
        {canInvite && <Button onClick={handleInviteClick}>+ Invite Employee</Button>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {isStatsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-card animate-pulse" />
          ))
        ) : (
          <>
            <StatCard
              title="Total Employees"
              value={summary.total}
              icon={<Users className="w-4.5 h-4.5 text-gray-600" />}
              iconBg="bg-gray-100"
            />
            <StatCard
              title="Permanent Staff"
              value={summary.permanent}
              icon={<UserCheck className="w-4.5 h-4.5 text-green-600" />}
              iconBg="bg-green-50"
            />
            <StatCard
              title="On Probation"
              value={summary.probation}
              icon={<Clock className="w-4.5 h-4.5 text-yellow-600" />}
              iconBg="bg-yellow-50"
            />
            <StatCard
              title="On Leave"
              value={summary.onLeave}
              icon={<CalendarOff className="w-4.5 h-4.5 text-blue-600" />}
              iconBg="bg-blue-50"
            />
          </>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, job title..."
            className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
        </div>

        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          placeholder="All Statuses"
          options={[
            { value: 'ACTIVE', label: 'Permanent Staff' },
            { value: 'PROBATION', label: 'Probation' },
            ...(canViewAllStatuses
              ? [
                  { value: 'SUSPENDED', label: 'Suspended' },
                  { value: 'OFFBOARDED', label: 'Offboarded' },
                ]
              : []),
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
            <NoSearchLogo />
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
              isOnLeave={onLeaveEmployeeIds.has(emp.id)}
              onClick={
                canViewDetail
                  ? () => router.push(`/${tenantSlug}/hr/employees/${emp.id}`)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={noDeptWarning}
        onClose={() => setNoDeptWarning(false)}
        title="No Departments Found"
        description="You need at least one department before inviting employees. Create a department first, then come back to add your team."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setNoDeptWarning(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setNoDeptWarning(false);
                router.push(`/${tenantSlug}/hr/departments`);
              }}
            >
              Go to Departments
            </Button>
          </div>
        }
      />

      <SuccessModal
        isOpen={!!successEmployee}
        onClose={() => setSuccessEmployee(null)}
        title="Employee Invited!"
        message={`An invite has been sent to ${successEmployee}. They will receive an email to set up their account.`}
      />

      {canInvite && (
        <InviteEmployeePanel
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          onSuccess={(name) => setSuccessEmployee(name)}
          employees={employees}
        />
      )}
    </div>
  );
}
