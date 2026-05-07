'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { StatCard } from '@/components/molecules/dashboard/StatCard';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { LeaveRequestDetailPanel } from '@/components/organisms/leave/LeaveRequestDetailPanel';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { useLeaveTypes, useLeaveRequests } from '@/hooks/useLeave';
import { useDepartments } from '@/hooks/useDepartments';
import { formatDate } from '@/lib/formatters';
import { LeaveRequest, LeaveRequestStatus, LeaveType } from '@/types/hr';
import { Users, Search } from 'lucide-react';

const STATUS_VARIANT: Record<LeaveRequestStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

interface Props {
  tenantSlug: string;
  canReview: boolean;
}

export function LeaveRequestsTab({ tenantSlug, canReview }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const { data: allEmployeeOptions, isLoading: employeesLoading } = useEmployeeOptions();
  const totalEmployees = allEmployeeOptions?.length ?? null;

  const { data: reqList = [], isLoading: reqLoading } = useLeaveRequests();
  const requestIdFromQuery = searchParams.get('requestId');

  const selectedRequest = useMemo(
    () => reqList.find((r) => r.id === requestIdFromQuery) ?? null,
    [requestIdFromQuery, reqList],
  );

  const totalRequests = reqList.length || null;
  const pendingCount = useMemo(
    () => reqList.filter((r) => r.status === 'PENDING').length || null,
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

  const handleRequestOpen = (request: LeaveRequest) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'requests');
    params.set('requestId', request.id);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleRequestClose = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('requestId');
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'employeeName',
      label: 'Employee Name',
      width: '1.5fr',
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
      label: 'Days',
      width: '72px',
      render: (r) => <span className="text-gray-700">{r.totalDays}</span>,
    },
    {
      key: 'createdAt',
      label: 'Submitted',
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
          <div className="relative flex-1 min-w-52 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setReqPage(1);
              }}
              placeholder="Search by employee name..."
              className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-input text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
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
            {/* <SearchSelect
              placeholder="All Statuses"
              options={[
                { value: '', label: 'All statuses' },
                ...status.map((d) => ({ value: d.id, label: d.name })),
              ]}
              value={filterStatus}
              onChange={(v) => {
                filterStatus(v);
                setReqPage(1);
              }}
            /> */}

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
          onRowClick={(row) => handleRequestOpen(row)}
        />
      </div>

      <LeaveRequestDetailPanel
        isOpen={!!selectedRequest}
        onClose={handleRequestClose}
        tenantSlug={tenantSlug}
        request={selectedRequest}
        canReview={canReview}
      />
    </>
  );
}
