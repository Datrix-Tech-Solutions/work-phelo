'use client';

import { useState } from 'react';
import { ClockAlert, MapPin } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { CorrectionRequestPanel } from '@/components/organisms/hr/time-clock/CorrectionRequestPanel';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { useMyAttendanceHistory } from '@/hooks/hr/useTimeClock';
import { formatDate, formatTime, formatMinutes } from '@/lib/formatters';

interface MyAttendancePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MyAttendancePanel({ isOpen, onClose }: MyAttendancePanelProps) {
  const { data: historyData, isLoading } = useMyAttendanceHistory();
  const entries = historyData?.data ?? [];
  const [correctionOpen, setCorrectionOpen] = useState(false);

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="My Attendance"
      description="Your clock-in history."
      width="sm:w-[480px]"
      footer={
        <div className="flex justify-end">
          <Button onClick={() => setCorrectionOpen(true)}>
            <ClockAlert className="w-4 h-4 mr-1.5" />
            Request Time Change
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <p className="text-sm text-gray-400">No attendance records yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between px-4 py-4 border border-gray-200 rounded-card bg-white"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">{formatDate(entry.date)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatTime(entry.clockIn)} – {entry.clockOut ? formatTime(entry.clockOut) : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {entry.totalMinutes > 0 ? formatMinutes(entry.totalMinutes) : '—'}
                </p>
                {entry.location && (
                  <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {entry.location}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge
                  variant={
                    entry.status === 'CLOCKED_IN'
                      ? 'success'
                      : entry.status === 'ON_BREAK'
                        ? 'warning'
                        : 'neutral'
                  }
                  label={
                    entry.status === 'CLOCKED_IN'
                      ? 'Active'
                      : entry.status === 'ON_BREAK'
                        ? 'On Break'
                        : 'Done'
                  }
                />
                {entry.isLate && <span className="text-xs text-amber-600">Late</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      <CorrectionRequestPanel isOpen={correctionOpen} onClose={() => setCorrectionOpen(false)} />
    </SidePanel>
  );
}
