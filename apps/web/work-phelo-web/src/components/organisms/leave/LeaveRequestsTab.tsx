'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { LeaveRequestDetailPanel } from '@/components/organisms/leave/LeaveRequestDetailPanel';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/formatters';
import { LeaveRequest, LeaveRequestStatus, LeaveType } from '@/types/leave';

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
  const [filterLeaveType, setFilterLeaveType] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [reqPage, setReqPage] = useState(1);

  const { data: leaveTypesRaw } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => api.get('/hr/leave/types').then((r) => r.data),
  });
  const leaveTypes: LeaveType[] = Array.isArray(leaveTypesRaw)
    ? leaveTypesRaw
    : (leaveTypesRaw?.data ?? []);

  const { data: departmentsRaw } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/hr/departments').then((r) => r.data),
  });
  const departments: { id: string; name: string }[] = Array.isArray(departmentsRaw)
    ? departmentsRaw
    : (departmentsRaw?.data ?? []);

  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: [
      'leave-requests',
      tenantSlug,
      filterLeaveType,
      filterDepartment,
      filterFrom,
      filterTo,
      reqPage,
    ],
    queryFn: () =>
      api
        .get(`/${tenantSlug}/leave/requests`, {
          params: {
            page: reqPage,
            leaveTypeId: filterLeaveType || undefined,
            departmentId: filterDepartment || undefined,
            fromDate: filterFrom || undefined,
            toDate: filterTo || undefined,
            sort: 'createdAt:asc',
          },
        })
        .then((r) => r.data),
  });

  const reqList: LeaveRequest[] = useMemo(() => {
    return Array.isArray(reqData) ? reqData : (reqData?.data ?? []);
  }, [reqData]);

  const reqTotalPages = reqData?.totalPages ?? 1;

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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 shrink-0">
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
          <DatePicker
            placeholder="From date"
            value={filterFrom}
            onChange={(v) => {
              setFilterFrom(v);
              setReqPage(1);
            }}
          />
          <DatePicker
            placeholder="To date"
            value={filterTo}
            onChange={(v) => {
              setFilterTo(v);
              setReqPage(1);
            }}
          />
        </div>

        <DataTable
          columns={columns}
          data={reqList}
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
