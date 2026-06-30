import { ClockInWidget } from '@/components/organisms/hr/time-clock/ClockInWidget';
import { Badge } from '@/components/atoms/Badge';
import { formatDate, formatTime, formatMinutes } from '@/lib/formatters';
import { Column, DataTable } from '../../shared/DataTable';
import type { TodaySession, TimeEntry } from '@/types/timeclock';

interface Props {
  session: TodaySession | undefined;
  isLoading: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  onReportMissed: () => void;
  isClockingIn: boolean;
  isClockingOut: boolean;
  historyData: { data?: TimeEntry[]; totalPages?: number } | undefined;
  historyLoading: boolean;
  historyPage: number;
  onHistoryPageChange: (page: number) => void;
}

export function MyTimeSection({
  session,
  isLoading,
  onClockIn,
  onClockOut,
  onReportMissed,
  isClockingIn,
  isClockingOut,
  historyData,
  historyLoading,
  historyPage,
  onHistoryPageChange,
}: Props) {
  const historyEntries = historyData?.data ?? [];
  const historyTotalPages = historyData?.totalPages ?? 1;

  const historyColumns: Column<TimeEntry>[] = [
    { key: 'date', label: 'Date', render: (r) => <span>{formatDate(r.date)}</span> },
    { key: 'clockIn', label: 'CLOCK IN', render: (r) => <span>{formatTime(r.clockIn)}</span> },
    {
      key: 'clockOut',
      label: 'Clock out',
      render: (r) => <span>{r.clockOut ? formatTime(r.clockOut) : '—'}</span>,
    },
    {
      key: 'totalMinutes',
      label: 'Hours',
      render: (r) => <span>{r.totalMinutes > 0 ? formatMinutes(r.totalMinutes) : '—'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold capitalize">
            {r.status === 'CLOCKED_IN' ? 'Active' : r.status === 'ON_BREAK' ? 'On Break' : 'Done'}
          </span>
          {r.workMode ? (
            <Badge
              variant="info"
              label={r.workMode.charAt(0) + r.workMode.slice(1).toLowerCase()}
            />
          ) : null}
          {r.isOutsideSchedule ? (
            <Badge variant="warning" label="Off Schedule" />
          ) : r.isLate ? (
            <Badge variant="warning" label="Late" />
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="shrink-0">
        <ClockInWidget
          session={session}
          isLoading={isLoading}
          onClockIn={onClockIn}
          onClockOut={onClockOut}
          onReportMissed={onReportMissed}
          isClockingIn={isClockingIn}
          isClockingOut={isClockingOut}
        />
      </div>

      <div className="flex flex-col">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 shrink-0">Attendance History</h2>
        <DataTable
          columns={historyColumns}
          data={historyEntries}
          isLoading={historyLoading}
          emptyMessage="No attendance records yet"
          currentPage={historyPage}
          totalPages={historyTotalPages}
          onPageChange={onHistoryPageChange}
          noInternalScroll
        />
      </div>
    </div>
  );
}
