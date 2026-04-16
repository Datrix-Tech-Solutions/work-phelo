'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { StatCard } from '@/components/molecules/dashboard/StatCard';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { LeaveRequestDetailPanel } from '@/components/organisms/leave/LeaveRequestDetailPanel';
import { useEmployees } from '@/hooks/hr/useEmployees';
import { useLeaveTypes, useLeaveRequests } from '@/hooks/useLeave';
import { useDepartments } from '@/hooks/useDepartments';
import { formatDate } from '@/lib/formatters';
import { LeaveRequest, LeaveRequestStatus, LeaveType } from '@/types/hr';
import { Users } from 'lucide-react';

const STATUS_VARIANT: Record<LeaveRequestStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'danger',
  Cancelled: 'neutral',
};

interface Props {
  tenantSlug: string;
}

export function LeaveRequestsTab({ tenantSlug }: Props) {
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [search, setSearch] = useState('');
  const [filterLeaveType, setFilterLeaveType] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterFrom] = useState('');
  const [reqPage, setReqPage] = useState(1);

  const { data: leaveTypesRaw } = useLeaveTypes(tenantSlug);
  const leaveTypes: LeaveType[] = Array.isArray(leaveTypesRaw)
    ? leaveTypesRaw
    : ((leaveTypesRaw as { data?: LeaveType[] } | undefined)?.data ?? []);

  const { data: departmentsRaw } = useDepartments();
  const departments: { id: string; name: string }[] = Array.isArray(departmentsRaw)
    ? departmentsRaw
    : ((departmentsRaw as { data?: { id: string; name: string }[] } | undefined)?.data ?? []);

  const { data: employeesData, isLoading: employeesLoading } = useEmployees();
  const totalEmployees = employeesData?.total ?? null;

  const { data: reqList = [], isLoading: reqLoading } = useLeaveRequests();

  const totalRequests = reqList.length || null;
  const pendingCount = useMemo(
    () => reqList.filter((r) => r.status === 'Pending').length || null,
    [reqList],
  );

  const filteredRequests = useMemo(() => {
    return reqList.filter((r) => {
      if (search && !r.employeeName.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterLeaveType && r.leaveTypeId !== filterLeaveType) return false;
      if (filterFrom && r.createdAt.slice(0, 10) < filterFrom) return false;
      return true;
    });
  }, [reqList, search, filterLeaveType, filterFrom]);

  const PAGE_SIZE = 10;
  const reqTotalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const pagedRequests = filteredRequests.slice((reqPage - 1) * PAGE_SIZE, reqPage * PAGE_SIZE);

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'employeeName',
      label: 'Employee Name',
      render: (r) => <span className="font-medium text-gray-900">{r.employeeName}</span>,
    },
    {
      key: 'leaveTypeName',
      label: 'Leave Type',
      render: (r) => <span className="text-gray-700">{r.leaveTypeName}</span>,
    },
    {
      key: 'startDate',
      label: 'Start Date',
      render: (r) => <span className="text-gray-700">{formatDate(r.startDate)}</span>,
    },
    {
      key: 'endDate',
      label: 'End Date',
      render: (r) => <span className="text-gray-700">{formatDate(r.endDate)}</span>,
    },
    {
      key: 'totalDays',
      label: 'Working Days',
      render: (r) => <span className="text-gray-700">{r.totalDays}</span>,
    },
    {
      key: 'createdAt',
      label: 'Date Submitted',
      render: (r) => <span className="text-gray-500 text-sm">{formatDate(r.createdAt)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <Badge variant={STATUS_VARIANT[r.status]} label={r.status} />,
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 shrink-0">
          <StatCard
            title="Total Leave Requests"
            value={reqLoading ? null : totalRequests}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            title="Pending Approval"
            value={reqLoading ? null : pendingCount}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            title="Total Employees"
            value={employeesLoading ? null : totalEmployees}
            icon={<Users className="w-5 h-5" />}
          />
        </div>

        {/* Search + Filters */}
        <div className="flex items-center shrink-0 gap-6">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setReqPage(1);
            }}
            placeholder="Search by employee name..."
            className="w-64 rounded-input border border-gray-300 px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand"
          />
          <div className="flex items-center gap-3">
            <SearchSelect
              placeholder="All leave types"
              options={[
                { value: '', label: 'All leave types' },
                ...leaveTypes.map((t) => ({ value: t.id, label: t.name })),
              ]}
              value={filterLeaveType}
              onChange={(v) => {
                setFilterLeaveType(v);
                setReqPage(1);
              }}
            />
            <SearchSelect
              placeholder="All departments"
              options={[
                { value: '', label: 'All departments' },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
              value={filterDepartment}
              onChange={(v) => {
                setFilterDepartment(v);
                setReqPage(1);
              }}
            />
            {/* <DatePicker
              placeholder="Date Leave Submitted"
              value={filterFrom}
              onChange={(v) => {
                setFilterFrom(v);
                setReqPage(1);
              }}
            /> */}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={pagedRequests}
          isLoading={reqLoading}
          emptyMessage="No leave requests found"
          currentPage={reqPage}
          totalPages={reqTotalPages}
          onPageChange={setReqPage}
          rowActions={(row) =>
            row.status === 'Pending'
              ? [{ label: 'Review', onClick: () => setSelectedRequest(row) }]
              : [{ label: 'View', onClick: () => setSelectedRequest(row) }]
          }
        />
      </div>

      <LeaveRequestDetailPanel
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        tenantSlug={tenantSlug}
        request={selectedRequest}
      />
    </>
  );
}
