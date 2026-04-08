//EMPLOYEES PAGE //

'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { EmployeeCard } from '@/components/molecules/EmployeeCard';
import { Button } from '@/components/atoms/Button';
import { FilterSelect } from '@/components/molecules/FilterSelect';
import { useEmployees } from '@/hooks/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';
import { SuccessModal } from '@/components/organisms/SuccessModal';
import { InviteEmployeePanel } from '@/components/organisms/employee/inviteEmployeePanel';

export default function EmployeesPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [panelOpen, setPanelOpen] = useState(false);
  const [successEmployee, setSuccessEmployee] = useState<string | null>(null);

  const { data: empResult, isLoading } = useEmployees({
    search: search || undefined,
    status: statusFilter || undefined,
    departmentId: deptFilter || undefined,
    limit: 100,
  });
  const employees = empResult?.data ?? [];

  const { data: departments = [] } = useDepartments();

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

      <SuccessModal
        isOpen={!!successEmployee}
        onClose={() => setSuccessEmployee(null)}
        title="Employee Invited!"
        message={`An invite has been sent to ${successEmployee}. They will receive an email to set up their account.`}
      />

      <InviteEmployeePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSuccess={(name) => setSuccessEmployee(name)}
        departments={departments}
        employees={employees}
      />
    </div>
  );
}
