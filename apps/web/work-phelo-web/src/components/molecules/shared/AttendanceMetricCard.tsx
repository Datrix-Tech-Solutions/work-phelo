'use client';

import { useState } from 'react';
import { Clock, CheckCircle2, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { cardClass } from '@/lib/utils';

interface AttendanceMetricCardProps {
  clockedIn: boolean;
  isDone: boolean;
  clockInTime?: string;
  hoursWorked?: string;
  onClockIn: () => void;
  onClockOut: () => void;
  isLoading?: boolean;
}

export function AttendanceMetricCard({
  clockedIn,
  isDone,
  clockInTime,
  hoursWorked,
  onClockIn,
  onClockOut,
  isLoading = false,
}: AttendanceMetricCardProps) {
  const [confirmClockIn, setConfirmClockIn] = useState(false);
  const [confirmClockOut, setConfirmClockOut] = useState(false);

  return (
    <div className={cardClass('px-5 py-5 flex flex-col', 'glass')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 font-medium">
          {clockedIn || isDone ? "Today's Attendance" : 'Clock In'}
        </span>
        {isDone ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <Clock className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 flex-1 justify-end mt-2">
        <div className="text-sm min-w-0">
          {isDone ? (
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold text-green-600">All done for today!</p>
              {hoursWorked && <p className="text-xs text-gray-400">{hoursWorked} hours worked</p>}
            </div>
          ) : clockedIn ? (
            <p className="text-gray-700">
              Clocked in at <span className="font-semibold text-gray-900">{clockInTime}</span>
            </p>
          ) : (
            <p className="text-gray-400">You haven&apos;t clocked in yet</p>
          )}
        </div>

        {/* Action Button */}
        <div>
          {isDone ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-full border border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Completed
            </span>
          ) : clockedIn ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmClockOut(true)}
              disabled={isLoading}
              //look for a better for clock out
              icon={<LogOut className="w-4 h-4" />}
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              Clock Out
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setConfirmClockIn(true)}
              disabled={isLoading}
              //look for a better for clock in
              icon={<LogIn className="w-4 h-4" />}
              className="bg-brand hover:bg-brand-hover"
            >
              Clock In
            </Button>
          )}
        </div>
      </div>

      <Modal
        isOpen={confirmClockIn}
        onClose={() => setConfirmClockIn(false)}
        title="Clock In"
        description="Are you sure you want to clock in?"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmClockIn(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setConfirmClockIn(false);
                onClockIn();
              }}
              className="bg-brand hover:bg-brand-hover"
            >
              Confirm
            </Button>
          </>
        }
      />

      <Modal
        isOpen={confirmClockOut}
        onClose={() => setConfirmClockOut(false)}
        title="Clock Out"
        description="Are you sure you want to clock out?"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmClockOut(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setConfirmClockOut(false);
                onClockOut();
              }}
              className="bg-brand hover:bg-brand-hover"
            >
              Confirm
            </Button>
          </>
        }
      />
    </div>
  );
}
