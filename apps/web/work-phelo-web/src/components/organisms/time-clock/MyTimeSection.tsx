import { ClockInWidget } from '@/components/organisms/time-clock/ClockInWidget';
import { formatDate, formatTime, formatMinutes } from '@/lib/formatters';
import { Column, DataTable } from '../shared/DataTable';
import type { TodaySession, TimeEntry } from '@/types/timeclock';

interface Props {
  session: TodaySession | undefined;
  isLoading: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onReportMissed: () => void;
  isClockingIn: boolean;
  isClockingOut: boolean;
  isBreaking: boolean;
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
  onStartBreak,
  onEndBreak,
  onReportMissed,
  isClockingIn,
  isClockingOut,
  isBreaking,
  historyData,
  historyLoading,
  historyPage,
  onHistoryPageChange,
}: Props) {
  const historyEntries = historyData?.data ?? [];
  const historyTotalPages = historyData?.totalPages ?? 1;

  const historyColumns: Column<TimeEntry>[] = [
    { key: 'date', label: 'Date', render: (r) => <span>{formatDate(r.date)}</span> },
    { key: 'clockIn', label: 'Clock In', render: (r) => <span>{formatTime(r.clockIn)}</span> },
    {
      key: 'clockOut',
      label: 'Clock Out',
      render: (r) => <span>{r.clockOut ? formatTime(r.clockOut) : '—'}</span>,
    },
    {
      key: 'breakMinutes',
      label: 'Break',
      render: (r) => <span>{r.breakMinutes > 0 ? formatMinutes(r.breakMinutes) : '—'}</span>,
    },
    {
      key: 'totalMinutes',
      label: 'Hours',
      render: (r) => <span className="font-semibold">{formatMinutes(r.totalMinutes)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ClockInWidget
        session={session}
        isLoading={isLoading}
        onClockIn={onClockIn}
        onClockOut={onClockOut}
        onStartBreak={onStartBreak}
        onEndBreak={onEndBreak}
        onReportMissed={onReportMissed}
        isClockingIn={isClockingIn}
        isClockingOut={isClockingOut}
        isBreaking={isBreaking}
      />

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Attendance History</h2>
        <DataTable
          columns={historyColumns}
          data={historyEntries}
          isLoading={historyLoading}
          emptyMessage="No attendance records yet"
          currentPage={historyPage}
          totalPages={historyTotalPages}
          onPageChange={onHistoryPageChange}
        />
      </div>
    </div>
  );
}
