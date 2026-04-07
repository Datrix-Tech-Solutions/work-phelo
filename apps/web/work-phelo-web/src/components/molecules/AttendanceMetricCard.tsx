'use client';

import { Clock } from 'lucide-react';
import { Button } from '@/components/atoms/Button';

interface AttendanceMetricCardProps {
  clockedIn: boolean;
  clockInTime?: string;
  onClockIn: () => void;
  onClockOut: () => void;
  isLoading?: boolean;
}

export function AttendanceMetricCard({
  clockedIn,
  clockInTime,
  onClockIn,
  onClockOut,
  isLoading = false,
}: AttendanceMetricCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-card px-5 py-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 font-medium">
          {clockedIn ? 'Today’s Attendance' : 'Clock In'}
        </span>
        <Clock className="w-5 h-5 text-gray-400" />
      </div>

      {/* Content */}
      <div className="flex items-end justify-between min-h-13">
        {clockedIn ? (
          <div>
            <p className="text-sm text-gray-700">
              Clocked in at <span className="font-semibold text-gray-900">{clockInTime}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">You haven’t clocked in yet</p>
        )}

        {/* Action Button */}
        {clockedIn ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onClockOut}
            disabled={isLoading}
            className="text-orange-600 border-orange-200 hover:bg-orange-50"
          >
            Clock Out
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={onClockIn}
            disabled={isLoading}
            className="bg-[#0D2244] hover:bg-[#162d56]"
          >
            Clock In
          </Button>
        )}
      </div>
    </div>
  );
}
