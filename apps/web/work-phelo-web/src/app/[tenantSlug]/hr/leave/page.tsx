'use client';

import { use, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { ApplyLeavePanel } from '@/components/organisms/leave/ApplyLeavePanel';
import { LeaveRequestDetailPanel } from '@/components/organisms/leave/LeaveRequestDetailPanel';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/organisms/Modal';
import { LeaveBalance, LeaveRequest, LeaveRequestStatus, LeaveType } from '@/types/leave';
import { BalanceCard } from '@/components/molecules/leave/BalanceCard';
import { formatDate } from '@/lib/formatters';

const TAB_ACTIVE =
  'relative text-[#0D2244] font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#0D2244] after:rounded-t-full';
const TAB_IDLE = 'text-gray-500 hover:text-gray-800';

const STATUS_VARIANT: Record<LeaveRequestStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'danger',
  Cancelled: 'neutral',
};

const PAGE_SIZE = 10;

export default function LeavePage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const user = useAuthStore((s) => s.user);

  const isHR = user?.role === 'TENANT_ADMIN';
  const isManager = isHR || user?.isManager === true;

  /* ── Pending count — always fetched so badge shows on load ── */
  const { data: pendingCount = 0 } = useQuery<number>({
    queryKey: ['leave-pending-count', tenantSlug],
    queryFn: () => api.get(`/hr/leave/requests/pending-count`).then((r) => r.data?.count ?? 0),
    enabled: isManager || isHR,
  });

  const TABS = [
    { key: 'my', label: 'My Leave' },
    ...(isManager || isHR
      ? [{ key: 'requests', label: 'Leave Requests', count: pendingCount }]
      : []),
  ];

  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('my');
  const [applyOpen, setApplyOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);

  const { mutate: cancelRequest, isPending: isCancelling } = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/leave/requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-leave-requests', tenantSlug] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance', tenantSlug] });
      toast.success('Leave request cancelled');
      setCancelTarget(null);
    },
    onError: (err) => {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'Something went wrong';
      toast.error(message);
    },
  });

  /* ── My Leave state ── */
  const [mySearch, setMySearch] = useState('');
  const [myPage, setMyPage] = useState(1);

  /* ── Leave Requests filters ── */
  const [filterLeaveType, setFilterLeaveType] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [reqPage, setReqPage] = useState(1);

  /* ── Leave balances (current user) ── */
  const { data: balancesData = [] } = useQuery<LeaveBalance[]>({
    queryKey: ['leave-balance', tenantSlug],
    queryFn: () => api.get(`/hr/leave/balances`).then((r) => r.data),
  });

  /* ── Leave types for filter dropdown ── */
  const { data: leaveTypes = [] } = useQuery<LeaveType[]>({
    queryKey: ['leave-types', tenantSlug],
    queryFn: () => api.get(`/hr/leave/types`).then((r) => r.data),
    enabled: activeTab === 'requests',
  });

  /* ── Departments for filter dropdown ── */
  const { data: departments = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['departments', tenantSlug],
    queryFn: () => api.get(`/hr/departments`).then((r) => r.data),
    enabled: activeTab === 'requests',
  });

  /* ── My leave requests ── */
  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['my-leave-requests', tenantSlug],
    queryFn: () => api.get(`/hr/leave/requests/my`).then((r) => r.data),
    enabled: activeTab === 'my',
  });

  const myRequests: LeaveRequest[] = useMemo(() => {
    const list = Array.isArray(myData) ? myData : (myData?.data ?? []);
    return list;
  }, [myData]);

  const myFiltered = useMemo(() => {
    if (!mySearch) return myRequests;
    const q = mySearch.toLowerCase();
    return myRequests.filter((r) => r.leaveTypeName.toLowerCase().includes(q));
  }, [myRequests, mySearch]);

  const myPageData = myFiltered.slice((myPage - 1) * PAGE_SIZE, myPage * PAGE_SIZE);
  const myTotalPages = Math.max(1, Math.ceil(myFiltered.length / PAGE_SIZE));

  /* ── Leave requests (manager / HR) — sorted oldest first ── */
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
    enabled: activeTab === 'requests',
  });

  const reqList: LeaveRequest[] = useMemo(() => {
    const list = Array.isArray(reqData) ? reqData : (reqData?.data ?? []);
    return list;
  }, [reqData]);

  const reqTotalPages = reqData?.totalPages ?? 1;

  /* ── My Leave columns ── */
  const myColumns: Column<LeaveRequest>[] = [
    {
      key: 'leaveTypeName',
      label: 'Leave Type',
      render: (r) => <span className="font-medium text-gray-900">{r.leaveTypeName}</span>,
    },
    {
      key: 'paid',
      label: 'Paid',
      render: (r) => (
        <Badge variant={r.isPaid ? 'success' : 'neutral'} label={r.isPaid ? 'Yes' : 'No'} />
      ),
    },
    {
      key: 'totalDays',
      label: 'Days',
      render: (r) => <span className="text-gray-700">{r.totalDays}</span>,
    },
    {
      key: 'usedDays',
      label: 'Total Days',
      render: (r) => {
        const b = balancesData.find((b) => b.leaveTypeId === r.leaveTypeId);
        return <span className="text-gray-700">{b ? b.used : '—'}</span>;
      },
    },
    {
      key: 'carryOver',
      label: 'Carry Over',
      render: (r) => {
        const b = balancesData.find((b) => b.leaveTypeId === r.leaveTypeId);
        return (
          <span className="text-gray-700">{b && b.carriedOver > 0 ? b.carriedOver : '—'}</span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <Badge variant={STATUS_VARIANT[r.status]} label={r.status} />,
    },
    {
      key: 'period',
      label: 'Period',
      render: (r) => (
        <span className="text-xs text-gray-500">
          {formatDate(r.startDate)} – {formatDate(r.endDate)}
        </span>
      ),
    },
  ];

  /* ── Leave Requests columns (manager / HR) ── */
  const reqColumns: Column<LeaveRequest>[] = [
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
    <div className="p-8 flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leave</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage your leave requests and balances</p>
        </div>
        {activeTab === 'my' && <Button onClick={() => setApplyOpen(true)}>Apply for Leave</Button>}
      </div>

      {/* Tabs */}
      <div className="flex items-end gap-1 border-b border-gray-200 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'relative px-4 py-3 text-sm transition-colors whitespace-nowrap flex items-center gap-2',
              activeTab === tab.key ? TAB_ACTIVE : TAB_IDLE,
            )}
          >
            {tab.label}
            {(tab.count ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* My Leave */}
      {activeTab === 'my' && (
        <div className="flex flex-col gap-6">
          {balancesData.length > 0 && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {balancesData.map((b) => (
                <BalanceCard key={b.leaveTypeId} balance={b} />
              ))}
            </div>
          )}
          <DataTable
            columns={myColumns}
            data={myPageData}
            isLoading={myLoading}
            emptyMessage="You have no leave requests yet"
            searchPlaceholder="Search by leave type..."
            onSearch={(q) => {
              setMySearch(q);
              setMyPage(1);
            }}
            currentPage={myPage}
            totalPages={myTotalPages}
            onPageChange={setMyPage}
            rowActions={(row) =>
              row.status === 'Pending'
                ? [{ label: 'Cancel Request', danger: true, onClick: () => setCancelTarget(row) }]
                : []
            }
          />
        </div>
      )}

      {/* Leave Requests */}
      {activeTab === 'requests' && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
            columns={reqColumns}
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
      )}

      {/* Panels */}
      <ApplyLeavePanel
        isOpen={applyOpen}
        onClose={() => setApplyOpen(false)}
        tenantSlug={tenantSlug}
        balances={balancesData}
      />

      <LeaveRequestDetailPanel
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        tenantSlug={tenantSlug}
        request={selectedRequest}
      />

      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel Leave Request"
        description={`Cancel your ${cancelTarget?.leaveTypeName} request from ${cancelTarget ? formatDate(cancelTarget.startDate) : ''} to ${cancelTarget ? formatDate(cancelTarget.endDate) : ''}? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Keep Request
            </Button>
            <Button
              variant="danger"
              isLoading={isCancelling}
              loadingText="Cancelling..."
              onClick={() => cancelTarget && cancelRequest(cancelTarget.id)}
            >
              Cancel Request
            </Button>
          </div>
        }
      />
    </div>
  );
}
