'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Modal } from '@/components/organisms/Modal';
import { ClockInWidget } from '@/components/organisms/time-clock/ClockInWidget';
import { LiveAttendanceTable } from '@/components/organisms/time-clock/LiveAttendanceTable';
import { CorrectionRequestPanel } from '@/components/organisms/time-clock/CorrectionRequestPanel';
import {
  useMyTodaySession,
  useClockIn,
  useClockOut,
  useStartBreak,
  useEndBreak,
  useMyAttendanceHistory,
  useAttendanceRecords,
  useCorrectionRequests,
  useReviewCorrectionRequest,
} from '@/hooks/useTimeClock';
import type { TimeEntry, CorrectionRequest } from '@/types/timeclock';

const TAB_ACTIVE =
  'relative text-[#0D2244] font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#0D2244] after:rounded-t-full';
const TAB_IDLE = 'text-gray-500 hover:text-gray-800';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function errMsg(err: unknown) {
  return (
    (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
    'Something went wrong'
  );
}

export default function TimeClockPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug: _tenantSlug } = use(params);
  const user = useAuthStore((s) => s.user);
  const toast = useToast();

  const isAdmin = user?.role === 'TENANT_ADMIN';
  const isManager = isAdmin || user?.isManager === true;

  // ── Today's session ────────────────────────────────────────────────────────
  const { data: session, isLoading: sessionLoading } = useMyTodaySession();
  const { mutate: clockIn, isPending: isClockingIn } = useClockIn();
  const { mutate: clockOut, isPending: isClockingOut } = useClockOut();
  const { mutate: startBreak, isPending: isStartingBreak } = useStartBreak();
  const { mutate: endBreak, isPending: isEndingBreak } = useEndBreak();

  const handleClockIn = () =>
    clockIn(undefined, {
      onSuccess: () => toast.success('Clocked in successfully'),
      onError: (err) => toast.error(errMsg(err)),
    });

  const handleClockOut = () =>
    clockOut(undefined, {
      onSuccess: () => toast.success('Clocked out — have a great rest of your day!'),
      onError: (err) => toast.error(errMsg(err)),
    });

  const handleStartBreak = () =>
    startBreak(undefined, {
      onSuccess: () => toast.success('Break started'),
      onError: (err) => toast.error(errMsg(err)),
    });

  const handleEndBreak = () =>
    endBreak(undefined, {
      onSuccess: () => toast.success('Break ended — welcome back!'),
      onError: (err) => toast.error(errMsg(err)),
    });

  // ── Panels ─────────────────────────────────────────────────────────────────
  const [correctionOpen, setCorrectionOpen] = useState(false);

  // ── My history ─────────────────────────────────────────────────────────────
  const [historyPage, setHistoryPage] = useState(1);
  const { data: historyData, isLoading: historyLoading } = useMyAttendanceHistory(historyPage);
  const historyEntries: TimeEntry[] = historyData?.data ?? [];
  const historyTotalPages = historyData?.totalPages ?? 1;

  // ── Admin: records ─────────────────────────────────────────────────────────
  const [recordsPage, setRecordsPage] = useState(1);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [recordsSearch, setRecordsSearch] = useState('');

  const { data: recordsData, isLoading: recordsLoading } = useAttendanceRecords({
    page: recordsPage,
    fromDate: filterFrom,
    toDate: filterTo,
    departmentId: filterDept,
    status: filterStatus,
    search: recordsSearch,
  });
  const recordsList: TimeEntry[] = recordsData?.data ?? [];
  const recordsTotalPages = recordsData?.totalPages ?? 1;

  const { data: departmentsRaw } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/hr/departments').then((r) => r.data),
    enabled: isManager,
  });
  const departments: { id: string; name: string }[] = Array.isArray(departmentsRaw)
    ? departmentsRaw
    : (departmentsRaw?.data ?? []);

  // ── Admin: corrections ─────────────────────────────────────────────────────
  const [correctionStatusFilter, setCorrectionStatusFilter] = useState<
    'PENDING' | 'APPROVED' | 'REJECTED'
  >('PENDING');
  const { data: corrections = [], isLoading: correctionsLoading } =
    useCorrectionRequests(correctionStatusFilter);

  // Badge count — always fetch pending regardless of active filter
  const { data: pendingCorrections = [] } = useCorrectionRequests('PENDING');
  const pendingCount = isManager ? pendingCorrections.length : 0;

  const { mutate: reviewCorrection, isPending: isReviewing } = useReviewCorrectionRequest();
  const [reviewTarget, setReviewTarget] = useState<{
    req: CorrectionRequest;
    action: 'APPROVED' | 'REJECTED';
  } | null>(null);

  const handleReview = () => {
    if (!reviewTarget) return;
    reviewCorrection(
      { id: reviewTarget.req.id, status: reviewTarget.action },
      {
        onSuccess: () => {
          toast.success(
            reviewTarget.action === 'APPROVED' ? 'Correction approved' : 'Correction rejected',
          );
          setReviewTarget(null);
        },
        onError: (err) => toast.error(errMsg(err)),
      },
    );
  };

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('my');

  const TABS = [
    { key: 'my', label: 'My Time' },
    ...(isManager
      ? [
          { key: 'live', label: 'Live' },
          { key: 'records', label: 'Records' },
          { key: 'corrections', label: 'Corrections', count: pendingCount },
        ]
      : []),
  ];

  // ── My history columns ─────────────────────────────────────────────────────
  const historyColumns: Column<TimeEntry>[] = [
    {
      key: 'date',
      label: 'Date',
      render: (r) => <span className="text-gray-700">{formatDate(r.date)}</span>,
    },
    {
      key: 'clockIn',
      label: 'Clock In',
      render: (r) => (
        <span className="font-medium text-gray-900 tabular-nums">{formatTime(r.clockIn)}</span>
      ),
    },
    {
      key: 'clockOut',
      label: 'Clock Out',
      render: (r) => (
        <span className="text-gray-700 tabular-nums">
          {r.clockOut ? formatTime(r.clockOut) : '—'}
        </span>
      ),
    },
    {
      key: 'breakMinutes',
      label: 'Break',
      render: (r) => (
        <span className="text-gray-600">
          {r.breakMinutes > 0 ? formatMinutes(r.breakMinutes) : '—'}
        </span>
      ),
    },
    {
      key: 'totalMinutes',
      label: 'Hours',
      render: (r) => (
        <span className="font-semibold text-gray-900">{formatMinutes(r.totalMinutes)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        if (r.status === 'ABSENT') return <Badge variant="danger" label="Absent" />;
        if (r.isLate) return <Badge variant="warning" label="Late" />;
        if (r.status === 'CLOCKED_IN') return <Badge variant="info" label="Active" />;
        return <Badge variant="success" label="On Time" />;
      },
    },
  ];

  // ── Admin records columns ──────────────────────────────────────────────────
  const recordsColumns: Column<TimeEntry>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      render: (r) => <span className="font-medium text-gray-900">{r.employeeName ?? '—'}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      render: (r) => <span className="text-gray-700">{formatDate(r.date)}</span>,
    },
    {
      key: 'department',
      label: 'Department',
      render: (r) => <span className="text-gray-600">{r.department ?? '—'}</span>,
    },
    {
      key: 'clockIn',
      label: 'Clock In',
      render: (r) => <span className="tabular-nums text-gray-700">{formatTime(r.clockIn)}</span>,
    },
    {
      key: 'clockOut',
      label: 'Clock Out',
      render: (r) => (
        <span className="tabular-nums text-gray-700">
          {r.clockOut ? formatTime(r.clockOut) : '—'}
        </span>
      ),
    },
    {
      key: 'totalMinutes',
      label: 'Hours',
      render: (r) => (
        <span className="font-semibold text-gray-900">{formatMinutes(r.totalMinutes)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        if (r.status === 'ABSENT') return <Badge variant="danger" label="Absent" />;
        if (r.isLate) return <Badge variant="warning" label="Late" />;
        if (r.status === 'ON_BREAK') return <Badge variant="info" label="On Break" />;
        if (r.status === 'CLOCKED_IN') return <Badge variant="info" label="Active" />;
        return <Badge variant="success" label="On Time" />;
      },
    },
  ];

  // ── Corrections columns ────────────────────────────────────────────────────
  const correctionsColumns: Column<CorrectionRequest>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      render: (r) => <span className="font-medium text-gray-900">{r.employeeName ?? '—'}</span>,
    },
    {
      key: 'date',
      label: 'Date',
      render: (r) => <span className="text-gray-700">{formatDate(r.date)}</span>,
    },
    {
      key: 'requestedClockIn',
      label: 'Requested In',
      render: (r) => (
        <span className="tabular-nums text-gray-700">
          {r.requestedClockIn ? formatTime(`1970-01-01T${r.requestedClockIn}`) : '—'}
        </span>
      ),
    },
    {
      key: 'requestedClockOut',
      label: 'Requested Out',
      render: (r) => (
        <span className="tabular-nums text-gray-700">
          {r.requestedClockOut ? formatTime(`1970-01-01T${r.requestedClockOut}`) : '—'}
        </span>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (r) => (
        <span className="text-gray-600 text-sm line-clamp-1 max-w-xs">{r.reason}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Submitted',
      render: (r) => <span className="text-gray-500 text-sm">{formatDate(r.createdAt)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        const map = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' } as const;
        return <Badge variant={map[r.status]} label={r.status} />;
      },
    },
  ];

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Time Clock</h1>
          <p className="text-sm text-gray-400 mt-0.5">Track attendance and working hours</p>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
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
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── My Time tab ────────────────────────────────────────────────────── */}
      {activeTab === 'my' && (
        <div className="flex flex-col gap-6">
          <ClockInWidget
            session={session}
            isLoading={sessionLoading}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            onStartBreak={handleStartBreak}
            onEndBreak={handleEndBreak}
            onReportMissed={() => setCorrectionOpen(true)}
            isClockingIn={isClockingIn}
            isClockingOut={isClockingOut}
            isBreaking={isStartingBreak || isEndingBreak}
          />

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-700">Attendance History</h2>
            <DataTable
              columns={historyColumns}
              data={historyEntries}
              isLoading={historyLoading}
              emptyMessage="No attendance records yet"
              currentPage={historyPage}
              totalPages={historyTotalPages}
              onPageChange={setHistoryPage}
            />
          </div>
        </div>
      )}

      {/* ── Live tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'live' && isManager && <LiveAttendanceTable />}

      {/* ── Records tab ────────────────────────────────────────────────────── */}
      {activeTab === 'records' && isManager && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <DatePicker
              placeholder="From date"
              value={filterFrom}
              onChange={(v) => {
                setFilterFrom(v);
                setRecordsPage(1);
              }}
            />
            <DatePicker
              placeholder="To date"
              value={filterTo}
              onChange={(v) => {
                setFilterTo(v);
                setRecordsPage(1);
              }}
            />
            <SearchSelect
              placeholder="All departments"
              options={[
                { value: '', label: 'All departments' },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
              value={filterDept}
              onChange={(v) => {
                setFilterDept(v);
                setRecordsPage(1);
              }}
            />
            <SearchSelect
              placeholder="All statuses"
              options={[
                { value: '', label: 'All statuses' },
                { value: 'CLOCKED_IN', label: 'Active' },
                { value: 'CLOCKED_OUT', label: 'Clocked Out' },
                { value: 'ON_BREAK', label: 'On Break' },
                { value: 'ABSENT', label: 'Absent' },
              ]}
              value={filterStatus}
              onChange={(v) => {
                setFilterStatus(v);
                setRecordsPage(1);
              }}
            />
          </div>

          <DataTable
            columns={recordsColumns}
            data={recordsList}
            isLoading={recordsLoading}
            emptyMessage="No records found"
            searchPlaceholder="Search by employee name…"
            onSearch={(q) => {
              setRecordsSearch(q);
              setRecordsPage(1);
            }}
            currentPage={recordsPage}
            totalPages={recordsTotalPages}
            onPageChange={setRecordsPage}
            onExport={() => {
              // Export as CSV — build a data URL from current page results
              const headers = [
                'Employee',
                'Date',
                'Department',
                'Clock In',
                'Clock Out',
                'Hours',
                'Status',
              ];
              const rows = recordsList.map((r) => [
                r.employeeName ?? '',
                formatDate(r.date),
                r.department ?? '',
                formatTime(r.clockIn),
                r.clockOut ? formatTime(r.clockOut) : '',
                formatMinutes(r.totalMinutes),
                r.status,
              ]);
              const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `attendance-records-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          />
        </div>
      )}

      {/* ── Corrections tab ────────────────────────────────────────────────── */}
      {activeTab === 'corrections' && isManager && (
        <div className="flex flex-col gap-4">
          {/* Status filter strip */}
          <div className="flex items-center gap-2">
            {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setCorrectionStatusFilter(s)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                  correctionStatusFilter === s
                    ? 'bg-[#0D2244] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {s === 'PENDING'
                  ? `Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}`
                  : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <DataTable
            columns={correctionsColumns}
            data={corrections}
            isLoading={correctionsLoading}
            emptyMessage={`No ${correctionStatusFilter.toLowerCase()} correction requests`}
            currentPage={1}
            totalPages={1}
            onPageChange={() => {}}
            rowActions={(row) =>
              row.status === 'PENDING'
                ? [
                    {
                      label: 'Approve',
                      onClick: () => setReviewTarget({ req: row, action: 'APPROVED' }),
                    },
                    {
                      label: 'Reject',
                      danger: true,
                      onClick: () => setReviewTarget({ req: row, action: 'REJECTED' }),
                    },
                  ]
                : [{ label: 'View', onClick: () => {} }]
            }
          />
        </div>
      )}

      {/* ── Panels & Modals ────────────────────────────────────────────────── */}
      <CorrectionRequestPanel isOpen={correctionOpen} onClose={() => setCorrectionOpen(false)} />

      <Modal
        isOpen={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        title={reviewTarget?.action === 'APPROVED' ? 'Approve Correction' : 'Reject Correction'}
        description={
          reviewTarget
            ? `${reviewTarget.action === 'APPROVED' ? 'Approve' : 'Reject'} the correction request from ${reviewTarget.req.employeeName ?? 'this employee'} for ${formatDate(reviewTarget.req.date)}?`
            : ''
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setReviewTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={reviewTarget?.action === 'APPROVED' ? 'primary' : 'danger'}
              isLoading={isReviewing}
              loadingText="Saving…"
              onClick={handleReview}
            >
              {reviewTarget?.action === 'APPROVED' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        }
      />
    </div>
  );
}
