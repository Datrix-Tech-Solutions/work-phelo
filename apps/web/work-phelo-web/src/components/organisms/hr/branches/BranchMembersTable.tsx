'use client';

import { useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { EmploymentStatusBadge } from '@/components/molecules/hr/employees/EmploymentStatusBadge';
import { BranchMembersPanel } from './BranchMembersPanel';
import { useAllEmployees, useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import type { Branch, Employee } from '@/types/hr';

const PAGE_SIZE = 8;

const STATUS_FILTER_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PROBATION', label: 'Probation' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'OFFBOARDED', label: 'Offboarded' },
];

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

interface Props {
  branch: Branch;
}

export function BranchMembersTable({ branch }: Props) {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();

  const canUpdate = usePermission(Permission.UPDATE_BRANCH);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data, isLoading } = useAllEmployees();
  const { data: employeeOptions = [] } = useEmployeeOptions();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (data?.data ?? []).filter((e) => {
      if (e.branch?.id !== branch.id) return false;
      const matchesStatus = statusFilter
        ? e.employmentStatus === statusFilter
        : e.employmentStatus !== 'OFFBOARDED';
      const matchesSearch =
        !q ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.jobTitle?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [data, branch.id, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const members = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      label: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-brand">
              {getInitials(row.firstName, row.lastName)}
            </span>
          </div>
          <p className="font-medium text-gray-900">
            {row.firstName} {row.lastName}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-gray-700">{row.jobTitle}</span>
          {row.id === branch.managerId && (
            <span className="text-xs font-medium text-brand">Branch Manager</span>
          )}
        </div>
      ),
    },
    {
      key: 'department',
      label: 'Department',
      render: (row) => <span className="text-sm text-gray-700">{row.department?.name ?? '—'}</span>,
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-gray-700">{row.email}</span>
          {row.phone && <span className="text-xs text-gray-400">{row.phone}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '150px',
      render: (row) => <EmploymentStatusBadge status={row.employmentStatus} />,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={members}
        isLoading={isLoading}
        searchPlaceholder="Search members..."
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        filterOptions={STATUS_FILTER_OPTIONS}
        onFilter={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        onRowClick={(row) => router.push(`/${params.tenantSlug}/hr/employees/${row.id}`)}
        {...(canUpdate && {
          actionButton: { label: 'Add Members', onClick: () => setPanelOpen(true) },
        })}
        emptyMessage="No members in this branch"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      {canUpdate && (
        <BranchMembersPanel
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          branch={branch}
          employees={employeeOptions}
        />
      )}
    </>
  );
}
