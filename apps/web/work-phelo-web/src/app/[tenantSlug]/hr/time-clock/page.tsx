'use client';

import { use, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatDate } from '@/lib/formatters';
import { useDepartments } from '@/hooks/useDepartments';

import { CorrectionRequestPanel } from '@/components/organisms/time-clock/CorrectionRequestPanel';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';

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
import { TimeClockTabs } from '@/components/molecules/time-clock/TimeClockTabs';
import { MyTimeSection } from '@/components/organisms/time-clock/MyTimeSection';
import { LiveAttendanceTable } from '@/components/organisms/time-clock/LiveAttendanceTable';
import { RecordsSection } from '@/components/organisms/time-clock/RecordSection';
import { CorrectionsSection } from '@/components/organisms/time-clock/CorrectionSection';

export default function TimeClockPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  use(params);
  const user = useAuthStore((s) => s.user);
  const toast = useToast();

  const isAdmin = user?.role === 'TENANT_ADMIN';
  const isManager = isAdmin || user?.isManager === true;

  const [activeTab, setActiveTab] = useState<'my' | 'live' | 'records' | 'corrections'>('my');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{
    req: { id: string; employeeName?: string; date: string };
    action: 'APPROVED' | 'REJECTED';
  } | null>(null);

  // My Time hooks
  const { data: session, isLoading: sessionLoading } = useMyTodaySession();
  const { mutate: clockIn, isPending: isClockingIn } = useClockIn();
  const { mutate: clockOut, isPending: isClockingOut } = useClockOut();
  const { mutate: startBreak, isPending: isStartingBreak } = useStartBreak();
  const { mutate: endBreak, isPending: isEndingBreak } = useEndBreak();

  // History
  const [historyPage, setHistoryPage] = useState(1);
  const { data: historyData, isLoading: historyLoading } = useMyAttendanceHistory(historyPage);

  // Records (Admin)
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

  const { data: departmentsRaw } = useDepartments();
  const departments = Array.isArray(departmentsRaw) ? departmentsRaw : [];

  // Corrections
  const [correctionStatusFilter, setCorrectionStatusFilter] = useState<
    'PENDING' | 'APPROVED' | 'REJECTED'
  >('PENDING');
  const { data: corrections = [], isLoading: correctionsLoading } =
    useCorrectionRequests(correctionStatusFilter);

  const { data: pendingCorrections = [] } = useCorrectionRequests('PENDING');
  const pendingCount = isManager ? pendingCorrections.length : 0;

  const { mutate: reviewCorrection, isPending: isReviewing } = useReviewCorrectionRequest();

  const handleReview = () => {
    if (!reviewTarget) return;
    reviewCorrection(
      { id: reviewTarget.req.id, action: reviewTarget.action },
      {
        onSuccess: () => {
          toast.success(
            reviewTarget.action === 'APPROVED' ? 'Correction approved' : 'Correction rejected',
          );
          setReviewTarget(null);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to review correction')),
      },
    );
  };

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <TimeClockTabs
        activeTab={activeTab}
        isManager={isManager}
        pendingCount={pendingCount}
        onTabChange={setActiveTab}
      />

      {activeTab === 'my' && (
        <MyTimeSection
          session={session}
          isLoading={sessionLoading}
          onClockIn={() => clockIn(undefined)}
          onClockOut={() => clockOut()}
          onStartBreak={() => startBreak()}
          onEndBreak={() => endBreak()}
          onReportMissed={() => setCorrectionOpen(true)}
          isClockingIn={isClockingIn}
          isClockingOut={isClockingOut}
          isBreaking={isStartingBreak || isEndingBreak}
          historyData={historyData}
          historyLoading={historyLoading}
          historyPage={historyPage}
          onHistoryPageChange={setHistoryPage}
        />
      )}

      {activeTab === 'live' && isManager && <LiveAttendanceTable />}

      {activeTab === 'records' && isManager && (
        <RecordsSection
          recordsData={recordsData}
          recordsLoading={recordsLoading}
          recordsPage={recordsPage}
          onRecordsPageChange={setRecordsPage}
          filterFrom={filterFrom}
          filterTo={filterTo}
          filterDept={filterDept}
          filterStatus={filterStatus}
          recordsSearch={recordsSearch}
          onFilterFromChange={setFilterFrom}
          onFilterToChange={setFilterTo}
          onFilterDeptChange={setFilterDept}
          onFilterStatusChange={setFilterStatus}
          onRecordsSearchChange={setRecordsSearch}
          departments={departments}
        />
      )}

      {activeTab === 'corrections' && isManager && (
        <CorrectionsSection
          corrections={corrections}
          correctionsLoading={correctionsLoading}
          correctionStatusFilter={correctionStatusFilter}
          onStatusFilterChange={setCorrectionStatusFilter}
          pendingCount={pendingCount}
          onReview={(req, action) => setReviewTarget({ req, action })}
        />
      )}

      {/* Global Panels */}
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
            <Button variant="outline" onClick={() => setReviewTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={reviewTarget?.action === 'APPROVED' ? 'primary' : 'danger'}
              isLoading={isReviewing}
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
